import {isCancel, multiselect, cancel} from '@clack/prompts';
import type {DiscoveredSkill} from '../core/github/discover.js';

export async function chooseSkills(skills: DiscoveredSkill[]): Promise<DiscoveredSkill[]> {
  if (skills.length === 1) return skills;
  const selected = await multiselect({
    message: 'Select Skills to import',
    options: skills.map(skill => ({value: skill.path, label: skill.name, hint: skill.path})),
    required: true,
  });
  if (isCancel(selected)) { cancel('Cancelled.'); return []; }
  return skills.filter(skill => selected.includes(skill.path));
}
