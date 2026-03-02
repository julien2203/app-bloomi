import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ensureProfileExists } from '../lib/profile';

type AuthState = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  initialized: boolean;
  setAuthFromSession: (session: Session | null) => void;
  restoreSession: () => Promise<void>;
  signOut: () => Promise<void>;
  setMockSession: () => void; // Pour le développement - à supprimer plus tard
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  initialized: false,

  setAuthFromSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      isLoading: false,
      initialized: true
    }),

  restoreSession: async () => {
    set({ isLoading: true });
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      set({
        session: null,
        user: null,
        isLoading: false,
        initialized: true
      });
      return;
    }

    if (data.session) {
      await ensureProfileExists(data.session);
    }

    set({
      session: data.session,
      user: data.session?.user ?? null,
      isLoading: false,
      initialized: true
    });
  },

  signOut: async () => {
    set({ isLoading: true });
    await supabase.auth.signOut();
    set({
      session: null,
      user: null,
      isLoading: false
    });
  },

  // TEMPORAIRE: Crée une session mock pour le développement
  // À supprimer quand l'auth sera fonctionnelle
  setMockSession: () => {
    const mockUser = {
      id: 'mock-user-id',
      email: null,
      phone: '+41791234567',
      aud: 'authenticated',
      role: 'authenticated',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: {},
      identities: []
    } as User;

    const mockSession = {
      access_token: 'mock-token',
      refresh_token: 'mock-refresh',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: mockUser
    } as Session;

    set({
      session: mockSession,
      user: mockUser,
      isLoading: false,
      initialized: true
    });
  }
}));

