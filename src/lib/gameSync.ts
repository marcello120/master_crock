import { ref, onValue, off, onDisconnect, set } from 'firebase/database';
import { db } from './firebase';
import { useGameStore } from '@/stores/gameStore';
import { usePlayerStore } from '@/stores/playerStore';
import { GamePublic, PlayerPrivate } from '@/types/game';
import { normalizeGame, normalizePrivate } from './normalizeGame';

let unsubPublic: (() => void) | null = null;
let unsubPrivate: (() => void) | null = null;

export function subscribeToGame(gameId: string, uid: string): void {
  unsubscribeFromGame();

  // Subscribe to public game state
  const publicRef = ref(db, `games/${gameId}/public`);
  const publicHandler = onValue(publicRef, (snapshot) => {
    const data = snapshot.val() as GamePublic | null;
    useGameStore.getState().setGame(normalizeGame(data));
  });

  // Subscribe to own private state
  const privateRef = ref(db, `games/${gameId}/private/${uid}`);
  const privateHandler = onValue(privateRef, (snapshot) => {
    const data = snapshot.val() as PlayerPrivate | null;
    usePlayerStore.getState().setPrivateData(normalizePrivate(data));
  });

  // Set up disconnect detection
  const connectionRef = ref(db, `games/${gameId}/public/players/${uid}/isConnected`);
  set(connectionRef, true);
  onDisconnect(connectionRef).set(false);

  unsubPublic = () => off(publicRef);
  unsubPrivate = () => off(privateRef);
}

export function unsubscribeFromGame(): void {
  if (unsubPublic) {
    unsubPublic();
    unsubPublic = null;
  }
  if (unsubPrivate) {
    unsubPrivate();
    unsubPrivate = null;
  }
  useGameStore.setState({ game: null, loaded: false });
  usePlayerStore.getState().setPrivateData(null);
}
