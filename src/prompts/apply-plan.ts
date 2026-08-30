import {confirm, isCancel, cancel} from '@clack/prompts';
import type {ApplyPlan} from '../core/planner.js';
import type {RemovePlan} from '../core/project.js';

export function printPlan(items: Array<{action: string; name: string; detail: string}>): void {
  for (const item of items) console.log(`  ${item.action.padEnd(9)} ${item.name} — ${item.detail}`);
}

export async function confirmPlan(plan: ApplyPlan | RemovePlan, verb: string): Promise<boolean> {
  printPlan(plan.items);
  if (plan.items.some(item => item.action === 'CONFLICT')) return false;
  const answer = await confirm({message: `${verb} Deck "${plan.deck.name}"?`});
  if (isCancel(answer)) { cancel('Cancelled.'); return false; }
  return answer;
}
