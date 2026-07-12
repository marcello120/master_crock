import { CardDefinition } from '@/types/card';
import { CombatStat, PlayerPublic, WinCondition } from '@/types/game';

/**
 * Get the stat value from a card based on the declared combat type.
 */
export function getStatValue(card: CardDefinition, stat: CombatStat): number {
  switch (stat) {
    case 'STRENGTH':
      return card.strength;
    case 'INTELLIGENCE':
      return card.intelligence;
    case 'REFLEX':
      return card.reflex;
  }
}

export interface BattleResult {
  winnerId: string | null; // null if tie
  tiedPlayerIds: string[]; // players involved in tie (empty if clear winner)
  highestValue: number;
}

/**
 * Resolve a battle given revealed cards and the declared stat.
 * Returns the winner or indicates a tie.
 *
 * @param revealedCards Map of playerId → CardDefinition
 * @param declaredStat The combat stat being compared
 * @param abilityModifiers Optional future hook for ability stat modifications
 */
export function resolveBattle(
  revealedCards: Map<string, CardDefinition>,
  declaredStat: CombatStat,
  abilityModifiers?: Map<string, number> // playerId → stat delta (future abilities)
): BattleResult {
  let highestValue = -1;
  const playerValues: Array<{ playerId: string; value: number }> = [];

  for (const [playerId, card] of revealedCards) {
    let value = getStatValue(card, declaredStat);

    // Apply ability modifiers if provided (future hook)
    if (abilityModifiers?.has(playerId)) {
      value += abilityModifiers.get(playerId)!;
    }

    playerValues.push({ playerId, value });
    if (value > highestValue) {
      highestValue = value;
    }
  }

  const topPlayers = playerValues.filter(p => p.value === highestValue);

  if (topPlayers.length === 1) {
    return {
      winnerId: topPlayers[0].playerId,
      tiedPlayerIds: [],
      highestValue,
    };
  }

  return {
    winnerId: null,
    tiedPlayerIds: topPlayers.map(p => p.playerId),
    highestValue,
  };
}

const WIN_TARGET = 6;

/**
 * Check whether a player has met the game's win condition.
 *
 * - DIFFERENT_TRIBES: winning cards from 6 distinct factions.
 * - SAME_TRIBE: 6 winning cards that all share a single faction.
 */
export function hasMetWinCondition(
  winnerCardIds: string[],
  winCondition: WinCondition,
  getCard: (id: string) => CardDefinition | undefined
): boolean {
  const tribeCounts = new Map<string, number>();
  for (const id of winnerCardIds) {
    const card = getCard(id);
    if (!card) continue;
    tribeCounts.set(card.tribe, (tribeCounts.get(card.tribe) ?? 0) + 1);
  }

  if (winCondition === 'SAME_TRIBE') {
    for (const count of tribeCounts.values()) {
      if (count >= WIN_TARGET) return true;
    }
    return false;
  }

  // DIFFERENT_TRIBES
  return tribeCounts.size >= WIN_TARGET;
}

/**
 * Check if the game should end due to a player being out of cards.
 * Returns true if any player has 0 cards in both hand and deck.
 */
export function checkOutOfCards(players: Record<string, PlayerPublic>): boolean {
  return Object.values(players).some(
    p => p.handCount === 0 && p.deckCount === 0
  );
}

/**
 * Determine winner when game ends by card exhaustion (most winners wins).
 */
export function getWinnerByMostWins(players: Record<string, PlayerPublic>): string | null {
  let maxWins = -1;
  let winnerId: string | null = null;

  for (const [uid, player] of Object.entries(players)) {
    if (player.winners.length > maxWins) {
      maxWins = player.winners.length;
      winnerId = uid;
    }
  }

  return winnerId;
}

/**
 * Get unique faction names from a list of card IDs.
 */
export function getUniqueFactions(
  cardIds: string[],
  getCard: (id: string) => CardDefinition | undefined
): string[] {
  const factions = new Set<string>();
  for (const id of cardIds) {
    const card = getCard(id);
    if (card) {
      factions.add(card.tribe);
    }
  }
  return [...factions];
}

/**
 * Shuffle an array in place (Fisher-Yates).
 */
export function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Get the last defender in player order (for blind battle attacker assignment).
 * The last defending player clockwise from the attacker becomes the new attacker.
 */
export function getLastDefender(playerOrder: string[], attackerId: string): string {
  const attackerIdx = playerOrder.indexOf(attackerId);
  // Last defender is the player just before the attacker in clockwise order
  // i.e., the last one to have played
  const lastIdx = (attackerIdx - 1 + playerOrder.length) % playerOrder.length;
  return playerOrder[lastIdx];
}
