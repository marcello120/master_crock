'use client';

import { PlayerPublic } from '@/types/game';

interface PlayerAreaProps {
  player: PlayerPublic;
  uid: string;
  isCurrentAttacker: boolean;
  isMe: boolean;
}

export default function PlayerArea({ player, uid, isCurrentAttacker, isMe }: PlayerAreaProps) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${
      isMe ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
    } ${isCurrentAttacker ? 'ring-2 ring-yellow-400' : ''}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{player.name}</span>
          {isCurrentAttacker && <span className="text-xs bg-yellow-200 px-1.5 py-0.5 rounded">ATK</span>}
          {!player.isConnected && <span className="text-xs text-red-500">(disconnected)</span>}
        </div>
        <div className="flex gap-3 text-xs text-gray-500 mt-1">
          <span>Hand: {player.handCount}</span>
          <span>Deck: {player.deckCount}</span>
          <span>Wins: {player.winners.length}</span>
          <span>Factions: {player.factionVictories.length}/6</span>
        </div>
      </div>
      {player.factionVictories.length > 0 && (
        <div className="flex gap-1 flex-wrap max-w-32">
          {player.factionVictories.map((tribe) => (
            <span key={tribe} className="text-[9px] bg-green-100 text-green-700 px-1 py-0.5 rounded">
              {tribe}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
