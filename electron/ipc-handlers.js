const { ipcMain } = require('electron');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const API_BASE_URL = 'http://localhost:3001/api';

// Headers padrao com suporte a autenticacao
let headers = {
  'Content-Type': 'application/json',
};

/**
 * Helper: faz fetch na API backend com tratamento de erros consistente.
 * SEMPRE throw em caso de erro - nunca retorna { error }.
 */
async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}/${endpoint}`;
  const method = options.method || 'GET';
  console.log(`[IPC] ${method} ${url}`);

  const response = await fetch(url, { headers, ...options });

  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const msg = data.error || data.message || `Erro ${response.status}`;
    console.error(`[IPC] Erro ${response.status}: ${msg}`);
    const error = new Error(msg);
    error.status = response.status;
    throw error;
  }

  return data;
}

// ==================== TOKEN ====================
ipcMain.handle('set-auth-token', async (event, token) => {
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('[IPC] Token sincronizado');
  } else {
    delete headers['Authorization'];
    console.log('[IPC] Token removido');
  }
  return { success: true };
});

// ==================== AUTH ====================
ipcMain.handle('user-login', async (event, { email, password }) => {
  const data = await apiFetch('auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha: password }),
  });
  if (data.token) {
    headers['Authorization'] = `Bearer ${data.token}`;
  }
  return data;
});

ipcMain.handle('user-logout', async () => {
  delete headers['Authorization'];
  console.log('[IPC] Logout');
  return { success: true };
});

ipcMain.handle('auth-register', async (event, userData) => {
  const data = await apiFetch('auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
  if (data.token) {
    headers['Authorization'] = `Bearer ${data.token}`;
  }
  return data;
});

// ==================== SCRAPER ====================
ipcMain.handle('search-leads', async (event, term) => {
  return apiFetch('scraper/search', {
    method: 'POST',
    body: JSON.stringify({ searchTerm: term }),
  });
});

ipcMain.handle('scrape-url', async (event, url) => {
  return apiFetch('scraper/google-maps', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
});

// ==================== LEADS ====================
ipcMain.handle('get-leads', async (event, filters = {}) => {
  const params = new URLSearchParams(filters);
  return apiFetch(`leads?${params}`);
});

ipcMain.handle('get-lead', async (event, id) => {
  return apiFetch(`leads/${id}`);
});

ipcMain.handle('create-lead', async (event, lead) => {
  return apiFetch('leads', {
    method: 'POST',
    body: JSON.stringify(lead),
  });
});

ipcMain.handle('update-lead', async (event, { id, lead }) => {
  return apiFetch(`leads/${id}`, {
    method: 'PUT',
    body: JSON.stringify(lead),
  });
});

ipcMain.handle('delete-lead', async (event, id) => {
  return apiFetch(`leads/${id}`, { method: 'DELETE' });
});

ipcMain.handle('import-leads', async (event, leads) => {
  return apiFetch('leads/import', {
    method: 'POST',
    body: JSON.stringify({ leads }),
  });
});

ipcMain.handle('delete-multiple', async (event, ids) => {
  return apiFetch('leads', {
    method: 'DELETE',
    body: JSON.stringify({ ids }),
  });
});

// ==================== SPREADSHEET ====================
ipcMain.handle('import-spreadsheet', async (event, payload) => {
  return apiFetch('leads/import-spreadsheet', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
});

ipcMain.handle('import-google-maps', async (event, payload) => {
  return apiFetch('leads/import-google-maps', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
});

ipcMain.handle('check-duplicates', async (event, payload) => {
  return apiFetch('leads/check-duplicates', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
});

// ==================== INTERACTIONS ====================
ipcMain.handle('get-interactions', async (event, leadId) => {
  return apiFetch(`interactions/${leadId}`);
});

ipcMain.handle('create-interaction', async (event, interaction) => {
  return apiFetch(`interactions/${interaction.leadId}`, {
    method: 'POST',
    body: JSON.stringify(interaction),
  });
});

// ==================== DASHBOARD ====================
ipcMain.handle('get-stats', async () => {
  return apiFetch('leads/stats');
});

// ==================== SISTEMA ====================
ipcMain.handle('get-version', async () => {
  const version = require('../package.json').version;
  return { version };
});

ipcMain.handle('get-db-path', async () => {
  const dbPath = path.join(__dirname, '../backend/dev.db');
  return { path: dbPath, exists: fs.existsSync(dbPath) };
});
