import {createHash} from 'node:crypto';
import {access, mkdir, readdir, rename, rm} from 'node:fs/promises';
import {join} from 'node:path';
import lockfile from 'proper-lockfile';
import {atomicWriteJson, dataRoot, readJson, withCatalogLock} from './filesystem.js';
import {copyDirectory, hashDirectory, revisionDirectoryName} from './hashing.js';
import {skillMetadataSchema, type SkillMetadata} from './schemas.js';
import type {Checkout} from './github/checkout.js';
import type {DiscoveredSkill} from './github/discover.js';

export interface LibraryRevision { metadata: SkillMetadata; revision: SkillMetadata['revisions'][number]; contentPath: string }

function storageKey(skillId: string): string { return createHash('sha256').update(skillId).digest('hex'); }
export function skillId(checkout: Checkout, path: string): string { return `github.com/${checkout.owner}/${checkout.repository}/${path}`.replace(/\/$/, ''); }
function skillRoot(root: string, id: string): string { return join(root, 'skills', storageKey(id)); }

async function readMetadata(path: string, fallback: SkillMetadata): Promise<SkillMetadata> {
  try { return await readJson(path, skillMetadataSchema); }
  catch (error) {
    try { await access(path); throw error; }
    catch (accessError) { if (accessError === error) throw error; }
    return fallback;
  }
}

export async function importSkills(checkout: Checkout, skills: DiscoveredSkill[], root = dataRoot()): Promise<LibraryRevision[]> {
  return withCatalogLock(root, async () => {
    const imported: LibraryRevision[] = [];
    for (const skill of skills) {
      const id = skillId(checkout, skill.path);
      const base = skillRoot(root, id);
      const metadataPath = join(base, 'metadata.json');
      const hash = await hashDirectory(skill.absolutePath);
      const fallback: SkillMetadata = {schemaVersion: 1, id, name: skill.name, sourceUrl: checkout.sourceUrl, repository: `${checkout.owner}/${checkout.repository}`, path: skill.path, revisions: []};
      await mkdir(base, {recursive: true});
      const release = await lockfile.lock(base, {retries: {forever: true, minTimeout: 10, maxTimeout: 100}});
      let metadata: SkillMetadata;
      let revision: SkillMetadata['revisions'][number];
      const contentPath = join(base, 'revisions', revisionDirectoryName(hash), 'content');
      try {
        metadata = await readMetadata(metadataPath, fallback);
        const existing = metadata.revisions.find(item => item.hash === hash);
        if (existing) revision = existing;
        else {
          revision = {hash, commit: checkout.commit, importedAt: new Date().toISOString()};
          const temporary = `${contentPath}.tmp`;
          await rm(temporary, {recursive: true, force: true});
          try {
            await copyDirectory(skill.absolutePath, temporary);
            await mkdir(join(contentPath, '..'), {recursive: true});
            try { await rename(temporary, contentPath); }
            catch (error) {
              try { await access(contentPath); }
              catch { throw error; }
            }
          } finally {
            await rm(temporary, {recursive: true, force: true});
          }
          metadata.revisions.push(revision);
          await atomicWriteJson(metadataPath, metadata);
        }
      } finally {
        await release();
      }
      imported.push({metadata, revision, contentPath});
    }
    return imported;
  });
}

export async function listLibraryRevisions(root = dataRoot()): Promise<LibraryRevision[]> {
  const directory = join(root, 'skills');
  let entries;
  try { entries = await readdir(directory, {withFileTypes: true}); } catch { return []; }
  const result: LibraryRevision[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.endsWith('.lock')) continue;
    let metadata: SkillMetadata;
    try { metadata = await readJson(join(directory, entry.name, 'metadata.json'), skillMetadataSchema); }
    catch (error) {
      if (error instanceof Error && (error.cause as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') continue;
      throw error;
    }
    for (const revision of metadata.revisions) result.push({metadata, revision, contentPath: join(directory, entry.name, 'revisions', revisionDirectoryName(revision.hash), 'content')});
  }
  return result.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name) || b.revision.importedAt.localeCompare(a.revision.importedAt));
}

export function latestLibrarySkills(revisions: LibraryRevision[]): LibraryRevision[] {
  return revisions.filter(item => item.metadata.revisions.at(-1)?.hash === item.revision.hash);
}

export async function listLibrary(root = dataRoot()): Promise<LibraryRevision[]> {
  return latestLibrarySkills(await listLibraryRevisions(root));
}

export async function removeLibrarySkills(items: LibraryRevision[], root = dataRoot()): Promise<void> {
  const requested = new Map(items.map(item => [item.metadata.id, item]));
  if (requested.size === 0) return;

  await withCatalogLock(root, async () => {
    const {listDecks} = await import('./deck.js');
    const decks = await listDecks(root);
    for (const item of requested.values()) {
      const users = decks.filter(deck => deck.skills.some(ref => ref.skillId === item.metadata.id));
      if (users.length > 0) {
        throw new Error(`Cannot uninstall ${item.metadata.name}; used by Deck${users.length === 1 ? '' : 's'} ${users.map(deck => `"${deck.name}"`).join(', ')}. Remove it from the Deck first.`);
      }
    }

    for (const id of requested.keys()) {
      const base = skillRoot(root, id);
      const release = await lockfile.lock(base, {retries: {forever: true, minTimeout: 10, maxTimeout: 100}});
      try { await rm(base, {recursive: true}); }
      finally { await release(); }
    }
  });
}

export async function findLibraryRevision(id: string, hash: string, root = dataRoot()): Promise<LibraryRevision> {
  const base = skillRoot(root, id);
  const metadata = await readJson(join(base, 'metadata.json'), skillMetadataSchema);
  const revision = metadata.revisions.find(item => item.hash === hash);
  if (!revision) throw new Error(`Library revision not found: ${id} @ ${hash}`);
  return {metadata, revision, contentPath: join(base, 'revisions', revisionDirectoryName(hash), 'content')};
}
