const { ipcMain } = require('electron');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const API_BASE_URL = 'http://localhost:3001/api';

// Headers padrão com suporte a autenticação
let headers = {
  'Content-Type': 'application/json',
};

// Sincronizar token de autenticação do renderer
ipcMain.handle('set-auth-token', async (event, token) => {
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('[IPC] Token sincronizado do renderer');
  } else {
    delete headers['Authorization'];
  }
  return { success: true };
});

// ==================== AUTH ====================
ipcMain.handle('user-login', async (event, { email, password }) => {
  try {
    console.log(`[IPC] Login: ${email}`);
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, senha: password }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Credenciais inválidas');
    }
    // Salvar token se sucesso
    if (data.token) {
      headers['Authorization'] = `Bearer ${data.token}`;
    }
    return data;
  } catch (error) {
    console.error('[IPC] Erro ao fazer login:', error.message);
    throw error;
  }
});

ipcMain.handle('user-logout', async (event) => {
  try {
    console.log('[IPC] Logout');
    delete headers['Authorization'];
    return { success: true };
  } catch (error) {
    console.error('[IPC] Erro ao fazer logout:', error);
    return { error: error.message };
  }
});

ipcMain.handle('auth-register', async (event, userData) => {
  try {
    console.log(`[IPC] Registrando usuário: ${userData.email}`);
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers,
      body: JSON.stringify(userData),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Erro ao registrar');
    }
    if (data.token) {
      headers['Authorization'] = `Bearer ${data.token}`;
    }
    return data;
  } catch (error) {
    console.error('[IPC] Erro ao registrar:', error.message);
    throw error;
  }
});

// ==================== SCRAPER ====================
ipcMain.handle('search-leads', async (event, term) => {
  try {
    console.log(`[IPC] Buscando leads: ${term}`);
    const response = await fetch(`${API_BASE_URL}/scraper/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ searchTerm: term }),
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[IPC] Erro ao buscar leads:', error);
    return { success: false, error: error.message, data: [] };
  }
});

ipcMain.handle('scrape-url', async (event, url) => {
  try {
    console.log(`[IPC] Scrapeando URL: ${url}`);
    const response = await fetch(`${API_BASE_URL}/scraper/google-maps`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[IPC] Erro ao scraper URL:', error);
    return { success: false, error: error.message };
  }
});

// ==================== LEADS ====================
ipcMain.handle('get-leads', async (event, filters = {}) => {
  try {
    console.log('[IPC] Buscando leads com filtros:', filters);
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE_URL}/leads?${params}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[IPC] Erro ao buscar leads:', error);
    return { error: error.message, data: [] };
  }
});

ipcMain.handle('get-lead', async (event, id) => {
  try {
    console.log(`[IPC] Buscando lead: ${id}`);
    const response = await fetch(`${API_BASE_URL}/leads/${id}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[IPC] Erro ao buscar lead:', error);
    return { error: error.message };
  }
});

ipcMain.handle('create-lead', async (event, lead) => {
  try {
    console.log('[IPC] Criando lead:', lead.nome);
    const response = await fetch(`${API_BASE_URL}/leads`, {
      method: 'POST',
      headers,
      body: JSON.stringify(lead),
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[IPC] Erro ao criar lead:', error);
    return { error: error.message };
  }
});

ipcMain.handle('update-lead', async (event, { id, lead }) => {
  try {
    console.log(`[IPC] Atualizando lead: ${id}`);
    const response = await fetch(`${API_BASE_URL}/leads/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(lead),
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[IPC] Erro ao atualizar lead:', error);
    return { error: error.message };
  }
});

ipcMain.handle('delete-lead', async (event, id) => {
  try {
    console.log(`[IPC] Deletando lead: ${id}`);
    const response = await fetch(`${API_BASE_URL}/leads/${id}`, {
      method: 'DELETE',
      headers,
    });
    return response.ok;
  } catch (error) {
    console.error('[IPC] Erro ao deletar lead:', error);
    return false;
  }
});

ipcMain.handle('import-leads', async (event, leads) => {
  try {
    console.log(`[IPC] Importando ${leads.length} leads`);
    const response = await fetch(`${API_BASE_URL}/leads/import`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ leads }),
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[IPC] Erro ao importar leads:', error);
    return { error: error.message };
  }
});

ipcMain.handle('delete-multiple', async (event, ids) => {
  try {
    console.log(`[IPC] Deletando ${ids.length} leads`);
    const response = await fetch(`${API_BASE_URL}/leads`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[IPC] Erro ao deletar múltiplos leads:', error);
    return { error: error.message };
  }
});

// ==================== INTERACTIONS ====================
ipcMain.handle('get-interactions', async (event, leadId) => {
  try {
    console.log(`[IPC] Buscando interações do lead: ${leadId}`);
    const response = await fetch(`${API_BASE_URL}/interactions/${leadId}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[IPC] Erro ao buscar interações:', error);
    return { error: error.message, data: [] };
  }
});

ipcMain.handle('create-interaction', async (event, interaction) => {
  try {
    console.log(`[IPC] Criando interação para lead: ${interaction.leadId}`);
    const response = await fetch(`${API_BASE_URL}/interactions/${interaction.leadId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(interaction),
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[IPC] Erro ao criar interação:', error);
    return { error: error.message };
  }
});

// ==================== DASHBOARD ====================
ipcMain.handle('get-stats', async (event) => {
  try {
    console.log('[IPC] Buscando estatísticas');
    const response = await fetch(`${API_BASE_URL}/leads/stats`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[IPC] Erro ao buscar stats:', error);
    return { error: error.message };
  }
});

// ==================== SISTEMA ====================
ipcMain.handle('get-version', async (event) => {
  const version = require('../package.json').version;
  return { version };
});

ipcMain.handle('get-db-path', async (event) => {
  const dbPath = path.join(__dirname, '../backend/dev.db');
  return { path: dbPath, exists: fs.existsSync(dbPath) };
});

