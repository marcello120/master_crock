'use client';

import { use, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useGameSync } from '@/hooks/useGameSync';
import { useGameStore } from '@/stores/gameStore';
import { usePlayerStore } from '@/stores/playerStore';
import GameBoard from '@/components/game/GameBoard';
import { useRouter } from 'next/navigation';
import { registerUserGame, unregisterUserGame } from '@/lib/gameActions';

export default function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const game = useGameStore((s) => s.game);
  const gameLoaded = useGameStore((s) => s.loaded);
  const privateData = usePlayerStore((s) => s.privateData);

  useGameSync(gameId);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [loading, user, router]);

  // Keep the user's ongoing-games index in sync with this game.
  useEffect(() => {
    if (!user || !game) return;
    if (game.phase === 'GAME_OVER') {
      unregisterUserGame(user.uid, game.id);
      return;
    }
    const opponents = game.playerOrder
      .filter((uid) => uid !== user.uid)
      .map((uid) => game.players[uid]?.name || 'Player')
      .join(', ');
    const label = opponents ? `vs ${opponents}` : 'Game';
    registerUserGame(user.uid, game.id, label, game.hostId === user.uid);
  }, [user, game]);

  // Game was deleted (e.g. by another player): clean up our stale index entry
  // and return to the lobby.
  useEffect(() => {
    if (!user || !gameLoaded || game) return;
    unregisterUserGame(user.uid, gameId);
    router.push('/lobby');
  }, [user, gameLoaded, game, gameId, router]);

  if (!user) {
    return null;
  }

  if (!game || !privateData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Loading game...</p>
      </div>
    );
  }

  return <GameBoard game={game} privateData={privateData} myUid={user.uid} gameId={gameId} />;
}
