import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchUserDetail, login as loginRequest } from '../api.js';

const STORAGE_KEY = 'parras-car-auth';
// ponytail: polling, no push channel from users-service; baja si se agrega WS/SSE de sesión.
const SESSION_CHECK_INTERVAL_MS = 15000;

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
      permissions: data.permissions ?? [],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setAuth(session);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  }, []);

  const hasRole = useCallback((...roles) => !!auth && roles.some((r) => auth.roles.includes(r)), [auth]);

  // admin/root siempre pasan (mismo fallback que el backend: sus filas de
  // role_permissions pueden estar vacías si el catálogo se agregó después).
  const hasPermission = useCallback(
    (...permissions) =>
      !!auth && (hasRole('admin', 'root') || permissions.some((p) => auth.permissions.includes(p))),
    [auth, hasRole],
  );

  // Token rechazado (expirado o usuario desactivado): salir en el acto, no
  // esperar a que el usuario recargue la página para ver "Usuario inactivo".
  useEffect(() => {
    window.addEventListener('auth:unauthorized', logout);
    return () => window.removeEventListener('auth:unauthorized', logout);
  }, [logout]);

  // Si un admin desactiva a este usuario mientras ya tiene sesión abierta,
  // no hay forma de que el backend le avise (no hay WS/SSE de sesión) — sin
  // este ping, seguiría navegando con datos en caché hasta que hiciera otra
  // acción que golpee la API. Este chequeo periódico fuerza esa detección.
  useEffect(() => {
    if (!auth) return undefined;
    const id = setInterval(() => {
      fetchUserDetail(auth.userId, auth.token).catch(() => {});
    }, SESSION_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [auth]);

  const value = useMemo(
    () => ({
      isAuthenticated: !!auth,
      token: auth?.token ?? null,
      userId: auth?.userId ?? null,
      username: auth?.username ?? null,
      roles: auth?.roles ?? [],
      permissions: auth?.permissions ?? [],
      login,
      logout,
      hasRole,
      hasPermission,
    }),
    [auth, login, logout, hasRole, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
};
