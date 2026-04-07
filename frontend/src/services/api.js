import axios from 'axios';

// Detectar se esta rodando em Electron
const isElectron = window.electronAPI !== undefined;

// Sincronizar token IPC ao iniciar (se ja logado via localStorage)
if (isElectron) {
  const savedToken = localStorage.getItem('crm_token');
  if (savedToken) {
    window.electronAPI.invoke('set-auth-token', savedToken).catch(() => {});
  }
}

// Criar instancia Axios (usado como fallback e para file uploads)
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('crm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('crm_token');
      localStorage.removeItem('crm_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Trata erros IPC de forma consistente.
 * Detecta 401 e redireciona para login.
 * Encapsula o erro no formato axios-like para compatibilidade com o frontend.
 */
function handleIpcError(error) {
  const msg = error?.message || String(error);
  console.error('[CRM]', msg);

  if (msg.includes('401') || msg.includes('Token')) {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    window.location.href = '/login';
  }

  const wrapped = new Error(msg);
  wrapped.response = {
    data: { error: msg, message: msg },
    status: error?.status || (msg.includes('401') ? 401 : 500),
  };
  return Promise.reject(wrapped);
}

// Wrapper que usa Electron IPC ou Axios
const api = {
  // ==================== GET ====================
  get: async (url, config = {}) => {
    if (isElectron) {
      const endpoint = url.startsWith('/') ? url.slice(1) : url;
      try {
        const ea = window.electronAPI;
        let result;

        if (endpoint.startsWith('leads/stats')) {
          result = await ea.getStats();
        } else if (endpoint === 'leads' || endpoint === 'leads/') {
          result = await ea.getLeads(config.params || {});
        } else if (endpoint.startsWith('leads/')) {
          result = await ea.getLead(endpoint.split('/')[1]);
        } else if (endpoint.startsWith('interactions/')) {
          result = await ea.invoke('get-interactions', endpoint.split('/')[1]);
        } else {
          return axiosInstance.get(url, config);
        }

        return { data: result };
      } catch (error) {
        return handleIpcError(error);
      }
    }
    return axiosInstance.get(url, config);
  },

  // ==================== POST ====================
  post: async (url, data = {}, config = {}) => {
    if (isElectron) {
      const endpoint = url.startsWith('/') ? url.slice(1) : url;
      try {
        const ea = window.electronAPI;

        // Auth
        if (endpoint === 'auth/login' || endpoint.startsWith('auth/login')) {
          // Add timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Login timeout - servidor não respondeu em 15s')), 15000)
          );
          const result = await Promise.race([
            ea.login(data.email, data.senha),
            timeoutPromise
          ]);
          return { data: result };
        }
        if (endpoint === 'auth/register' || endpoint.startsWith('auth/register')) {
          // Add timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Register timeout - servidor não respondeu em 15s')), 15000)
          );
          const result = await Promise.race([
            ea.invoke('auth-register', data),
            timeoutPromise
          ]);
          return { data: result };
        }

        // Scraper
        if (endpoint.startsWith('scraper/search')) {
          const result = await ea.searchLeads(data.searchTerm);
          return { data: result };
        }
        if (endpoint.startsWith('scraper/google-maps')) {
          const result = await ea.scrapeUrl(data.url);
          return { data: result };
        }

        // File upload - usa axios direto (multipart nao passa por IPC)
        if (endpoint === 'leads/upload') {
          return axiosInstance.post(url, data, config);
        }

        // Spreadsheet JSON endpoints
        if (endpoint === 'leads/check-duplicates') {
          const result = await ea.checkDuplicates(data);
          return { data: result };
        }
        if (endpoint === 'leads/import-google-maps') {
          const result = await ea.importGoogleMaps(data);
          return { data: result };
        }
        if (endpoint === 'leads/import-spreadsheet') {
          const result = await ea.importSpreadsheet(data);
          return { data: result };
        }

        // Leads
        if (endpoint === 'leads/import') {
          const result = await ea.importLeads(data.leads);
          return { data: result };
        }
        if (endpoint === 'leads' || endpoint === 'leads/') {
          const result = await ea.createLead(data);
          return { data: result };
        }

        // Interactions
        if (endpoint.startsWith('interactions/')) {
          const leadId = endpoint.split('/')[1];
          const result = await ea.invoke('create-interaction', { leadId, ...data });
          return { data: result };
        }

        // Fallback
        return axiosInstance.post(url, data, config);
      } catch (error) {
        return handleIpcError(error);
      }
    }
    return axiosInstance.post(url, data, config);
  },

  // ==================== PUT ====================
  put: async (url, data = {}, config = {}) => {
    if (isElectron) {
      const endpoint = url.startsWith('/') ? url.slice(1) : url;
      try {
        if (endpoint.startsWith('leads/')) {
          const leadId = endpoint.split('/')[1];
          const result = await window.electronAPI.updateLead(leadId, data);
          return { data: result };
        }
        return axiosInstance.put(url, data, config);
      } catch (error) {
        return handleIpcError(error);
      }
    }
    return axiosInstance.put(url, data, config);
  },

  // ==================== DELETE ====================
  delete: async (url, config = {}) => {
    if (isElectron) {
      const endpoint = url.startsWith('/') ? url.slice(1) : url;
      try {
        // Bulk delete: DELETE /leads com body { ids }
        if (endpoint === 'leads' || endpoint === 'leads/') {
          const ids = config?.data?.ids || [];
          const result = await window.electronAPI.deleteMultiple(ids);
          return { data: result };
        }
        // Single delete: DELETE /leads/:id
        if (endpoint.startsWith('leads/')) {
          const leadId = endpoint.split('/')[1];
          const result = await window.electronAPI.deleteLead(leadId);
          return { data: result };
        }
        return axiosInstance.delete(url, config);
      } catch (error) {
        return handleIpcError(error);
      }
    }
    return axiosInstance.delete(url, config);
  },
};

export default api;
