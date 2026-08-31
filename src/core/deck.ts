import {randomUUID} from 'node:crypto';
import {readdir, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {atomicWriteJson, dataRoot, readJson, withCatalogLock} from './filesystem.js';
import {deckSchema, type Deck} from './schemas.js';
import type {LibraryRevision} from './library.js';

const deckPath = (root: string, id: string) => join(root, 'decks', `${id}.json`);

async function readDeck(id: string, root: string): Promise<Deck> {
  return readJson(deckPath(root, id), deckSchema);
}

export async function listDecks(root = dataRoot()): Promise<Deck[]> {
  let entries;
  try { entries = await readdir(join(root, 'decks'), {withFileTypes: true}); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const decks: Deck[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try { decks.push(await readJson(join(root, 'decks', entry.name), deckSchema)); }
    catch (error) {
      if (error instanceof Error && (error.cause as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') continue;
      throw error;
    }
  }
  return decks.sort((a, b) => a.name.localeCompare(b.name));
}

async function writeDeck(deck: Deck, root: string): Promise<Deck> {
  const valid = deckSchema.parse(deck);
  if ((await listDecks(root)).some(existing => existing.id !== valid.id && existing.name === valid.name)) throw new Error(`A deck named "${valid.name}" already exists.`);
  const duplicateNames = new Set<string>();
  const revisions = await Promise.all(valid.skills.map(async ref => (await import('./library.js')).findLibraryRevision(ref.skillId, ref.revision, root)));
  for (const item of revisions) {
    if (duplicateNames.has(item.metadata.name)) throw new Error(`Deck contains duplicate target name: ${item.metadata.name}`);
    duplicateNames.add(item.metadata.name);
  }
  await atomicWriteJson(deckPath(root, valid.id), valid);
  return valid;
}

export async function createDeck(name: string, root = dataRoot(), items: LibraryRevision[] = []): Promise<Deck> {
  return withCatalogLock(root, async () => writeDeck({
    schemaVersion: 1,
    id: randomUUID(),
    name: name.trim(),
    skills: items.map(item => ({skillId: item.metadata.id, revision: item.revision.hash})),
  }, root));
}

export async function addToDeck(deck: Deck, item: LibraryRevision, root = dataRoot()): Promise<Deck> {
  return addManyToDeck(deck, [item], root);
}

export async function addManyToDeck(deck: Deck, items: LibraryRevision[], root = dataRoot()): Promise<Deck> {
  return withCatalogLock(root, async () => {
    const current = await readDeck(deck.id, root);
    const skills = [...current.skills];
    for (const item of items) {
      if (!skills.some(ref => ref.skillId === item.metadata.id && ref.revision === item.revision.hash)) {
        skills.push({skillId: item.metadata.id, revision: item.revision.hash});
      }
    }
    return writeDeck({...current, skills}, root);
  });
}

export async function removeFromDeck(deck: Deck, skillIdValue: string, root = dataRoot()): Promise<Deck> {
  return withCatalogLock(root, async () => {
    const current = await readDeck(deck.id, root);
    return writeDeck({...current, skills: current.skills.filter(ref => ref.skillId !== skillIdValue)}, root);
  });
}

export async function renameDeck(deck: Deck, name: string, root = dataRoot()): Promise<Deck> {
  return withCatalogLock(root, async () => {
    const current = await readDeck(deck.id, root);
    return writeDeck({...current, name: name.trim()}, root);
  });
}

export async function deleteDeck(deck: Deck, root = dataRoot()): Promise<void> {
  await withCatalogLock(root, async () => rm(deckPath(root, deck.id)));
}
