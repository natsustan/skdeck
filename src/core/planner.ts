import {access} from 'node:fs/promises';
import {join} from 'node:path';
import {dataRoot, readJson} from './filesystem.js';
import {hashDirectory} from './hashing.js';
import {findLibraryRevision, type LibraryRevision} from './library.js';
import {emptyLock, projectLockSchema, type Deck, type ProjectLock} from './schemas.js';

export type PlanAction = 'ADD' | 'UNCHANGED' | 'CONFLICT';
export interface PlanItem { action: PlanAction; name: string; detail: string; library: LibraryRevision }
export interface ApplyPlan { deck: Deck; projectRoot: string; dataRoot: string; lock: ProjectLock; items: PlanItem[] }

export const lockPath = (projectRoot: string) => join(projectRoot, '.agents', 'skdeck.lock');
export const skillsPath = (projectRoot: string) => join(projectRoot, '.agents', 'skills');

export async function readProjectLock(projectRoot: string): Promise<ProjectLock> {
  try { return await readJson(lockPath(projectRoot), projectLockSchema); }
  catch (error) {
    try { await access(lockPath(projectRoot)); throw error; }
    catch (accessError) { if (accessError === error) throw error; return emptyLock(); }
  }
}

export async function planDeck(deck: Deck, projectRoot: string, root = dataRoot()): Promise<ApplyPlan> {
  const lock = await readProjectLock(projectRoot);
  const items: PlanItem[] = [];
  for (const ref of deck.skills) {
    const library = await findLibraryRevision(ref.skillId, ref.revision, root);
    const name = library.metadata.name;
    const target = join(skillsPath(projectRoot), name);
    const managed = lock.skills.find(item => item.name === name);
    if (managed) {
      let currentHash: string;
      try { currentHash = await hashDirectory(target); }
      catch { items.push({action: 'CONFLICT', name, detail: 'Managed directory is missing or unreadable', library}); continue; }
      if (currentHash !== managed.installedHash) items.push({action: 'CONFLICT', name, detail: 'Installed Skill has local modifications', library});
      else if (managed.skillId !== ref.skillId || managed.revision !== ref.revision) items.push({action: 'CONFLICT', name, detail: 'Another managed revision uses this target name', library});
      else items.push({action: 'UNCHANGED', name, detail: managed.owners.includes(deck.id) ? 'Already owned by this Deck' : 'Shared managed revision', library});
      continue;
    }
    try { await access(target); items.push({action: 'CONFLICT', name, detail: 'Unmanaged directory already exists', library}); }
    catch { items.push({action: 'ADD', name, detail: 'New managed Skill', library}); }
  }
  return {deck, projectRoot, dataRoot: root, lock, items};
}
