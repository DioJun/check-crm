import { createContext, useContext } from 'react';

/* eslint-disable react-refresh/only-export-components */
// Provider + hook no mesmo arquivo é padrão comum de contexto React.

const AuthContext = createContext(null);

const LOCAL_USER = { id: 'local', nome: 'Usuário Local', email: 'local@checkmate.app' };

export function AuthProvider({ children }) {
  const authValue = {
    user: LOCAL_USER,
    isAuthenticated: true,
    login: async () => true,
    register: async () => true,
    logout: () => {},
    loading: false,
  };

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
