import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchProfile, login as loginRequest, type LoginPayload, register as registerRequest, type RegisterPayload } from '../api/auth';
import { SESSION_EXPIRED_EVENT } from '../api/client';
import type { PublicUser } from '../types/domain';
import { clearStoredToken, getStoredToken, setStoredToken } from './tokenStorage';

interface AuthContextValue {
  user: PublicUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionExpired: boolean;
  login: (payload: LoginPayload) => Promise<PublicUser>;
  register: (payload: RegisterPayload) => Promise<PublicUser>;
  logout: () => void;
  dismissSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    fetchProfile()
      .then(setUser)
      .catch(() => {
        clearStoredToken();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      setSessionExpired(true);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await loginRequest(payload);
    setStoredToken(response.accessToken);
    setUser(response.user);
    setSessionExpired(false);
    return response.user;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const response = await registerRequest(payload);
    setStoredToken(response.accessToken);
    setUser(response.user);
    setSessionExpired(false);
    return response.user;
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
  }, []);

  const dismissSessionExpired = useCallback(() => setSessionExpired(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      sessionExpired,
      login,
      register,
      logout,
      dismissSessionExpired,
    }),
    [user, isLoading, sessionExpired, login, register, logout, dismissSessionExpired],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
