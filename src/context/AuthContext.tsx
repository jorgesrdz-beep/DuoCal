'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Profile, Household, Goal } from '@/types/database';

interface PartnerInfo {
  id: string;
  username: string;
  display_name: string;
  current_weight_kg: number | null;
  share_photos_with_partner: boolean;
}

interface AuthContextType {
  user: Profile | null;
  household: Household | null;
  partner: PartnerInfo | null;
  activeGoal: Goal | null;
  partnerGoal: Goal | null;
  loading: boolean;
  login: (username: string, pin: string) => Promise<{ success: boolean; error?: string; locked?: boolean }>;
  register: (data: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [partnerGoal, setPartnerGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setUser(data.user);
          setHousehold(data.household);
          setPartner(data.partner);
          setActiveGoal(data.goal);
          setPartnerGoal(data.partnerGoal || null);
          return;
        }
      }
      setUser(null);
      setHousehold(null);
      setPartner(null);
      setActiveGoal(null);
      setPartnerGoal(null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (username: string, pin: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Error al iniciar sesión',
          locked: data.locked,
        };
      }
      await refreshSession();
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error de red';
      return { success: false, error: message };
    }
  };

  const register = async (formData: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Error al registrar' };
      }
      await refreshSession();
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error de red';
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setHousehold(null);
    setPartner(null);
    setActiveGoal(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        household,
        partner,
        activeGoal,
        partnerGoal,
        loading,
        login,
        register,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
