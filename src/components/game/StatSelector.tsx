'use client';

import { CombatStat } from '@/types/game';

interface StatSelectorProps {
  onSelect: (stat: CombatStat) => void;
  selected: CombatStat | null;
}

const stats: { stat: CombatStat; label: string; color: string }[] = [
  { stat: 'STRENGTH', label: 'STR', color: 'bg-red-600 hover:bg-red-700' },
  { stat: 'INTELLIGENCE', label: 'INT', color: 'bg-blue-600 hover:bg-blue-700' },
  { stat: 'REFLEX', label: 'REF', color: 'bg-green-600 hover:bg-green-700' },
];

export default function StatSelector({ onSelect, selected }: StatSelectorProps) {
  return (
    <div className="flex gap-2">
      {stats.map(({ stat, label, color }) => (
        <button
          key={stat}
          onClick={() => onSelect(stat)}
          className={`px-4 py-2 text-white rounded-lg font-bold text-sm ${color} ${
            selected === stat ? 'ring-2 ring-yellow-400 ring-offset-2' : ''
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
