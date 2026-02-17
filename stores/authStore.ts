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
  }
}));

