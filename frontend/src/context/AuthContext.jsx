import { createContext, useContext, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('crm_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('crm_token'));

  async function register(nome, email, password) {
    const response = await api.post('/auth/register', { nome, email, senha: password });
    const { token: newToken, user: newUser } = response.data;
    localStorage.setItem('crm_token', newToken);
    localStorage.setItem('crm_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    if (window.electronAPI) {
      window.electronAPI.invoke('set-auth-token', newToken).catch(() => {});
    }
    return response.data;
  }

  async function login(email, password) {
    const response = await api.post('/auth/login', { email, senha: password });
    const { token: newToken, user: newUser } = response.data;
    localStorage.setItem('crm_token', newToken);
    localStorage.setItem('crm_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    // Sincronizar token com processo principal do Electron
    if (window.electronAPI) {
      window.electronAPI.invoke('set-auth-token', newToken).catch(() => {});
    }
    return response.data;
  }

  function logout() {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    setToken(null);
    setUser(null);
    // Limpar token no processo principal do Electron
    if (window.electronAPI) {
      window.electronAPI.invoke('set-auth-token', null).catch(() => {});
    }
  }

  const isAuthenticated = Boolean(token);

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
