import { createContext, useContext, useCallback, useEffect, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError } from '../lib/api';

export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role_title: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  team_member: TeamMember | null;
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

interface LoginParams {
  email: string;
  password: string;
}

interface RegisterParams {
  email: string;
  password: string;
  full_name: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (params: LoginParams) => Promise<void>;
  register: (params: RegisterParams) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function persistTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
}

function clearTokens(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleAuthResponse = useCallback((data: AuthResponse) => {
    setUser(data.user);
    setAccessToken(data.access_token);
    setRefreshToken(data.refresh_token);
    persistTokens(data.access_token, data.refresh_token);
    localStorage.setItem('user', JSON.stringify(data.user));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    clearTokens();
  }, []);

  const refreshAccessToken = useCallback(async () => {
    const storedRefresh = localStorage.getItem('refresh_token');
    if (!storedRefresh) {
      logout();
      return;
    }

    try {
      const data = await api.post<RefreshResponse>('/api/auth/refresh', {
        refresh_token: storedRefresh,
      });
      setAccessToken(data.access_token);
      setRefreshToken(data.refresh_token);
      persistTokens(data.access_token, data.refresh_token);
    } catch {
      logout();
    }
  }, [logout]);

  const login = useCallback(
    async (params: LoginParams) => {
      const data = await api.post<AuthResponse>('/api/auth/login', params);
      handleAuthResponse(data);
    },
    [handleAuthResponse],
  );

  const register = useCallback(
    async (params: RegisterParams) => {
      const data = await api.post<AuthResponse>('/api/auth/register', params);
      handleAuthResponse(data);
    },
    [handleAuthResponse],
  );

  // Auto-restore session on mount
  useEffect(() => {
    const storedAccessToken = localStorage.getItem('access_token');
    const storedRefreshToken = localStorage.getItem('refresh_token');
    const storedUser = localStorage.getItem('user');

    if (storedAccessToken && storedRefreshToken && storedUser) {
      try {
        setUser(JSON.parse(storedUser) as AuthUser);
        setAccessToken(storedAccessToken);
        setRefreshToken(storedRefreshToken);
      } catch {
        clearTokens();
      }
    }

    setIsLoading(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: !!user && !!accessToken,
      isLoading,
      login,
      register,
      logout,
      refreshAccessToken,
    }),
    [user, accessToken, refreshToken, isLoading, login, register, logout, refreshAccessToken],
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
