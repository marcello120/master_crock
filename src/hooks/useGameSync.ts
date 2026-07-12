'use client';

import { useEffect } from 'react';
import { subscribeToGame, unsubscribeFromGame } from '@/lib/gameSync';
import { useAuthStore } from '@/stores/authStore';

export function useGameSync(gameId: string | null) {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!gameId || !user) return;

    subscribeToGame(gameId, user.uid);

    return () => {
      unsubscribeFromGame();
    };
  }, [gameId, user]);
}
