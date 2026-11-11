/**
 * ============================================================
 * FILE PURPOSE:
 *   Authentication Context Provider for PeerLink.
 *   Manages current authenticated user, login, register, logout,
 *   profile updating, and token persistence in localStorage.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend — React Context State Management
 * ============================================================
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/httpClient';
import type { User } from '../types/peerlink';
import { disconnectSocket } from '../services/socketService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  guestPairPin: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  register: (email: string, handle: string, password: string) => Promise<void>;
  loginGuest: () => Promise<void>;
  logout: () => void;
  updateProfile: (patch: { handle?: string; allowLanHost?: boolean }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('peerlink_token'));
  const [guestPairPin, setGuestPairPin] = useState<string | null>(() => localStorage.getItem('peerlink_guest_pin'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize and verify session from token on mount
  useEffect(() => {
    async function initAuth() {
      const storedToken = localStorage.getItem('peerlink_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await api.get<User>('/api/auth/me');
        setUser(profile);
      } catch (err) {
        console.warn('[Auth] Token invalid or expired. Logging out.');
        localStorage.removeItem('peerlink_token');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/api/auth/login', {
      identifier,
      password,
    });
    localStorage.setItem('peerlink_token', res.token);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (email: string, handle: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/api/auth/register', {
      email,
      handle,
      password,
    });
    localStorage.setItem('peerlink_token', res.token);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const loginGuest = useCallback(async () => {
    const res = await api.post<{
      token: string;
      user: User;
      pairPin?: { pin: string; expiresAt: string };
    }>('/api/auth/guest', {});
    localStorage.setItem('peerlink_token', res.token);
    setToken(res.token);
    setUser(res.user);
    if (res.pairPin?.pin) {
      localStorage.setItem('peerlink_guest_pin', res.pairPin.pin);
      setGuestPairPin(res.pairPin.pin);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('peerlink_token');
    localStorage.removeItem('peerlink_guest_pin');
    disconnectSocket();
    setToken(null);
    setUser(null);
    setGuestPairPin(null);
  }, []);

  const updateProfile = useCallback(async (patch: { handle?: string; allowLanHost?: boolean }) => {
    const updated = await api.patch<User>('/api/auth/me', patch);
    setUser(updated);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        guestPairPin,
        login,
        register,
        loginGuest,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
