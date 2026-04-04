import { createContext, useContext, useState, useEffect } from 'react';
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
  const [license, setLicense] = useState(() => {
    try {
      const stored = localStorage.getItem('crm_license');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  // Carregar informações de licença quando token for carregado
  useEffect(() => {
    if (token && !license) {
      loadLicense();
    }
  }, [token]);

  async function loadLicense() {
    try {
      const response = await api.get('/license/current');
      if (response.data.success) {
        const licenseData = response.data.license;
        localStorage.setItem('crm_license', JSON.stringify(licenseData));
        setLicense(licenseData);
      }
    } catch (error) {
      console.warn('Não foi possível carregar informações de licença:', error.message);
      // Manter com dados do token se disponível
    }
  }

  async function register(nome, email, password) {
    setLoading(true);
    try {
      const response = await api.post('/auth/register', { nome, email, senha: password });
      const { token: newToken, user: newUser } = response.data;
      localStorage.setItem('crm_token', newToken);
      localStorage.setItem('crm_user', JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
      
      // Carregar licença após registro
      const licResponse = await api.get('/license/current', {
        headers: { Authorization: `Bearer ${newToken}` }
      });
      if (licResponse.data.success) {
        const licenseData = licResponse.data.license;
        localStorage.setItem('crm_license', JSON.stringify(licenseData));
        setLicense(licenseData);
      }

      if (window.electronAPI) {
        window.electronAPI.invoke('set-auth-token', newToken).catch(() => {});
      }
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

      // Carregar licença após login
      const licResponse = await api.get('/license/current', {
        headers: { Authorization: `Bearer ${newToken}` }
      });
      if (licResponse.data.success) {
        const licenseData = licResponse.data.license;
        localStorage.setItem('crm_license', JSON.stringify(licenseData));
        setLicense(licenseData);
      }

      // Sincronizar token com processo principal do Electron
      if (window.electronAPI) {
        window.electronAPI.invoke('set-auth-token', newToken).catch(() => {});
      }
      return response.data;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    localStorage.removeItem('crm_license');
    setToken(null);
    setUser(null);
    setLicense(null);
    // Limpar token no processo principal do Electron
    if (window.electronAPI) {
      window.electronAPI.invoke('set-auth-token', null).catch(() => {});
    }
  }

  /**
   * Verificar se usuário pode acessar uma feature
   */
  function canUseFeature(featureName) {
    if (!license) return false;
    return Array.isArray(license.features) && license.features.includes(featureName);
  }

  const isAuthenticated = Boolean(token);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      license,
      login,
      register,
      logout,
      isAuthenticated,
      loading,
      canUseFeature,
      loadLicense
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
