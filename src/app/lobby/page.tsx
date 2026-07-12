'use client';

import { useEffect, useState } from 'react';
import { ref, onValue, off, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Lobby, WinCondition } from '@/types/game';
import {
  createLobby,
  joinLobby,
  selectDeckInLobby,
  setReady,
  leaveLobby,
  deleteLobby,
  deleteGame,
  unregisterUserGame,
  initializeGame,
} from '@/lib/gameActions';

export default function LobbyPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [currentLobby, setCurrentLobby] = useState<Lobby | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newLobbyName, setNewLobbyName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [winCondition, setWinCondition] = useState<WinCondition>('DIFFERENT_TRIBES');
  const [userDecks, setUserDecks] = useState<Record<string, { name: string; cardIds: string[] }>>({});
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [ongoingGames, setOngoingGames] = useState<Record<string, { label: string; isHost?: boolean }>>({});

  // Load user's decks
  useEffect(() => {
    if (!user) return;
    const decksRef = ref(db, `users/${user.uid}/decks`);
    const handler = onValue(decksRef, (snap) => {
      setUserDecks(snap.val() || {});
    });
    return () => off(decksRef);
  }, [user]);

  // Load user's ongoing games
  useEffect(() => {
    if (!user) return;
    const gamesRef = ref(db, `users/${user.uid}/games`);
    const handler = onValue(gamesRef, (snap) => {
      setOngoingGames(snap.val() || {});
    });
    return () => off(gamesRef);
  }, [user]);

  // Subscribe to lobbies
  useEffect(() => {
    const lobbiesRef = ref(db, 'lobbies');
    const handler = onValue(lobbiesRef, (snap) => {
      const data = snap.val();
      if (!data) {
        setLobbies([]);
        return;
      }
      const list: Lobby[] = Object.values(data);
      setLobbies(list.filter(l => l.status === 'waiting'));

      // Update current lobby if we're in one
      if (currentLobby) {
        const updated = list.find(l => l.id === currentLobby.id);
        if (updated) setCurrentLobby(updated);
      }
    });
    return () => off(lobbiesRef);
  }, [currentLobby?.id]);

  // When the lobby we're in starts a game, follow everyone into it.
  useEffect(() => {
    if (currentLobby?.status === 'in_game' && currentLobby.gameId) {
      router.push(`/game/${currentLobby.gameId}`);
    }
  }, [currentLobby?.status, currentLobby?.gameId, router]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [loading, user, router]);

  if (!user) {
    return null;
  }

  const handleCreate = async () => {
    if (!newLobbyName.trim()) return;
    const lobbyId = await createLobby(
      user.uid,
      user.displayName || 'Player',
      newLobbyName,
      maxPlayers,
      winCondition
    );
    setShowCreate(false);
    setNewLobbyName('');
    // Join the lobby we just created
    const lobbySnap = await get(ref(db, `lobbies/${lobbyId}`));
    setCurrentLobby(lobbySnap.val());
  };

  const handleJoin = async (lobby: Lobby) => {
    await joinLobby(lobby.id, user.uid, user.displayName || 'Player');
    const lobbySnap = await get(ref(db, `lobbies/${lobby.id}`));
    setCurrentLobby(lobbySnap.val());
  };

  const handleSelectDeck = async (deckId: string) => {
    if (!currentLobby) return;
    setSelectedDeckId(deckId);
    await selectDeckInLobby(currentLobby.id, user.uid, deckId);
  };

  const handleReady = async () => {
    if (!currentLobby || !selectedDeckId) return;
    await setReady(currentLobby.id, user.uid, true);
  };

  const handleLeave = async () => {
    if (!currentLobby) return;
    await leaveLobby(currentLobby.id, user.uid);
    setCurrentLobby(null);
    setSelectedDeckId(null);
  };

  const handleStartGame = async () => {
    if (!currentLobby) return;
    // The navigation effect routes every player (host included) into the game
    // once the lobby's status flips to in_game.
    await initializeGame(currentLobby.id, currentLobby);
  };

  const handleDeleteCurrentLobby = async () => {
    if (!currentLobby) return;
    if (!confirm('Delete this lobby? This cannot be undone.')) return;
    await deleteLobby(currentLobby.id);
    setCurrentLobby(null);
    setSelectedDeckId(null);
  };

  const handleDeleteLobbyFromList = async (e: React.MouseEvent, lobbyId: string) => {
    e.stopPropagation();
    if (!confirm('Delete this lobby? This cannot be undone.')) return;
    await deleteLobby(lobbyId);
  };

  const handleRejoinGame = (gameId: string) => {
    router.push(`/game/${gameId}`);
  };

  const handleDeleteOngoingGame = async (gameId: string) => {
    if (!confirm('Delete this ongoing game for all players? This cannot be undone.')) return;
    await deleteGame(gameId, user.uid);
    // deleteGame removes our own index entry; ensure UI clears even if the
    // game node was already gone.
    await unregisterUserGame(user.uid, gameId);
  };

  const allReady = currentLobby
    ? Object.values(currentLobby.players).every(p => p.ready) &&
      Object.keys(currentLobby.players).length >= 2
    : false;

  const isHost = currentLobby?.hostId === user.uid;

  // In a lobby view
  if (currentLobby) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
        <h1 className="text-3xl font-bold">{currentLobby.name}</h1>
        <p className="text-gray-500">
          {Object.keys(currentLobby.players).length}/{currentLobby.maxPlayers} players |
          Win: {currentLobby.winCondition === 'DIFFERENT_TRIBES' ? '6 Different Factions' : '6 Same Faction'}
        </p>

        <div className="w-full max-w-md">
          <h2 className="text-lg font-semibold mb-2">Players</h2>
          {Object.entries(currentLobby.players).map(([uid, player]) => (
            <div key={uid} className="flex justify-between items-center p-2 border-b">
              <span>{player.name} {uid === currentLobby.hostId && '(Host)'}</span>
              <span className={player.ready ? 'text-green-600' : 'text-gray-400'}>
                {player.ready ? 'Ready' : 'Not ready'}
              </span>
            </div>
          ))}
        </div>

        <div className="w-full max-w-md">
          <h2 className="text-lg font-semibold mb-2">Select Deck</h2>
          {Object.keys(userDecks).length === 0 ? (
            <p className="text-gray-500">
              No decks yet.{' '}
              <button onClick={() => router.push('/deck-builder')} className="text-blue-600 underline">
                Build one
              </button>
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {Object.entries(userDecks).map(([deckId, deck]) => (
                <button
                  key={deckId}
                  onClick={() => handleSelectDeck(deckId)}
                  className={`p-3 border rounded-lg text-left ${
                    selectedDeckId === deckId ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                >
                  {deck.name} ({deck.cardIds.length} cards)
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          {!currentLobby.players[user.uid]?.ready && (
            <button
              onClick={handleReady}
              disabled={!selectedDeckId}
              className="px-6 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
            >
              Ready
            </button>
          )}
          {isHost && allReady && (
            <button
              onClick={handleStartGame}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Start Game
            </button>
          )}
          <button
            onClick={handleLeave}
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg"
          >
            Leave
          </button>
          {isHost && (
            <button
              onClick={handleDeleteCurrentLobby}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Delete Lobby
            </button>
          )}
        </div>
      </div>
    );
  }

  // Lobby list view
  return (
    <div className="flex flex-col items-center min-h-screen p-8 gap-6">
      <h1 className="text-3xl font-bold">Game Lobbies</h1>

      <button
        onClick={() => setShowCreate(true)}
        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
      >
        Create Lobby
      </button>

      {showCreate && (
        <div className="w-full max-w-md p-4 border rounded-lg flex flex-col gap-3">
          <input
            type="text"
            placeholder="Lobby name"
            value={newLobbyName}
            onChange={(e) => setNewLobbyName(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          />
          <div className="flex gap-4 items-center">
            <label className="text-sm">Players:</label>
            <select
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="px-2 py-1 border rounded"
            >
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>
          <div className="flex gap-4 items-center">
            <label className="text-sm">Win:</label>
            <select
              value={winCondition}
              onChange={(e) => setWinCondition(e.target.value as WinCondition)}
              className="px-2 py-1 border rounded"
            >
              <option value="DIFFERENT_TRIBES">6 Different Factions</option>
              <option value="SAME_TRIBE">6 Same Faction</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-4 py-2 bg-green-600 text-white rounded-lg">
              Create
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-gray-200 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

      {Object.keys(ongoingGames).length > 0 && (
        <div className="w-full max-w-md">
          <h2 className="text-lg font-semibold mb-2">Ongoing Games</h2>
          {Object.entries(ongoingGames).map(([gameId, info]) => (
            <div key={gameId} className="flex justify-between items-center p-4 border-b">
              <div>
                <p className="font-medium">{info.label}</p>
                <p className="text-sm text-gray-500">In progress</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRejoinGame(gameId)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Rejoin
                </button>
                {info.isHost && (
                  <button
                    onClick={() => handleDeleteOngoingGame(gameId)}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="w-full max-w-md">
        <h2 className="text-lg font-semibold mb-2">Open Lobbies</h2>
        {lobbies.length === 0 ? (
          <p className="text-gray-500 text-center">No open lobbies. Create one!</p>
        ) : (
          lobbies.map((lobby) => (
            <div key={lobby.id} className="flex justify-between items-center p-4 border-b">
              <div>
                <p className="font-medium">{lobby.name}</p>
                <p className="text-sm text-gray-500">
                  {Object.keys(lobby.players).length}/{lobby.maxPlayers} players
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleJoin(lobby)}
                  disabled={Object.keys(lobby.players).length >= lobby.maxPlayers}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
                >
                  Join
                </button>
                {lobby.hostId === user.uid && (
                  <button
                    onClick={(e) => handleDeleteLobbyFromList(e, lobby.id)}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <button
        onClick={() => router.push('/')}
        className="text-sm text-gray-500 hover:underline"
      >
        Back to Home
      </button>
    </div>
  );
}
