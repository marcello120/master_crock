'use client';

import { getCardById } from '@/lib/cardData';
import CardFace from './CardFace';

interface PlayerHandProps {
  handCardIds: string[];
  selectedHandIndex: number | null;
  onSelectIndex: (index: number) => void;
  disabled?: boolean;
}

export default function PlayerHand({ handCardIds, selectedHandIndex, onSelectIndex, disabled }: PlayerHandProps) {
  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {handCardIds.map((cardId, idx) => {
        const card = getCardById(cardId) || null;
        return (
          <CardFace
            key={idx}
            card={card}
            selected={selectedHandIndex === idx}
            onClick={() => !disabled && onSelectIndex(idx)}
          />
        );
      })}
    </div>
  );
}
