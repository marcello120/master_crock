import { create } from 'zustand';
import { CombatStat } from '@/types/game';

interface UIState {
  // Index into the player's hand, so duplicate copies of the same crok are
  // selected independently.
  selectedHandIndex: number | null;
  selectedStat: CombatStat | null;
  animationPhase: 'idle' | 'playing' | 'done';
  setSelectedHandIndex: (index: number | null) => void;
  setSelectedStat: (stat: CombatStat | null) => void;
  setAnimationPhase: (phase: 'idle' | 'playing' | 'done') => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedHandIndex: null,
  selectedStat: null,
  animationPhase: 'idle',
  setSelectedHandIndex: (index) => set({ selectedHandIndex: index }),
  setSelectedStat: (stat) => set({ selectedStat: stat }),
  setAnimationPhase: (phase) => set({ animationPhase: phase }),
}));
