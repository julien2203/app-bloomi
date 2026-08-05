import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { ensureProfileExists } from '../lib/profile';
import { applyPendingSellerProfile } from '../lib/pendingSellerProfile';
import { useNotificationsBadgeStore } from './notificationsBadgeStore';
import { useUnreadMessagesStore } from './unreadMessagesStore';
import { authDebug, authDebugError } from '../lib/authDebugLog';
import { invalidateBlockedSellerIdsCache } from '../lib/blockedSellerIdsCache';

export const GUEST_BROWSE_STORAGE_KEY = 'bloomi_guest_browse_v1';

type AuthState = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  initialized: boolean;
  /** Parcours sans compte (persisté avec GUEST_BROWSE_STORAGE_KEY tant qu’aucune session). */
  isGuest: boolean;
  setAuthFromSession: (session: Session | null) => void;
  restoreSession: () => Promise<void>;
  signOut: () => Promise<void>;
  enterGuestMode: () => Promise<void>;
  setMockSession: () => void; // Pour le développement - à supprimer plus tard
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  initialized: false,
  isGuest: false,

  setAuthFromSession: (session) => {
    authDebug('store:setAuthFromSession', {
      hasSession: Boolean(session),
      userId: session?.user?.id ?? null,
      hasPhone: Boolean(session?.user?.phone)
    });
    if (!session?.user) {
      useNotificationsBadgeStore.getState().setUnreadCount(0);
      useUnreadMessagesStore.getState().setUnreadThreadsCount(0);
    }
    set((prev) => ({
      ...prev,
      session,
      user: session?.user ?? null,
      isLoading: false,
      initialized: true,
      ...(session?.user ? { isGuest: false } : {})
    }));
    if (session?.user) {
      void AsyncStorage.removeItem(GUEST_BROWSE_STORAGE_KEY);
    }
  },

  restoreSession: async () => {
    authDebug('store:restoreSession:start');
    set({ isLoading: true });
    const guestRaw = await AsyncStorage.getItem(GUEST_BROWSE_STORAGE_KEY);
    const session = await restoreAuthSession('coldStart');

    if (session) {
      authDebug('store:restoreSession:existingSession', {
        userId: session.user.id,
        hasPhone: Boolean(session.user.phone)
      });
      await AsyncStorage.removeItem(GUEST_BROWSE_STORAGE_KEY);
    } else {
      authDebug('store:restoreSession:noSession', { isGuest: guestRaw === 'true' });
    }

    set({
      session,
      user: session?.user ?? null,
      isGuest: session?.user ? false : guestRaw === 'true',
      isLoading: false,
      initialized: true
    });
    authDebug('store:restoreSession:done', {
      hasSession: Boolean(session),
      isGuest: session?.user ? false : guestRaw === 'true'
    });

    if (session?.user) {
      void (async () => {
        try {
          await ensureProfileExists(session);
          await applyPendingSellerProfile(session.user.id, {
            email: session.user.email ?? null
          });
        } catch (e) {
          authDebugError('store:restoreSession:profileBackground', e);
        }
      })();
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    await supabase.auth.signOut();
    invalidateBlockedSellerIdsCache();
    useNotificationsBadgeStore.getState().setUnreadCount(0);
    useUnreadMessagesStore.getState().setUnreadThreadsCount(0);
    await AsyncStorage.setItem(GUEST_BROWSE_STORAGE_KEY, 'true');
    set({
      session: null,
      user: null,
      isLoading: false,
      isGuest: true
    });
  },

  enterGuestMode: async () => {
    authDebug('guest:enter:start');
    await AsyncStorage.setItem(GUEST_BROWSE_STORAGE_KEY, 'true');
    set({ isGuest: true });
    authDebug('guest:enter:done');
  },

  // TEMPORAIRE: Crée une session mock pour le développement
  // À supprimer quand l'auth sera fonctionnelle
  setMockSession: () => {
    const mockUser = {
      // Utiliser un UUID valide pour éviter l'erreur "invalid input syntax for type uuid"
      // À adapter avec un véritable user.id Supabase si vous avez un utilisateur de test
      id: '00000000-0000-0000-0000-000000000000',
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
      initialized: true,
      isGuest: false
    });
  }
}));

