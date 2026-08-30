import {mkdir, rename, rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {atomicWriteJson} from './filesystem.js';
import {copyDirectory, hashDirectory} from './hashing.js';
import {lockPath, planDeck, readProjectLock, skillsPath, type ApplyPlan} from './planner.js';
import type {Deck, ProjectLock} from './schemas.js';

export async function applyPlan(plan: ApplyPlan): Promise<ProjectLock> {
  if (plan.items.some(item => item.action === 'CONFLICT')) throw new Error('Cannot apply a plan that contains conflicts.');
  const current = await planDeck(plan.deck, plan.projectRoot, plan.dataRoot);
  if (JSON.stringify(current.items.map(item => item.action)) !== JSON.stringify(plan.items.map(item => item.action))) {
    throw new Error('Project state changed after preview. Review a new plan before applying.');
  }
  const staging = join(plan.projectRoot, '.agents', `.skdeck-stage-${randomUUID()}`);
  const added: string[] = [];
  let committed = false;
  await mkdir(staging, {recursive: true});
  try {
    for (const item of current.items.filter(item => item.action === 'ADD')) await copyDirectory(item.library.contentPath, join(staging, item.name));
    const next: ProjectLock = structuredClone(current.lock);
    const knownDeck = next.decks.find(deck => deck.id === current.deck.id);
    if (knownDeck) knownDeck.name = current.deck.name;
    else next.decks.push({id: current.deck.id, name: current.deck.name});
    for (const item of current.items) {
      const existing = next.skills.find(skill => skill.name === item.name);
      if (existing) {
        if (!existing.owners.includes(current.deck.id)) existing.owners.push(current.deck.id);
      } else {
        next.skills.push({name: item.name, skillId: item.library.metadata.id, revision: item.library.revision.hash, installedHash: item.library.revision.hash, owners: [current.deck.id]});
      }
    }
    await mkdir(skillsPath(plan.projectRoot), {recursive: true});
    for (const item of current.items.filter(item => item.action === 'ADD')) {
      const target = join(skillsPath(plan.projectRoot), item.name);
      await rename(join(staging, item.name), target);
      added.push(target);
    }
    await atomicWriteJson(lockPath(plan.projectRoot), next);
    committed = true;
    return next;
  } catch (error) {
    if (!committed) for (const target of added) await rm(target, {recursive: true, force: true});
    throw error;
  } finally {
    await rm(staging, {recursive: true, force: true}).catch(() => {});
  }
}

export interface RemovePlanItem { name: string; action: 'RELEASE' | 'REMOVE' | 'CONFLICT'; detail: string }
export interface RemovePlan { deck: Deck; projectRoot: string; lock: ProjectLock; items: RemovePlanItem[] }

export async function planRemoveDeck(deck: Deck, projectRoot: string): Promise<RemovePlan> {
  const lock = await readProjectLock(projectRoot);
  const owned = lock.skills.filter(skill => skill.owners.includes(deck.id));
  const items: RemovePlanItem[] = [];
  for (const skill of owned) {
    if (skill.owners.length > 1) items.push({name: skill.name, action: 'RELEASE', detail: 'Still owned by another Deck'});
    else {
      try {
        const current = await hashDirectory(join(skillsPath(projectRoot), skill.name));
        items.push(current === skill.installedHash
          ? {name: skill.name, action: 'REMOVE', detail: 'Last owner; content is unchanged'}
          : {name: skill.name, action: 'CONFLICT', detail: 'Local modifications prevent removal'});
      } catch { items.push({name: skill.name, action: 'CONFLICT', detail: 'Managed directory is missing or unreadable'}); }
    }
  }
  return {deck, projectRoot, lock, items};
}

export async function removeDeckFromProject(plan: RemovePlan): Promise<ProjectLock> {
  if (plan.items.some(item => item.action === 'CONFLICT')) throw new Error('Cannot remove a Deck while managed Skills are modified.');
  const current = await planRemoveDeck(plan.deck, plan.projectRoot);
  if (JSON.stringify(current.items.map(item => item.action)) !== JSON.stringify(plan.items.map(item => item.action))) throw new Error('Project state changed after preview. Review a new plan.');
  const trash = join(plan.projectRoot, '.agents', `.skdeck-trash-${randomUUID()}`);
  const moved: Array<{from: string; to: string}> = [];
  let committed = false;
  let cleanupTrash = true;
  await mkdir(trash, {recursive: true});
  try {
    for (const item of current.items.filter(item => item.action === 'REMOVE')) {
      const from = join(skillsPath(plan.projectRoot), item.name);
      const to = join(trash, item.name);
      await rename(from, to);
      moved.push({from, to});
    }
    const next: ProjectLock = {
      schemaVersion: 1,
      decks: current.lock.decks.filter(item => item.id !== current.deck.id),
      skills: current.lock.skills.flatMap(skill => {
        if (!skill.owners.includes(current.deck.id)) return [skill];
        const owners = skill.owners.filter(owner => owner !== current.deck.id);
        return owners.length > 0 ? [{...skill, owners}] : [];
      }),
    };
    await atomicWriteJson(lockPath(plan.projectRoot), next);
    committed = true;
    return next;
  } catch (error) {
    if (!committed) {
      try { for (const item of moved.reverse()) await rename(item.to, item.from); }
      catch (rollbackError) {
        cleanupTrash = false;
        throw new AggregateError([error, rollbackError], `Removal failed and rollback data remains at ${trash}`);
      }
    }
    throw error;
  } finally { if (cleanupTrash) await rm(trash, {recursive: true, force: true}).catch(() => {}); }
}
