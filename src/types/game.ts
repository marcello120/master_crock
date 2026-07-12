export type CombatStat = 'STRENGTH' | 'INTELLIGENCE' | 'REFLEX';
export type WinCondition = 'DIFFERENT_TRIBES' | 'SAME_TRIBE';

export type GamePhase =
  | 'LOBBY'
  | 'DRAW'
  | 'ATTACK'
  | 'DEFENSE'
  | 'REVEAL'
  | 'BLIND_BATTLE'
  | 'GAME_OVER';

export interface PlayerPublic {
  name: string;
  seatIndex: number;
  handCount: number;
  deckCount: number;
  winners: string[];
  losers: string[];
  factionVictories: string[];
  isConnected: boolean;
}

export interface BattleState {
  declaredStat: CombatStat | null;
  revealedCards: Record<string, string>;
  playersCommitted: string[];
  isBlindBattle: boolean;
  blindBattleCards: Record<string, string>;
  tiedPlayerIds: string[];
  frozenPot: string[];
}

export interface GamePublic {
  id: string;
  hostId: string;
  phase: GamePhase;
  winCondition: WinCondition;
  playerOrder: string[];
  currentAttackerId: string;
  turnNumber: number;
  winner: string | null;
  battle: BattleState;
  players: Record<string, PlayerPublic>;
  createdAt: number;
}

export interface PlayerPrivate {
  hand: string[];
  deck: string[];
  selectedCard: string | null;
}

export interface LobbyPlayer {
  name: string;
  deckId: string | null;
  ready: boolean;
}

export interface Lobby {
  id: string;
  hostId: string;
  name: string;
  maxPlayers: number;
  winCondition: WinCondition;
  status: 'waiting' | 'in_game' | 'finished';
  gameId?: string;
  players: Record<string, LobbyPlayer>;
  createdAt: number;
}

export interface UserProfile {
  displayName: string;
  decks: Record<string, { name: string; cardIds: string[] }>;
}
