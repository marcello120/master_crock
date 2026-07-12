'use client';

import { useState, useEffect, useMemo } from 'react';
import { ref, set, onValue, off, push } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { getAllCards, getAllTribes } from '@/lib/cardData';
import { validateDeck, getMaxCopies } from '@/lib/deckValidator';
import { CardDefinition } from '@/types/card';

export default function DeckBuilderPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [deckName, setDeckName] = useState('My Deck');
  const [deckCards, setDeckCards] = useState<string[]>([]);
  const [tribeFilter, setTribeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [savedDecks, setSavedDecks] = useState<Record<string, { name: string; cardIds: string[] }>>({});
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);

  const allCards = useMemo(() => getAllCards(), []);
  const allTribes = useMemo(() => getAllTribes(), []);

  // Load saved decks
  useEffect(() => {
    if (!user) return;
    const decksRef = ref(db, `users/${user.uid}/decks`);
    const handler = onValue(decksRef, (snap) => {
      setSavedDecks(snap.val() || {});
    });
    return () => off(decksRef);
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [loading, user, router]);

  if (!user) {
    return null;
  }

  const filteredCards = allCards.filter((card) => {
    if (tribeFilter !== 'all' && card.tribe !== tribeFilter) return false;
    if (searchQuery && !card.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const addCard = (cardId: string) => {
    setDeckCards([...deckCards, cardId]);
  };

  const removeCard = (index: number) => {
    setDeckCards(deckCards.filter((_, i) => i !== index));
  };

  const getCardCount = (cardId: string) => {
    return deckCards.filter(id => id === cardId).length;
  };

  const errors = validateDeck(deckCards);
  const maxCopies = getMaxCopies(deckCards.length);

  const saveDeck = async () => {
    if (!user) return;
    if (editingDeckId) {
      await set(ref(db, `users/${user.uid}/decks/${editingDeckId}`), {
        name: deckName,
        cardIds: deckCards,
      });
    } else {
      const newRef = push(ref(db, `users/${user.uid}/decks`));
      await set(newRef, { name: deckName, cardIds: deckCards });
    }
    setEditingDeckId(null);
    setDeckCards([]);
    setDeckName('My Deck');
  };

  const loadDeck = (deckId: string) => {
    const deck = savedDecks[deckId];
    if (deck) {
      setEditingDeckId(deckId);
      setDeckName(deck.name);
      setDeckCards(deck.cardIds);
    }
  };

  const getCardById = (id: string): CardDefinition | undefined => {
    return allCards.find(c => c.id === id);
  };

  return (
    <div className="flex min-h-screen">
      {/* Card Pool - Left */}
      <div className="flex-1 p-4 border-r overflow-y-auto">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Search cards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 border rounded-lg text-sm"
          />
          <select
            value={tribeFilter}
            onChange={(e) => setTribeFilter(e.target.value)}
            className="px-3 py-2 border rounded text-sm"
          >
            <option value="all">All Tribes</option>
            {allTribes.map(tribe => (
              <option key={tribe} value={tribe}>{tribe}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {filteredCards.map((card) => {
            const count = getCardCount(card.id);
            const isMaster = card.tribe === 'master';
            const atMax = isMaster ? count >= 1 : count >= maxCopies;

            return (
              <button
                key={card.imagePath}
                onClick={() => !atMax && addCard(card.id)}
                disabled={atMax}
                className={`p-2 border rounded-lg text-left text-sm ${
                  atMax ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-50'
                }`}
              >
                <img
                  src={`/cards/${card.imagePath}`}
                  alt={card.name}
                  className="w-full aspect-[3/4] object-cover rounded mb-1"
                  loading="lazy"
                />
                <p className="font-medium truncate">{card.name}</p>
                <p className="text-xs text-gray-500">{card.tribe}</p>
                <p className="text-xs">
                  S:{card.strength} I:{card.intelligence} R:{card.reflex}
                </p>
                {count > 0 && (
                  <span className="text-xs text-blue-600">x{count} in deck</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Deck - Right */}
      <div className="w-80 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <input
            type="text"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            className="text-lg font-bold border-b border-transparent focus:border-blue-500 outline-none"
          />
          <button onClick={() => router.push('/')} className="text-sm text-gray-500 hover:underline">
            Back
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-1">
          {deckCards.length} cards (min 10) | Max copies: {maxCopies}
        </p>

        {errors.length > 0 && (
          <div className="mb-2">
            {errors.map((err, i) => (
              <p key={i} className="text-xs text-red-500">{err.message}</p>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto mb-4">
          {deckCards.map((cardId, index) => {
            const card = getCardById(cardId);
            return (
              <div key={index} className="flex justify-between items-center p-1 border-b text-sm">
                <span className="flex items-center gap-2 truncate">
                  {card && (
                    <img
                      src={`/cards/${card.imagePath}`}
                      alt={card.name}
                      className="w-8 h-10 object-cover rounded"
                      loading="lazy"
                    />
                  )}
                  <span className="truncate">{card?.name || cardId}</span>
                </span>
                <button
                  onClick={() => removeCard(index)}
                  className="text-red-500 text-xs hover:underline ml-2"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>

        <button
          onClick={saveDeck}
          disabled={errors.some(e => e.type === 'too_few_cards')}
          className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50 mb-2"
        >
          {editingDeckId ? 'Update Deck' : 'Save Deck'}
        </button>

        {Object.keys(savedDecks).length > 0 && (
          <div className="border-t pt-2">
            <p className="text-sm font-medium mb-1">Saved Decks</p>
            {Object.entries(savedDecks).map(([id, deck]) => (
              <button
                key={id}
                onClick={() => loadDeck(id)}
                className="block w-full text-left text-sm p-1 hover:bg-gray-100 rounded"
              >
                {deck.name} ({deck.cardIds.length})
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
