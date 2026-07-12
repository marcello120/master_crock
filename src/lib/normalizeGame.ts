import { GamePublic, PlayerPrivate, PlayerPublic } from '@/types/game';

// Firebase RTDB omits empty arrays/objects, so collection fields come back as
// undefined. These helpers backfill defaults so every consumer can rely on the
// collection fields existing, whether the data arrives via a listener or a
// one-off get().

export function normalizeGame(data: GamePublic | null): GamePublic | null {
  if (!data) return null;

  const players: Record<string, PlayerPublic> = {};
  for (const [uid, p] of Object.entries(data.players ?? {})) {
    players[uid] = {
      ...p,
      winners: p.winners ?? [],
      losers: p.losers ?? [],
      factionVictories: p.factionVictories ?? [],
    };
  }

  return {
    ...data,
    playerOrder: data.playerOrder ?? [],
    players,
    battle: {
      ...data.battle,
      revealedCards: data.battle?.revealedCards ?? {},
      playersCommitted: data.battle?.playersCommitted ?? [],
      blindBattleCards: data.battle?.blindBattleCards ?? {},
      tiedPlayerIds: data.battle?.tiedPlayerIds ?? [],
      frozenPot: data.battle?.frozenPot ?? [],
    },
  };
}

export function normalizePrivate(data: PlayerPrivate | null): PlayerPrivate | null {
  if (!data) return null;
  return {
    ...data,
    hand: data.hand ?? [],
    deck: data.deck ?? [],
    selectedCard: data.selectedCard ?? null,
  };
}
