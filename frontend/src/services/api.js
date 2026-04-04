import axios from 'axios';

// Detectar se está rodando em Electron
const isElectron = window.electronAPI !== undefined;

// Sincronizar token IPC ao iniciar (se já logado via localStorage)
if (isElectron) {
  const savedToken = localStorage.getItem('crm_token');
  if (savedToken) {
    window.electronAPI.invoke('set-auth-token', savedToken).catch(() => {});
  }
}

// Criar instância Axios como fallback
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

// Detectar 401 em respostas IPC e redirecionar para login
function handleElectronError(error) {
  const msg = error?.message || '';
  if (msg.includes('401')) {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    window.location.href = '/login';
  }
  return Promise.reject(error);
}

// Verificar se resposta IPC contém erro (handlers retornam { error } ao invés de throw)
function checkIpcResult(result) {
  if (result && result.error && typeof result.error === 'string' && result.error.includes('401')) {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    window.location.href = '/login';
    throw new Error(result.error);
  }
  return result;
}

// Wrapper que usa Electron IPC ou Axios
const api = {
  // GET request
  get: async (url, config = {}) => {
    if (isElectron) {
      // Extrair endpoint do URL (remover /api/)
      const endpoint = url.startsWith('/') ? url.slice(1) : url;
      try {
        const electronAPI = window.electronAPI;
        let result;
        
        // Redirecionar para handlers específicos
        if (endpoint.startsWith('leads/stats')) {
          result = await electronAPI.getStats();
        } else if (endpoint === 'leads' || endpoint === 'leads/') {
          result = await electronAPI.getLeads(config.params || {});
        } else if (endpoint.startsWith('leads/')) {
          // leads/{id} - buscar lead individual
          const leadId = endpoint.split('/')[1];
          result = await electronAPI.getLead(leadId);
        } else if (endpoint.startsWith('interactions/')) {
          result = await electronAPI.invoke('get-interactions', endpoint.split('/')[1]);
        }
        checkIpcResult(result);
        return { data: result };
      } catch (error) {
        return handleElectronError(error);
      }
    }
    return axiosInstance.get(url, config);
  },

  // POST request
  post: async (url, data = {}, config = {}) => {
    if (isElectron) {
      const endpoint = url.startsWith('/') ? url.slice(1) : url;
      try {
        const electronAPI = window.electronAPI;
        
        // Redirecionar para handlers específicos
        if (endpoint.startsWith('auth/login')) {
          try {
            const result = await electronAPI.login(data.email, data.senha);
            return { data: result };
          } catch (err) {
            const error = new Error(err.message || 'Credenciais inválidas');
            error.response = { data: { message: err.message || 'Credenciais inválidas' }, status: 401 };
            throw error;
          }
        } else if (endpoint.startsWith('auth/register')) {
          try {
            const result = await electronAPI.invoke('auth-register', data);
            return { data: result };
          } catch (err) {
            const error = new Error(err.message || 'Erro ao registrar');
            error.response = { data: { message: err.message || 'Erro ao registrar' }, status: 400 };
            throw error;
          }
        } else if (endpoint.startsWith('scraper/search')) {
          const result = await electronAPI.searchLeads(data.searchTerm);
          return { data: result };
        } else if (endpoint.startsWith('scraper/google-maps')) {
          const result = await electronAPI.scrapeUrl(data.url);
          return { data: result };
        } else if (endpoint.startsWith('leads/import')) {
          const result = await electronAPI.importLeads(data.leads);
          return { data: result };
        } else if (endpoint.startsWith('leads')) {
          const result = await electronAPI.createLead(data);
          return { data: result };
        } else if (endpoint.startsWith('interactions')) {
          const leadId = endpoint.split('/')[1];
          const result = await electronAPI.invoke('create-interaction', { leadId, ...data });
          checkIpcResult(result);
          return { data: result };
        }
      } catch (error) {
        return handleElectronError(error);
      }
    }
    return axiosInstance.post(url, data, config);
  },

  // PUT request
  put: async (url, data = {}, config = {}) => {
    if (isElectron) {
      const endpoint = url.startsWith('/') ? url.slice(1) : url;
      try {
        const electronAPI = window.electronAPI;
        const leadId = endpoint.split('/')[1];
        
        if (endpoint.startsWith('leads')) {
          const result = await electronAPI.updateLead(leadId, data);
          checkIpcResult(result);
          return { data: result };
        }
      } catch (error) {
        return handleElectronError(error);
      }
    }
    return axiosInstance.put(url, data, config);
  },

  // DELETE request
  delete: async (url, config = {}) => {
    if (isElectron) {
      const endpoint = url.startsWith('/') ? url.slice(1) : url;
      try {
        const electronAPI = window.electronAPI;
        const leadId = endpoint.split('/')[1];
        
        if (endpoint.startsWith('leads')) {
          const result = await electronAPI.deleteLead(leadId);
          return { data: { success: result } };
        }
      } catch (error) {
        return handleElectronError(error);
      }
    }
    return axiosInstance.delete(url, config);
  },
};

export default api;

