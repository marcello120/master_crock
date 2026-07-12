'use client';

import { BattleState, CombatStat, GamePhase } from '@/types/game';
import { getCardById } from '@/lib/cardData';
import { resolveBattle } from '@/lib/gameEngine';
import { CardDefinition } from '@/types/card';
import CardFace from './CardFace';

interface BattleZoneProps {
  battle: BattleState;
  phase: GamePhase;
  playerOrder: string[];
  players: Record<string, { name: string }>;
  myUid: string;
  mySelectedCard: string | null;
}

const statLabels: Record<CombatStat, string> = {
  STRENGTH: 'Strength',
  INTELLIGENCE: 'Intelligence',
  REFLEX: 'Reflex',
};

const statColors: Record<CombatStat, string> = {
  STRENGTH: 'text-red-600',
  INTELLIGENCE: 'text-blue-600',
  REFLEX: 'text-green-600',
};

export default function BattleZone({ battle, phase, playerOrder, players, myUid, mySelectedCard }: BattleZoneProps) {
  const isRevealed = phase === 'REVEAL' || phase === 'GAME_OVER';

  // Determine the round winner once cards are revealed, for clear feedback.
  let winnerId: string | null = null;
  let isTie = false;
  if (isRevealed && battle.declaredStat) {
    const cardMap = new Map<string, CardDefinition>();
    for (const [uid, cardId] of Object.entries(battle.revealedCards ?? {})) {
      const card = getCardById(cardId);
      if (card) cardMap.set(uid, card);
    }
    if (cardMap.size > 0) {
      const result = resolveBattle(cardMap, battle.declaredStat);
      winnerId = result.winnerId;
      isTie = result.winnerId === null;
    }
  }

  const winnerName = winnerId ? players[winnerId]?.name || 'Player' : null;

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {battle.declaredStat && (
        <div className={`text-lg font-bold ${statColors[battle.declaredStat]}`}>
          {battle.isBlindBattle && 'Blind Battle! '}
          Combat: {statLabels[battle.declaredStat]}
        </div>
      )}

      {/* Round result banner */}
      {isRevealed && winnerName && (
        <div className="px-4 py-1.5 rounded-full bg-green-600 text-white font-bold text-sm shadow">
          {winnerId === myUid ? 'You win the round!' : `${winnerName} wins the round!`}
        </div>
      )}
      {isRevealed && isTie && (
        <div className="px-4 py-1.5 rounded-full bg-orange-500 text-white font-bold text-sm shadow">
          Tie — Blind Battle!
        </div>
      )}

      <div className="flex gap-4 items-end">
        {playerOrder.map((uid) => {
          const hasCommitted = battle.playersCommitted.includes(uid);
          const revealedCardId = battle.revealedCards?.[uid];
          const card = revealedCardId ? getCardById(revealedCardId) || null : null;
          const playerName = players[uid]?.name || 'Player';

          // The owner can normally see their own committed card before the
          // simultaneous reveal. In a blind battle, though, the placed croks are
          // drawn from the top of the deck and stay hidden from everyone (owner
          // included) until reveal.
          const isMine = uid === myUid;
          const showOwnCard = isMine && !battle.isBlindBattle && !!mySelectedCard;
          const myCard = showOwnCard ? getCardById(mySelectedCard!) || null : null;
          const visibleCard = card ?? (hasCommitted ? myCard : null);

          const isWinner = isRevealed && uid === winnerId;

          return (
            <div key={uid} className="flex flex-col items-center gap-1">
              <p className={`text-xs font-medium ${isMine ? 'text-blue-600' : ''}`}>
                {playerName}
              </p>
              <div className={isWinner ? 'rounded-lg ring-4 ring-green-500 ring-offset-2' : ''}>
                {visibleCard ? (
                  <CardFace card={visibleCard} highlightStat={isRevealed ? battle.declaredStat : null} />
                ) : hasCommitted ? (
                  <CardFace card={null} faceDown />
                ) : (
                  <div className="w-28 h-40 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <span className="text-xs text-gray-400">Waiting...</span>
                  </div>
                )}
              </div>
              {isRevealed && card && battle.declaredStat && (
                <p className={`text-sm font-bold ${statColors[battle.declaredStat]}`}>
                  {battle.declaredStat === 'STRENGTH' && card.strength}
                  {battle.declaredStat === 'INTELLIGENCE' && card.intelligence}
                  {battle.declaredStat === 'REFLEX' && card.reflex}
                  {isWinner && ' 👑'}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {battle.isBlindBattle && !isRevealed && battle.tiedPlayerIds.length > 0 && (
        <p className="text-sm text-orange-600">
          Frozen pot: {battle.frozenPot?.length ?? 0} crok(s) at stake
        </p>
      )}
    </div>
  );
}
