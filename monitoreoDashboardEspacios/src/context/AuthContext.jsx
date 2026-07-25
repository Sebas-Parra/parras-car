import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { login as loginRequest } from '../api.js';

const STORAGE_KEY = 'parras-car-auth';

const AuthContext = createContext(null);

const readStoredAuth = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(readStoredAuth);

  const login = useCallback(async (username, password) => {
    const data = await loginRequest(username, password);
    const session = {
      token: data.access_token,
      userId: data.user_id,
      username: data.username,
      roles: data.roles ?? [],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setAuth(session);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  }, []);

  const hasRole = useCallback((...roles) => !!auth && roles.some((r) => auth.roles.includes(r)), [auth]);

  const value = useMemo(
    () => ({
      isAuthenticated: !!auth,
      token: auth?.token ?? null,
      userId: auth?.userId ?? null,
      username: auth?.username ?? null,
      roles: auth?.roles ?? [],
      login,
      logout,
      hasRole,
    }),
    [auth, login, logout, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
};
