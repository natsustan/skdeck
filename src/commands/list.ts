import {listDecks} from '../core/deck.js';
import {listLibrary} from '../core/library.js';

export async function listCommand(): Promise<void> {
  const [decks, library] = await Promise.all([listDecks(), listLibrary()]);
  console.log('Decks');
  if (decks.length === 0) console.log('  (none)');
  for (const deck of decks) console.log(`  ${deck.name}  ${deck.skills.length} Skill${deck.skills.length === 1 ? '' : 's'}`);
  console.log('\nLibrary');
  if (library.length === 0) console.log('  (empty)');
  for (const item of library) console.log(`  ${item.metadata.name}  ${item.metadata.repository}@${item.revision.commit.slice(0, 7)}  ${item.revision.hash.slice(7, 19)}`);
}
