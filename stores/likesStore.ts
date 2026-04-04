import { create } from 'zustand';

type LikesState = {
  likedIds: Record<string, true>;
  countsByListingId: Record<string, number>;
  setLikedIds: (ids: string[]) => void;
  setCounts: (countsById: Record<string, number>) => void;
  clear: () => void;
  likeOptimistic: (listingId: string) => { prevLiked: boolean; prevCount: number };
  unlikeOptimistic: (listingId: string) => { prevLiked: boolean; prevCount: number };
  rollback: (listingId: string, prevLiked: boolean, prevCount: number) => void;
};

export const useLikesStore = create<LikesState>((set, get) => ({
  likedIds: {},
  countsByListingId: {},

  setLikedIds: (ids) =>
    set(() => ({
      likedIds: ids.reduce<Record<string, true>>((acc, id) => {
        acc[id] = true;
        return acc;
      }, {})
    })),

  setCounts: (countsById) =>
    set((state) => ({
      countsByListingId: { ...state.countsByListingId, ...countsById }
    })),

  clear: () => set({ likedIds: {}, countsByListingId: {} }),

  likeOptimistic: (listingId) => {
    const state = get();
    const prevLiked = !!state.likedIds[listingId];
    const prevCount = state.countsByListingId[listingId] ?? 0;
    const nextCount = prevCount + (prevLiked ? 0 : 1);

    set((s) => ({
      likedIds: { ...s.likedIds, [listingId]: true },
      countsByListingId: { ...s.countsByListingId, [listingId]: nextCount }
    }));

    return { prevLiked, prevCount };
  },

  unlikeOptimistic: (listingId) => {
    const state = get();
    const prevLiked = !!state.likedIds[listingId];
    const prevCount = state.countsByListingId[listingId] ?? 0;
    const nextCount = Math.max(0, prevCount - (prevLiked ? 1 : 0));

    set((s) => {
      const next = { ...s.likedIds };
      delete next[listingId];
      return {
        likedIds: next,
        countsByListingId: { ...s.countsByListingId, [listingId]: nextCount }
      };
    });

    return { prevLiked, prevCount };
  },

  rollback: (listingId, prevLiked, prevCount) => {
    set((s) => {
      const nextLikedIds = { ...s.likedIds };
      if (prevLiked) nextLikedIds[listingId] = true;
      else delete nextLikedIds[listingId];

      return {
        likedIds: nextLikedIds,
        countsByListingId: { ...s.countsByListingId, [listingId]: prevCount }
      };
    });
  }
}));

