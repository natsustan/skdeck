import {access, readdir} from 'node:fs/promises';
import {basename, join, relative, sep} from 'node:path';
import type {Checkout} from './checkout.js';

export interface DiscoveredSkill {
  name: string;
  path: string;
  absolutePath: string;
}

async function hasSkillManifest(directory: string): Promise<boolean> {
  try { await access(join(directory, 'SKILL.md')); return true; } catch { return false; }
}

async function discoverAt(directory: string, repositoryRoot: string): Promise<DiscoveredSkill[]> {
  if (await hasSkillManifest(directory)) {
    return [{name: basename(directory), path: relative(repositoryRoot, directory).split(sep).join('/'), absolutePath: directory}];
  }
  const entries = await readdir(directory, {withFileTypes: true});
  const skills: DiscoveredSkill[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const child = join(directory, entry.name);
    if (await hasSkillManifest(child)) skills.push({name: entry.name, path: relative(repositoryRoot, child).split(sep).join('/'), absolutePath: child});
  }
  return skills;
}

export async function discoverSkills(checkout: Checkout): Promise<DiscoveredSkill[]> {
  let skills = await discoverAt(checkout.sourceDirectory, checkout.directory);
  if (skills.length === 0 && checkout.skillPath === '') {
    try { skills = await discoverAt(join(checkout.directory, 'skills'), checkout.directory); } catch { /* no conventional directory */ }
  }
  if (skills.length === 0) throw new Error('No Skills found. Expected SKILL.md here or in direct child directories.');
  return skills;
}
