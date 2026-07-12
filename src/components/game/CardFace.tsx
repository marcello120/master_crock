'use client';

import { CardDefinition } from '@/types/card';
import { CombatStat } from '@/types/game';

interface CardFaceProps {
  card: CardDefinition | null;
  faceDown?: boolean;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
  highlightStat?: CombatStat | null;
}

export default function CardFace({
  card,
  faceDown,
  selected,
  onClick,
  small,
  highlightStat,
}: CardFaceProps) {
  const size = small ? 'w-16 h-24' : 'w-28 h-40';

  if (faceDown || !card) {
    return (
      <div
        onClick={onClick}
        className={`${size} rounded-lg border-2 border-gray-400 bg-gradient-to-br from-green-800 to-green-950 flex items-center justify-center cursor-pointer select-none ${
          selected ? 'ring-2 ring-yellow-400 ring-offset-2' : ''
        }`}
      >
        <span className={`text-white font-bold ${small ? 'text-xs' : 'text-sm'}`}>CROK</span>
      </div>
    );
  }

  const statCell = (label: string, value: number, stat: CombatStat, color: string) => (
    <div
      className={`text-center rounded ${
        highlightStat === stat ? 'bg-yellow-300 text-black' : 'bg-black/55 text-white'
      }`}
    >
      <div className={`font-bold ${color} ${highlightStat === stat ? '!text-black' : ''}`}>
        {value}
      </div>
      <div className="text-[7px] opacity-80">{label}</div>
    </div>
  );

  return (
    <div
      onClick={onClick}
      className={`${size} relative rounded-lg border-2 overflow-hidden ${
        selected ? 'border-yellow-400 ring-2 ring-yellow-400' : 'border-gray-300'
      } cursor-pointer hover:shadow-md transition-shadow select-none`}
    >
      <img
        src={`/cards/${card.imagePath}`}
        alt={card.name}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />
      <div className="absolute top-0 inset-x-0 bg-black/55 px-1 py-0.5">
        <p className={`${small ? 'text-[8px]' : 'text-[10px]'} font-bold text-white leading-tight truncate`}>
          {card.name}
        </p>
      </div>
      <div
        className={`absolute bottom-0 inset-x-0 grid grid-cols-3 gap-0.5 p-0.5 ${
          small ? 'text-[9px]' : 'text-[11px]'
        } font-mono`}
      >
        {statCell('STR', card.strength, 'STRENGTH', 'text-red-400')}
        {statCell('INT', card.intelligence, 'INTELLIGENCE', 'text-blue-400')}
        {statCell('REF', card.reflex, 'REFLEX', 'text-green-400')}
      </div>
    </div>
  );
}
