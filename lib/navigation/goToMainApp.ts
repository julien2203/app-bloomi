import { supabase } from '../supabase';
import { ensureProfileExists } from '../profile';
import { useAuthStore } from '../../stores/authStore';
import { navigateInTabs } from './navigateInTabs';

/**
 * Fin d'onboarding auth : session à jour + navigation vers l'onglet Feed avec la pile tabs montée.
 */
export async function goToMainApp(options?: { phone?: string }) {
  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (error) {
    console.warn('goToMainApp refreshSession:', error.message);
  }

  let session = refreshed.session;
  if (!session) {
    const { data: current } = await supabase.auth.getSession();
    session = current.session;
  }

  if (session) {
    useAuthStore.getState().setAuthFromSession(session);
    await ensureProfileExists(
      session,
      options?.phone ? { phone: options.phone } : undefined
    );
  }

  navigateInTabs('/tabs/feed');
}
