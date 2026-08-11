import { createContext, useCallback, useEffect, useState } from 'react';
import * as authService from '@/services/authService';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const session = authService.getStoredSession();
    if (session?.user) setUser(session.user);
    setIsInitializing(false);
  }, []);

  const login = useCallback(async (credentials) => {
    const session = await authService.login(credentials);
    setUser(session.user);
    return session;
  }, []);

  const register = useCallback(async (details) => {
    const session = await authService.register(details);
    setUser(session.user);
    return session;
  }, []);

  const logout = useCallback(() => {
    authService.clearSession();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user), isInitializing, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
