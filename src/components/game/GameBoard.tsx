'use client';

import { useState, useEffect } from 'react';
import { GamePublic, PlayerPrivate } from '@/types/game';
import { useUIStore } from '@/stores/uiStore';
import {
  advanceFromDraw,
  declareAttack,
  commitDefense,
  resolveBattleAction,
  declareBlindBattleStat,
  deleteGame,
} from '@/lib/gameActions';
import PlayerHand from './PlayerHand';
import BattleZone from './BattleZone';
import PlayerArea from './PlayerArea';
import StatSelector from './StatSelector';
import { useRouter } from 'next/navigation';

interface GameBoardProps {
  game: GamePublic;
  privateData: PlayerPrivate;
  myUid: string;
  gameId: string;
}

export default function GameBoard({ game, privateData, myUid, gameId }: GameBoardProps) {
  const router = useRouter();
  const { selectedHandIndex, selectedStat, setSelectedHandIndex, setSelectedStat } = useUIStore();
  const [actionPending, setActionPending] = useState(false);

  const amIAttacker = game.currentAttackerId === myUid;
  const haveICommitted = game.battle.playersCommitted.includes(myUid);

  // Auto-advance from DRAW phase
  useEffect(() => {
    if (game.phase === 'DRAW' && amIAttacker && !actionPending) {
      setActionPending(true);
      advanceFromDraw(gameId, game.playerOrder).finally(() => setActionPending(false));
    }
  }, [game.phase, amIAttacker, gameId, game.playerOrder, actionPending]);

  // Auto-resolve after REVEAL
  useEffect(() => {
    if (game.phase === 'REVEAL' && amIAttacker && !actionPending) {
      // Small delay for animation
      const timeout = setTimeout(() => {
        setActionPending(true);
        resolveBattleAction(gameId).finally(() => setActionPending(false));
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [game.phase, amIAttacker, gameId, actionPending]);

  const handleAttack = async () => {
    if (selectedHandIndex === null || !selectedStat) return;
    setActionPending(true);
    try {
      await declareAttack(gameId, myUid, selectedHandIndex, selectedStat);
      setSelectedHandIndex(null);
      setSelectedStat(null);
    } finally {
      setActionPending(false);
    }
  };

  const handleDefense = async () => {
    if (selectedHandIndex === null) return;
    setActionPending(true);
    try {
      await commitDefense(gameId, myUid, selectedHandIndex);
      setSelectedHandIndex(null);
    } finally {
      setActionPending(false);
    }
  };

  const handleBlindBattleStat = async () => {
    if (!selectedStat) return;
    setActionPending(true);
    try {
      await declareBlindBattleStat(gameId, selectedStat);
      setSelectedStat(null);
    } finally {
      setActionPending(false);
    }
  };

  const handleDeleteGame = async () => {
    const msg =
      game.phase === 'GAME_OVER'
        ? 'Delete this game? This cannot be undone.'
        : 'Quit and delete this game for all players? This cannot be undone.';
    if (!confirm(msg)) return;
    await deleteGame(gameId, myUid);
    router.push('/lobby');
  };

  const getPhaseMessage = (): string => {
    switch (game.phase) {
      case 'DRAW':
        return 'Drawing cards...';
      case 'ATTACK':
        if (amIAttacker) return 'Your turn! Select a card and combat type.';
        return `Waiting for ${game.players[game.currentAttackerId]?.name} to attack...`;
      case 'DEFENSE':
        if (haveICommitted) return 'Waiting for other players...';
        return 'Select a card to defend!';
      case 'REVEAL':
        return 'Revealing cards...';
      case 'BLIND_BATTLE':
        if (amIAttacker) return 'Blind Battle! Cards are placed — choose the combat type.';
        return `Blind Battle! Waiting for ${game.players[game.currentAttackerId]?.name} to choose the combat type...`;
      case 'GAME_OVER':
        if (game.winner === myUid) return 'You win!';
        return `${game.players[game.winner || '']?.name || 'Someone'} wins!`;
      default:
        return '';
    }
  };

  const showHandInteraction =
    (game.phase === 'ATTACK' && amIAttacker) ||
    (game.phase === 'DEFENSE' && !haveICommitted && !amIAttacker);

  const showStatSelector =
    (game.phase === 'ATTACK' && amIAttacker) ||
    (game.phase === 'BLIND_BATTLE' && amIAttacker);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Opponents */}
      <div className="p-4 flex flex-wrap gap-2">
        {game.playerOrder
          .filter((uid) => uid !== myUid)
          .map((uid) => (
            <PlayerArea
              key={uid}
              player={game.players[uid]}
              uid={uid}
              isCurrentAttacker={game.currentAttackerId === uid}
              isMe={false}
            />
          ))}
      </div>

      {/* Battle Zone */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-sm font-medium text-gray-600 mb-4">{getPhaseMessage()}</p>
        <BattleZone
          battle={game.battle}
          phase={game.phase}
          playerOrder={game.playerOrder}
          players={game.players}
          myUid={myUid}
          mySelectedCard={privateData.selectedCard}
        />
      </div>

      {/* Controls */}
      <div className="p-4 border-t bg-gray-50">
        {/* My player area */}
        <div className="mb-3">
          <PlayerArea
            player={game.players[myUid]}
            uid={myUid}
            isCurrentAttacker={amIAttacker}
            isMe={true}
          />
        </div>

        {/* Stat selector (attacker during ATTACK or BLIND_BATTLE) */}
        {showStatSelector && (
          <div className="flex justify-center mb-3">
            <StatSelector onSelect={setSelectedStat} selected={selectedStat} />
          </div>
        )}

        {/* Hand */}
        <PlayerHand
          handCardIds={privateData.hand}
          selectedHandIndex={selectedHandIndex}
          onSelectIndex={setSelectedHandIndex}
          disabled={!showHandInteraction}
        />

        {/* Action buttons */}
        <div className="flex justify-center mt-3 gap-3">
          {game.phase === 'ATTACK' && amIAttacker && (
            <button
              onClick={handleAttack}
              disabled={selectedHandIndex === null || !selectedStat || actionPending}
              className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              Attack!
            </button>
          )}
          {game.phase === 'DEFENSE' && !haveICommitted && !amIAttacker && (
            <button
              onClick={handleDefense}
              disabled={selectedHandIndex === null || actionPending}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              Defend!
            </button>
          )}
          {game.phase === 'BLIND_BATTLE' && amIAttacker && (
            <button
              onClick={handleBlindBattleStat}
              disabled={!selectedStat || actionPending}
              className="px-6 py-2 bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              Reveal Blind Battle
            </button>
          )}
          <button
            onClick={() => router.push('/lobby')}
            className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium"
          >
            {game.phase === 'GAME_OVER' ? 'Back to Lobby' : 'Leave'}
          </button>
          {myUid === game.hostId && (
            <button
              onClick={handleDeleteGame}
              className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
            >
              {game.phase === 'GAME_OVER' ? 'Delete Game' : 'Quit & Delete Game'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
