import { create } from 'zustand';
import { PlayerPrivate } from '@/types/game';

interface PlayerState {
  privateData: PlayerPrivate | null;
  setPrivateData: (data: PlayerPrivate | null) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  privateData: null,
  setPrivateData: (data) => set({ privateData: data }),
}));
