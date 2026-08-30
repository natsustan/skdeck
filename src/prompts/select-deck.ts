import {isCancel, select, cancel} from '@clack/prompts';
import type {Deck} from '../core/schemas.js';

export class UserCancelled extends Error {}

export function requireTty(): void {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Interactive input requires a TTY. Pass a Deck name explicitly.');
}

export async function selectDeck(decks: Deck[], message = 'Select a Deck'): Promise<Deck> {
  if (decks.length === 0) throw new Error('No Decks exist yet. Create one in `skdeck` first.');
  requireTty();
  const id = await select({message, options: decks.map(deck => ({value: deck.id, label: deck.name, hint: `${deck.skills.length} Skills`}))});
  if (isCancel(id)) { cancel('Cancelled.'); throw new UserCancelled(); }
  return decks.find(deck => deck.id === id)!;
}

export function findDeck(decks: Deck[], nameOrId: string): Deck {
  const deck = decks.find(item => item.name === nameOrId || item.id === nameOrId);
  if (!deck) throw new Error(`Deck not found: ${nameOrId}`);
  return deck;
}
