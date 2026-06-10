import { useGuestAuthModalStore } from '../stores/guestAuthModalStore';
import { useAuthStore } from '../stores/authStore';

export function openGuestAuthPrompt(): void {
  useGuestAuthModalStore.getState().open();
}

export function isAuthed(): boolean {
  return Boolean(useAuthStore.getState().session?.user);
}
