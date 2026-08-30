import {intro, outro} from '@clack/prompts';
import {resolve} from 'node:path';
import {listDecks} from '../core/deck.js';
import {readProjectLock} from '../core/planner.js';
import {planRemoveDeck, removeDeckFromProject} from '../core/project.js';
import {confirmPlan} from '../prompts/apply-plan.js';
import {findDeck, requireTty, selectDeck} from '../prompts/select-deck.js';

export async function removeCommand(deckArgument: string | undefined, project: string): Promise<void> {
  requireTty();
  intro('Skdeck · Remove');
  const projectRoot = resolve(project);
  const [localDecks, lock] = await Promise.all([listDecks(), readProjectLock(projectRoot)]);
  const decks = [...localDecks, ...lock.decks.filter(installed => !localDecks.some(local => local.id === installed.id)).map(installed => ({schemaVersion: 1 as const, ...installed, skills: []}))];
  const deck = deckArgument ? findDeck(decks, deckArgument) : await selectDeck(decks, 'Select an installed Deck');
  if (!lock.decks.some(installed => installed.id === deck.id)) throw new Error(`Deck "${deck.name}" is not installed in this project.`);
  const plan = await planRemoveDeck(deck, projectRoot);
  if (!await confirmPlan(plan, 'Remove')) {
    if (plan.items.some(item => item.action === 'CONFLICT')) throw new Error('Restore or revert modified Skills before removing this Deck.');
    return;
  }
  await removeDeckFromProject(plan);
  outro(`Removed ${deck.name} from ${projectRoot}.`);
}
