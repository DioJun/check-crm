const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Comunicação básica com IPC
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, callback) => ipcRenderer.on(channel, (event, ...args) => callback(...args)),
  removeListener: (channel) => ipcRenderer.removeListener(channel),
  
  // APIs de Scraper
  searchLeads: (term) => ipcRenderer.invoke('search-leads', term),
  scrapeUrl: (url) => ipcRenderer.invoke('scrape-url', url),
  
  // APIs de Lead
  getLeads: (filters) => ipcRenderer.invoke('get-leads', filters),
  getLead: (id) => ipcRenderer.invoke('get-lead', id),
  createLead: (lead) => ipcRenderer.invoke('create-lead', lead),
  updateLead: (id, lead) => ipcRenderer.invoke('update-lead', { id, lead }),
  deleteLead: (id) => ipcRenderer.invoke('delete-lead', id),
  importLeads: (leads) => ipcRenderer.invoke('import-leads', leads),
  deleteMultiple: (ids) => ipcRenderer.invoke('delete-multiple', ids),
  
  // APIs de Spreadsheet
  importSpreadsheet: (payload) => ipcRenderer.invoke('import-spreadsheet', payload),
  importGoogleMaps: (payload) => ipcRenderer.invoke('import-google-maps', payload),
  checkDuplicates: (payload) => ipcRenderer.invoke('check-duplicates', payload),
  
  // APIs de Dashboard
  getStats: () => ipcRenderer.invoke('get-stats'),
  
  // APIs de Auth
  login: (email, password) => ipcRenderer.invoke('user-login', { email, password }),
  logout: () => ipcRenderer.invoke('user-logout'),
  
  // Sistema
  getVersion: () => ipcRenderer.invoke('get-version'),
  getDatabasePath: () => ipcRenderer.invoke('get-db-path'),
});
