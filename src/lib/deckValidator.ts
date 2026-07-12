import { getCardById } from './cardData';

export interface DeckValidationError {
  type: 'too_few_cards' | 'too_many_copies' | 'master_crok_limit';
  message: string;
  cardId?: string;
}

const MIN_DECK_SIZE = 10;

export function validateDeck(cardIds: string[]): DeckValidationError[] {
  const errors: DeckValidationError[] = [];

  if (cardIds.length < MIN_DECK_SIZE) {
    errors.push({
      type: 'too_few_cards',
      message: `Deck must have at least ${MIN_DECK_SIZE} cards (currently ${cardIds.length}).`,
    });
  }

  // Max copies allowed = floor(deckSize / 10)
  const maxCopies = Math.max(1, Math.floor(cardIds.length / 10));

  // Count occurrences of each card
  const counts: Record<string, number> = {};
  for (const id of cardIds) {
    counts[id] = (counts[id] || 0) + 1;
  }

  for (const [cardId, count] of Object.entries(counts)) {
    const card = getCardById(cardId);
    const isMasterCrok = card?.tribe === 'master';

    if (isMasterCrok && count > 1) {
      errors.push({
        type: 'master_crok_limit',
        message: `Master Crok "${card?.name}" can only appear once per deck.`,
        cardId,
      });
    } else if (!isMasterCrok && count > maxCopies) {
      errors.push({
        type: 'too_many_copies',
        message: `"${card?.name}" appears ${count} times but max is ${maxCopies} for a ${cardIds.length}-card deck.`,
        cardId,
      });
    }
  }

  return errors;
}

export function getMaxCopies(deckSize: number): number {
  return Math.max(1, Math.floor(deckSize / 10));
}
