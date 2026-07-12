import { CardDefinition } from '@/types/card';
import cardsJson from '@/data/cards.json';

const cards: CardDefinition[] = cardsJson as CardDefinition[];

export function getAllCards(): CardDefinition[] {
  return cards;
}

export function getCardById(id: string): CardDefinition | undefined {
  // Match the current `id` first, falling back to the legacy `serial` so decks
  // saved before the id/serial rename still resolve.
  return cards.find(c => c.id === id) ?? cards.find(c => c.serial === id);
}

export function getCardsByTribe(tribe: string): CardDefinition[] {
  return cards.filter(c => c.tribe === tribe);
}

export function getAllTribes(): string[] {
  return [...new Set(cards.map(c => c.tribe))].sort();
}
