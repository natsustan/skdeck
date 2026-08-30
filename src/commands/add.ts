import {intro, outro, spinner} from '@clack/prompts';
import {checkoutGitHub} from '../core/github/checkout.js';
import {discoverSkills} from '../core/github/discover.js';
import {importSkills} from '../core/library.js';
import {chooseSkills} from '../prompts/import-skills.js';
import {requireTty} from '../prompts/select-deck.js';

export async function addCommand(url: string): Promise<void> {
  requireTty();
  intro('Skdeck · Import');
  const progress = spinner();
  progress.start('Checking out repository');
  const checkout = await checkoutGitHub(url);
  try {
    const discovered = await discoverSkills(checkout);
    progress.stop(`Found ${discovered.length} Skill${discovered.length === 1 ? '' : 's'}`);
    const selected = await chooseSkills(discovered);
    if (selected.length === 0) return;
    progress.start('Importing immutable revisions');
    const imported = await importSkills(checkout, selected);
    progress.stop(`Imported ${imported.length} Skill${imported.length === 1 ? '' : 's'}`);
    outro('Open `skdeck` to add them to a Deck.');
  } finally { await checkout.cleanup(); }
}
