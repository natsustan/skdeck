import {afterEach, describe, expect, test} from 'bun:test';
import {mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {addManyToDeck, addToDeck, createDeck} from '../src/core/deck.js';
import type {Checkout} from '../src/core/github/checkout.js';
import {hashDirectory} from '../src/core/hashing.js';
import {importSkills, listLibrary} from '../src/core/library.js';
import {planDeck, readProjectLock} from '../src/core/planner.js';
import {applyPlan, planRemoveDeck, removeDeckFromProject} from '../src/core/project.js';

const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, {recursive: true, force: true}))); });

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'skdeck-test-')); temporary.push(root);
  const repository = join(root, 'repository');
  const skill = join(repository, 'skills', 'demo');
  const data = join(root, 'data');
  const project = join(root, 'project');
  await mkdir(skill, {recursive: true}); await mkdir(project);
  await writeFile(join(skill, 'SKILL.md'), '# Demo\n');
  await mkdir(join(skill, 'scripts')); await writeFile(join(skill, 'scripts', 'run.sh'), '#!/bin/sh\necho demo\n', {mode: 0o755});
  const checkout: Checkout = {directory: repository, sourceDirectory: skill, owner: 'acme', repository: 'skills', sourceUrl: 'https://github.com/acme/skills/tree/main/skills/demo', skillPath: 'skills/demo', commit: '1234567890abcdef', cleanup: async () => {}};
  const discovered = [{name: 'demo', path: 'skills/demo', absolutePath: skill}];
  return {root, repository, skill, data, project, checkout, discovered};
}

describe('Library, Deck, and project lifecycle', () => {
  test('adds selected revisions to a Deck without duplicates', async () => {
    const value = await fixture();
    const [revision] = await importSkills(value.checkout, value.discovered, value.data);
    const deck = await createDeck('selected', value.data);
    const updated = await addManyToDeck(deck, [revision!, revision!], value.data);
    expect(updated.skills).toEqual([{skillId: revision!.metadata.id, revision: revision!.revision.hash}]);
  });

  test('stores immutable revisions and preserves executable files', async () => {
    const value = await fixture();
    const [first] = await importSkills(value.checkout, value.discovered, value.data);
    const [same] = await importSkills(value.checkout, value.discovered, value.data);
    expect(same!.revision.hash).toBe(first!.revision.hash);
    expect((await listLibrary(value.data))).toHaveLength(1);
    if (process.platform !== 'win32') expect((await stat(join(first!.contentPath, 'scripts', 'run.sh'))).mode & 0o111).not.toBe(0);

    await writeFile(join(value.skill, 'SKILL.md'), '# Demo v2\n');
    await importSkills({...value.checkout, commit: 'abcdef1234567890'}, value.discovered, value.data);
    expect((await listLibrary(value.data))).toHaveLength(2);
    expect(await readFile(join(first!.contentPath, 'SKILL.md'), 'utf8')).toBe('# Demo\n');
  });

  test('applies shared ownership and refuses to remove modified content', async () => {
    const value = await fixture();
    const [revision] = await importSkills(value.checkout, value.discovered, value.data);
    let first = await createDeck('first', value.data); first = await addToDeck(first, revision!, value.data);
    let second = await createDeck('second', value.data); second = await addToDeck(second, revision!, value.data);

    const firstPlan = await planDeck(first, value.project, value.data);
    expect(firstPlan.items.map(item => item.action)).toEqual(['ADD']);
    await applyPlan(firstPlan);
    const secondPlan = await planDeck(second, value.project, value.data);
    expect(secondPlan.items.map(item => item.action)).toEqual(['UNCHANGED']);
    await applyPlan(secondPlan);
    expect((await readProjectLock(value.project)).skills[0]!.owners).toHaveLength(2);

    const release = await planRemoveDeck(first, value.project);
    expect(release.items[0]!.action).toBe('RELEASE');
    await removeDeckFromProject(release);
    const installed = join(value.project, '.agents', 'skills', 'demo');
    await writeFile(join(installed, 'SKILL.md'), '# locally changed\n');
    const blocked = await planRemoveDeck(second, value.project);
    expect(blocked.items[0]!.action).toBe('CONFLICT');
    await expect(removeDeckFromProject(blocked)).rejects.toThrow('modified');
    expect(await readFile(join(installed, 'SKILL.md'), 'utf8')).toContain('locally changed');
  });

  test('detects unmanaged conflicts before writing', async () => {
    const value = await fixture();
    const [revision] = await importSkills(value.checkout, value.discovered, value.data);
    let deck = await createDeck('demo', value.data); deck = await addToDeck(deck, revision!, value.data);
    const target = join(value.project, '.agents', 'skills', 'demo');
    await mkdir(target, {recursive: true}); await writeFile(join(target, 'SKILL.md'), '# unmanaged\n');
    const plan = await planDeck(deck, value.project, value.data);
    expect(plan.items[0]!.action).toBe('CONFLICT');
    await expect(applyPlan(plan)).rejects.toThrow('conflicts');
    expect((await readProjectLock(value.project)).skills).toHaveLength(0);
  });

  test('applies and removes an empty Deck', async () => {
    const value = await fixture();
    const deck = await createDeck('empty', value.data);
    const apply = await planDeck(deck, value.project, value.data);
    expect(apply.items).toEqual([]);
    await applyPlan(apply);
    expect((await readProjectLock(value.project)).decks).toEqual([{id: deck.id, name: 'empty'}]);

    const remove = await planRemoveDeck(deck, value.project);
    expect(remove.items).toEqual([]);
    await removeDeckFromProject(remove);
    expect((await readProjectLock(value.project)).decks).toEqual([]);
  });

  test('rejects symbolic links when hashing', async () => {
    const value = await fixture();
    await symlink('../SKILL.md', join(value.skill, 'linked'));
    await expect(hashDirectory(value.skill)).rejects.toThrow('symbolic link');
  });
});
