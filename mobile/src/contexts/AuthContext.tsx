import React, { createContext, useContext, useCallback, useEffect, useState, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, ApiError, setOnUnauthorized } from '../lib/api';

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
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (params: LoginParams) => Promise<void>;
  register: (params: RegisterParams) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function persistTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync('access_token', accessToken);
  await SecureStore.setItemAsync('refresh_token', refreshToken);
}

async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync('access_token');
  await SecureStore.deleteItemAsync('refresh_token');
  await SecureStore.deleteItemAsync('user');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleAuthResponse = useCallback(async (data: AuthResponse) => {
    setUser(data.user);
    await persistTokens(data.access_token, data.refresh_token);
    await SecureStore.setItemAsync('user', JSON.stringify(data.user));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    void clearTokens();
  }, []);

  // Register the 401 handler so api.ts can trigger logout
  useEffect(() => {
    setOnUnauthorized(logout);
  }, [logout]);

  const login = useCallback(
    async (params: LoginParams) => {
      const data = await api.post<AuthResponse>('/api/auth/login', params);
      await handleAuthResponse(data);
    },
    [handleAuthResponse],
  );

  const register = useCallback(
    async (params: RegisterParams) => {
      const data = await api.post<AuthResponse>('/api/auth/register', params);
      await handleAuthResponse(data);
    },
    [handleAuthResponse],
  );

  // Auto-restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const storedAccessToken = await SecureStore.getItemAsync('access_token');
        const storedRefreshToken = await SecureStore.getItemAsync('refresh_token');
        const storedUser = await SecureStore.getItemAsync('user');

        if (storedAccessToken && storedRefreshToken && storedUser) {
          setUser(JSON.parse(storedUser) as AuthUser);
        }
      } catch {
        await clearTokens();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
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
