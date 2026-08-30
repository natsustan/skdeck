import {intro, outro} from '@clack/prompts';
import {resolve} from 'node:path';
import {listDecks} from '../core/deck.js';
import {planDeck} from '../core/planner.js';
import {applyPlan} from '../core/project.js';
import {confirmPlan} from '../prompts/apply-plan.js';
import {findDeck, requireTty, selectDeck} from '../prompts/select-deck.js';

export async function useCommand(deckArgument: string | undefined, project: string): Promise<void> {
  requireTty();
  intro('Skdeck · Apply');
  const decks = await listDecks();
  const deck = deckArgument ? findDeck(decks, deckArgument) : await selectDeck(decks);
  const plan = await planDeck(deck, resolve(project));
  if (!await confirmPlan(plan, 'Apply')) {
    if (plan.items.some(item => item.action === 'CONFLICT')) throw new Error('Resolve the conflicts above, then try again.');
    return;
  }
  await applyPlan(plan);
  outro(`Applied ${deck.name} to ${resolve(project)}.`);
}
