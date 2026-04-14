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
  const [loading, setLoading] = useState(false);

  async function register(nome, email, password) {
    setLoading(true);
    try {
      const response = await api.post('/auth/register', { nome, email, senha: password });
      const { token: newToken, user: newUser } = response.data;
      localStorage.setItem('crm_token', newToken);
      localStorage.setItem('crm_user', JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
      return response.data;
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, senha: password });
      const { token: newToken, user: newUser } = response.data;
      localStorage.setItem('crm_token', newToken);
      localStorage.setItem('crm_user', JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
      return response.data;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    setToken(null);
    setUser(null);
  }

  const isAuthenticated = Boolean(token);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      register,
      logout,
      isAuthenticated,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
