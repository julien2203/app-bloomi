import { create } from 'zustand';

type GuestAuthModalState = {
  visible: boolean;
  open: () => void;
  close: () => void;
};

export const useGuestAuthModalStore = create<GuestAuthModalState>((set) => ({
  visible: false,
  open: () => set({ visible: true }),
  close: () => set({ visible: false })
}));
