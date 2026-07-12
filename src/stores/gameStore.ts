import { create } from 'zustand';
import { GamePublic } from '@/types/game';

interface GameState {
  game: GamePublic | null;
  loaded: boolean;
  setGame: (game: GamePublic | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  game: null,
  loaded: false,
  setGame: (game) => set({ game, loaded: true }),
}));
