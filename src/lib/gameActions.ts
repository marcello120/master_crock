import { ref, set, update, get, push } from 'firebase/database';
import { db } from './firebase';
import {
  CombatStat,
  GamePublic,
  PlayerPrivate,
  PlayerPublic,
  BattleState,
  WinCondition,
  Lobby,
} from '@/types/game';
import {
  shuffle,
  getUniqueFactions,
  resolveBattle,
  getLastDefender,
  hasMetWinCondition,
} from './gameEngine';
import { getCardById } from './cardData';
import { normalizeGame, normalizePrivate } from './normalizeGame';

// --- Lobby Actions ---

export async function createLobby(
  hostId: string,
  hostName: string,
  lobbyName: string,
  maxPlayers: number,
  winCondition: WinCondition
): Promise<string> {
  const lobbyRef = push(ref(db, 'lobbies'));
  const lobby: Omit<Lobby, 'id'> = {
    hostId,
    name: lobbyName,
    maxPlayers,
    winCondition,
    status: 'waiting',
    players: {
      [hostId]: { name: hostName, deckId: null, ready: false },
    },
    createdAt: Date.now(),
  };
  await set(lobbyRef, { ...lobby, id: lobbyRef.key });
  return lobbyRef.key!;
}

export async function joinLobby(lobbyId: string, uid: string, name: string): Promise<void> {
  await update(ref(db, `lobbies/${lobbyId}/players/${uid}`), {
    name,
    deckId: null,
    ready: false,
  });
}

export async function selectDeckInLobby(lobbyId: string, uid: string, deckId: string): Promise<void> {
  await update(ref(db, `lobbies/${lobbyId}/players/${uid}`), { deckId });
}

export async function setReady(lobbyId: string, uid: string, ready: boolean): Promise<void> {
  await update(ref(db, `lobbies/${lobbyId}/players/${uid}`), { ready });
}

export async function leaveLobby(lobbyId: string, uid: string): Promise<void> {
  await set(ref(db, `lobbies/${lobbyId}/players/${uid}`), null);
}

export async function deleteLobby(lobbyId: string): Promise<void> {
  await set(ref(db, `lobbies/${lobbyId}`), null);
}

export async function deleteGame(gameId: string, uid: string): Promise<void> {
  // Security rules only grant writes at /public and /private/{ownUid}, so we
  // null those nodes. Removing /public makes the game disappear for everyone.
  await set(ref(db, `games/${gameId}/public`), null);
  await set(ref(db, `games/${gameId}/private/${uid}`), null);
  await unregisterUserGame(uid, gameId);
}

// --- Per-user ongoing game index ---
// Each player can only write their own /users/{uid} node, so every client
// registers itself into its own index when it enters a game.

export async function registerUserGame(
  uid: string,
  gameId: string,
  label: string,
  isHost: boolean
): Promise<void> {
  await set(ref(db, `users/${uid}/games/${gameId}`), { label, isHost });
}

export async function unregisterUserGame(uid: string, gameId: string): Promise<void> {
  await set(ref(db, `users/${uid}/games/${gameId}`), null);
}

// --- Game Initialization ---

export async function initializeGame(
  lobbyId: string,
  lobby: Lobby
): Promise<string> {
  const gameRef = push(ref(db, 'games'));
  const gameId = gameRef.key!;

  const playerIds = Object.keys(lobby.players);
  const playerOrder = shuffle(playerIds);
  const firstAttacker = playerOrder[0];

  // Build public player state and private state
  const players: Record<string, PlayerPublic> = {};
  const privateStates: Record<string, PlayerPrivate> = {};

  for (let i = 0; i < playerOrder.length; i++) {
    const uid = playerOrder[i];
    const lobbyPlayer = lobby.players[uid];

    // Load deck from user profile
    const deckSnap = await get(ref(db, `users/${uid}/decks/${lobbyPlayer.deckId}`));
    const deckData = deckSnap.val() as { name: string; cardIds: string[] } | null;

    if (!deckData) {
      throw new Error(`Player ${uid} has no valid deck selected`);
    }

    const shuffledDeck = shuffle(deckData.cardIds);
    const hand = shuffledDeck.slice(0, 4);
    const deck = shuffledDeck.slice(4);

    players[uid] = {
      name: lobbyPlayer.name,
      seatIndex: i,
      handCount: hand.length,
      deckCount: deck.length,
      winners: [],
      losers: [],
      factionVictories: [],
      isConnected: true,
    };

    privateStates[uid] = {
      hand,
      deck,
      selectedCard: null,
    };
  }

  const emptyBattle: BattleState = {
    declaredStat: null,
    revealedCards: {},
    playersCommitted: [],
    isBlindBattle: false,
    blindBattleCards: {},
    tiedPlayerIds: [],
    frozenPot: [],
  };

  const gamePublic: GamePublic = {
    id: gameId,
    hostId: lobby.hostId,
    phase: 'DRAW',
    winCondition: lobby.winCondition,
    playerOrder,
    currentAttackerId: firstAttacker,
    turnNumber: 1,
    winner: null,
    battle: emptyBattle,
    players,
    createdAt: Date.now(),
  };

  // Write game state
  await set(ref(db, `games/${gameId}/public`), gamePublic);

  for (const [uid, privateState] of Object.entries(privateStates)) {
    await set(ref(db, `games/${gameId}/private/${uid}`), privateState);
  }

  // Update lobby status and broadcast the game id so every player's client can
  // navigate into the game.
  await update(ref(db, `lobbies/${lobbyId}`), { status: 'in_game', gameId });

  return gameId;
}

// --- Game Actions ---

export async function drawCard(gameId: string, uid: string): Promise<void> {
  const privateRef = ref(db, `games/${gameId}/private/${uid}`);
  const snap = await get(privateRef);
  const data = normalizePrivate(snap.val() as PlayerPrivate)!;

  if (data.deck.length === 0) return; // No cards to draw

  const drawnCard = data.deck[0];
  const newDeck = data.deck.slice(1);
  const newHand = [...data.hand, drawnCard];

  await update(privateRef, { hand: newHand, deck: newDeck });
  await update(ref(db, `games/${gameId}/public/players/${uid}`), {
    handCount: newHand.length,
    deckCount: newDeck.length,
  });
}

export async function advanceFromDraw(gameId: string, playerOrder: string[]): Promise<void> {
  // Draw a card for each player, then move to ATTACK
  for (const uid of playerOrder) {
    await drawCard(gameId, uid);
  }
  await update(ref(db, `games/${gameId}/public`), { phase: 'ATTACK' });
}

export async function declareAttack(
  gameId: string,
  uid: string,
  handIndex: number,
  stat: CombatStat
): Promise<void> {
  // Remove exactly the chosen hand instance (duplicates are independent).
  const privateSnap = await get(ref(db, `games/${gameId}/private/${uid}`));
  const privateData = normalizePrivate(privateSnap.val() as PlayerPrivate)!;
  const cardId = privateData.hand[handIndex];
  if (!cardId) return;
  const newHand = privateData.hand.filter((_, i) => i !== handIndex);
  await update(ref(db, `games/${gameId}/private/${uid}`), {
    selectedCard: cardId,
    hand: newHand,
  });

  // Update public state
  await update(ref(db, `games/${gameId}/public`), {
    phase: 'DEFENSE',
    'battle/declaredStat': stat,
    'battle/playersCommitted': [uid],
  });
  await update(ref(db, `games/${gameId}/public/players/${uid}`), {
    handCount: newHand.length,
  });
}

export async function commitDefense(
  gameId: string,
  uid: string,
  handIndex: number
): Promise<void> {
  // Remove exactly the chosen hand instance (duplicates are independent).
  const privateSnap = await get(ref(db, `games/${gameId}/private/${uid}`));
  const privateData = normalizePrivate(privateSnap.val() as PlayerPrivate)!;
  const cardId = privateData.hand[handIndex];
  if (!cardId) return;
  const newHand = privateData.hand.filter((_, i) => i !== handIndex);
  await update(ref(db, `games/${gameId}/private/${uid}`), {
    selectedCard: cardId,
    hand: newHand,
  });

  // Add to committed players
  const gameSnap = await get(ref(db, `games/${gameId}/public`));
  const game = normalizeGame(gameSnap.val() as GamePublic)!;
  const committed = [...game.battle.playersCommitted, uid];

  await update(ref(db, `games/${gameId}/public/battle`), { playersCommitted: committed });
  await update(ref(db, `games/${gameId}/public/players/${uid}`), {
    handCount: newHand.length,
  });

  // If all players have committed, move to REVEAL
  if (committed.length === game.playerOrder.length) {
    await revealCards(gameId);
  }
}

export async function revealCards(gameId: string): Promise<void> {
  const gameSnap = await get(ref(db, `games/${gameId}/public`));
  const game = normalizeGame(gameSnap.val() as GamePublic)!;

  // Collect all selected cards from private state
  const revealedCards: Record<string, string> = {};
  for (const uid of game.playerOrder) {
    const privateSnap = await get(ref(db, `games/${gameId}/private/${uid}`));
    const privateData = normalizePrivate(privateSnap.val() as PlayerPrivate)!;
    if (privateData.selectedCard) {
      revealedCards[uid] = privateData.selectedCard;
    }
  }

  await update(ref(db, `games/${gameId}/public`), {
    phase: 'REVEAL',
    'battle/revealedCards': revealedCards,
  });
}

export async function resolveBattleAction(gameId: string): Promise<void> {
  const gameSnap = await get(ref(db, `games/${gameId}/public`));
  const game = normalizeGame(gameSnap.val() as GamePublic)!;

  if (!game.battle.declaredStat) return;

  // Build card map for resolution
  const cardMap = new Map<string, import('@/types/card').CardDefinition>();
  for (const [uid, cardId] of Object.entries(game.battle.revealedCards)) {
    const card = getCardById(cardId);
    if (card) cardMap.set(uid, card);
  }

  const result = resolveBattle(cardMap, game.battle.declaredStat);

  if (result.winnerId) {
    // Clear winner — distribute cards
    const winnerId = result.winnerId;
    const winnerCardId = game.battle.revealedCards[winnerId];
    const winnerPublic = game.players[winnerId];

    let newWinners: string[];
    if (game.battle.isBlindBattle) {
      // Blind battle: the winner takes EVERY card on the table — their own blind
      // crok, every other player's blind crok, and the frozen pot of croks that
      // were played in the tie(s) leading here.
      newWinners = [
        ...(winnerPublic.winners || []),
        ...Object.values(game.battle.revealedCards),
        ...(game.battle.frozenPot || []),
      ];
    } else {
      // Normal battle: winner keeps their own card; losers' cards go to their
      // own losers piles.
      newWinners = [...(winnerPublic.winners || []), winnerCardId];
      for (const [uid, cardId] of Object.entries(game.battle.revealedCards)) {
        if (uid !== winnerId) {
          const loserPublic = game.players[uid];
          const newLosers = [...(loserPublic.losers || []), cardId];
          await update(ref(db, `games/${gameId}/public/players/${uid}`), {
            losers: newLosers,
          });
        }
      }
    }

    await update(ref(db, `games/${gameId}/public/players/${winnerId}`), {
      winners: newWinners,
      factionVictories: getUniqueFactions(newWinners, getCardById),
    });

    // Clear selectedCard for all players
    for (const uid of game.playerOrder) {
      await update(ref(db, `games/${gameId}/private/${uid}`), { selectedCard: null });
    }

    // Check victory conditions
    if (hasMetWinCondition(newWinners, game.winCondition, getCardById)) {
      await update(ref(db, `games/${gameId}/public`), {
        phase: 'GAME_OVER',
        winner: winnerId,
      });
      return;
    }

    // Check if any player is out of cards
    const allPlayersSnap = await get(ref(db, `games/${gameId}/public/players`));
    const allPlayers = allPlayersSnap.val() as Record<string, PlayerPublic>;
    const someoneOut = Object.values(allPlayers).some(
      p => p.handCount === 0 && p.deckCount === 0
    );

    if (someoneOut) {
      // Game ends — most winners wins
      let maxWins = -1;
      let finalWinner: string | null = null;
      for (const [uid, p] of Object.entries(allPlayers)) {
        if (p.winners.length > maxWins) {
          maxWins = p.winners.length;
          finalWinner = uid;
        }
      }
      await update(ref(db, `games/${gameId}/public`), {
        phase: 'GAME_OVER',
        winner: finalWinner,
      });
      return;
    }

    // Continue — winner is next attacker, go to DRAW phase
    const emptyBattle: BattleState = {
      declaredStat: null,
      revealedCards: {},
      playersCommitted: [],
      isBlindBattle: false,
      blindBattleCards: {},
      tiedPlayerIds: [],
      frozenPot: [],
    };

    await update(ref(db, `games/${gameId}/public`), {
      phase: 'DRAW',
      currentAttackerId: winnerId,
      turnNumber: game.turnNumber + 1,
      battle: emptyBattle,
    });
  } else {
    // Tie — the played croks are frozen in combat (added to the pot) and the
    // eventual blind-battle winner claims them. Accumulate across chained ties.
    const frozenPot = [
      ...(game.battle.frozenPot || []),
      ...Object.values(game.battle.revealedCards),
    ];

    // Blind battle (Vakharc): every player places the top card of their deck
    // face down (or a hand card if their deck is empty). These middle cards are
    // what gets compared; the winner takes all of them plus the frozen pot.
    const committed: string[] = [];
    for (const uid of game.playerOrder) {
      const privateSnap = await get(ref(db, `games/${gameId}/private/${uid}`));
      const priv = normalizePrivate(privateSnap.val() as PlayerPrivate)!;

      let blindCard: string | null = null;
      let newDeck = priv.deck;
      let newHand = priv.hand;

      if (priv.deck.length > 0) {
        blindCard = priv.deck[0];
        newDeck = priv.deck.slice(1);
      } else if (priv.hand.length > 0) {
        blindCard = priv.hand[0];
        newHand = priv.hand.slice(1);
      }

      if (blindCard) {
        committed.push(uid);
        await update(ref(db, `games/${gameId}/private/${uid}`), {
          selectedCard: blindCard,
          deck: newDeck,
          hand: newHand,
        });
        await update(ref(db, `games/${gameId}/public/players/${uid}`), {
          deckCount: newDeck.length,
          handCount: newHand.length,
        });
      } else {
        await update(ref(db, `games/${gameId}/private/${uid}`), { selectedCard: null });
      }
    }

    // Last defender of the tied combat becomes the new attacker and chooses the
    // combat type for the blind battle.
    const newAttacker = getLastDefender(game.playerOrder, game.currentAttackerId);

    await update(ref(db, `games/${gameId}/public`), {
      phase: 'BLIND_BATTLE',
      currentAttackerId: newAttacker,
      'battle/isBlindBattle': true,
      'battle/declaredStat': null,
      'battle/tiedPlayerIds': result.tiedPlayerIds,
      'battle/revealedCards': {},
      'battle/playersCommitted': committed,
      'battle/frozenPot': frozenPot,
    });
  }
}

/**
 * Blind battle resolution: the cards were already placed (top-of-deck) when the
 * tie occurred. The new attacker only needs to declare the combat type, after
 * which the placed cards are revealed and compared.
 */
export async function declareBlindBattleStat(
  gameId: string,
  stat: CombatStat
): Promise<void> {
  await update(ref(db, `games/${gameId}/public`), {
    'battle/declaredStat': stat,
  });
  await revealCards(gameId);
}
