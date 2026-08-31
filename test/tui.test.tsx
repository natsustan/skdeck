import React from 'react';
import {afterEach, expect, test} from 'bun:test';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {cleanup, render} from 'ink-testing-library';
import {addToDeck, createDeck, listDecks} from '../src/core/deck.js';
import type {Checkout} from '../src/core/github/checkout.js';
import {importSkills, listLibrary} from '../src/core/library.js';
import type {LibraryRevision} from '../src/core/library.js';
import {readProjectLock} from '../src/core/planner.js';
import {App} from '../src/tui/app.js';
import {PlanModal} from '../src/tui/components/plan-modal.js';
import {DecksScreen} from '../src/tui/screens/decks.js';
import {DiscoverScreen} from '../src/tui/screens/discover.js';
import {LibraryScreen} from '../src/tui/screens/library.js';
import {ProjectScreen} from '../src/tui/screens/project.js';

const revision: LibraryRevision = {
  metadata: {
    schemaVersion: 1,
    id: 'github.com/acme/skills/skills/demo',
    name: 'demo',
    sourceUrl: 'https://github.com/acme/skills/tree/main/skills/demo',
    repository: 'acme/skills',
    path: 'skills/demo',
    revisions: [{hash: `sha256:${'d'.repeat(64)}`, commit: '1234567890abcdef', importedAt: '2026-08-30T00:00:00.000Z'}],
  },
  revision: {hash: `sha256:${'d'.repeat(64)}`, commit: '1234567890abcdef', importedAt: '2026-08-30T00:00:00.000Z'},
  contentPath: '/tmp/demo',
};
const deck = {schemaVersion: 1 as const, id: '9a7d9470-afab-487c-94fd-97427a3a2c0f', name: 'frontend', skills: [{skillId: revision.metadata.id, revision: revision.revision.hash}]};
const temporary: string[] = [];

afterEach(async () => {
  cleanup();
  await Promise.all(temporary.splice(0).map(path => rm(path, {recursive: true, force: true})));
});

async function interactiveFixture() {
  const root = await mkdtemp(join(tmpdir(), 'skdeck-tui-test-'));
  temporary.push(root);
  const repository = join(root, 'repository');
  const skill = join(repository, 'skills', 'demo');
  const dataRoot = join(root, 'data');
  const projectRoot = join(root, 'project');
  await mkdir(skill, {recursive: true});
  await mkdir(projectRoot);
  await writeFile(join(skill, 'SKILL.md'), '# Demo\n');
  const checkout: Checkout = {
    directory: repository,
    sourceDirectory: skill,
    owner: 'acme',
    repository: 'skills',
    sourceUrl: 'https://github.com/acme/skills/tree/main/skills/demo',
    skillPath: 'skills/demo',
    commit: '1234567890abcdef',
    cleanup: async () => {},
  };
  const [item] = await importSkills(checkout, [{name: 'demo', path: 'skills/demo', absolutePath: skill}], dataRoot);
  return {dataRoot, projectRoot, revision: item!};
}

async function waitForFrame(view: ReturnType<typeof render>, text: string): Promise<string> {
  for (let attempt = 0; attempt < 250; attempt += 1) {
    const frame = view.lastFrame() ?? '';
    if (frame.includes(text)) {
      await new Promise(resolve => setTimeout(resolve, 20));
      return frame;
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for "${text}". Last frame:\n${view.lastFrame() ?? ''}`);
}

test('renders wide-character skill names without crashing', () => {
  const skill = {name: '中文技能', path: 'skills/中文技能', absolutePath: '/tmp/skill'};
  const view = render(<DiscoverScreen skills={[skill]} cursor={0} selected={new Set([skill.path])}/>);
  expect(view.lastFrame()).toContain('中文技能');
  expect(view.lastFrame()).toContain('[×]');
});

test('Library selects Skills before adding them to a Deck', () => {
  const view = render(<LibraryScreen library={[revision]} cursor={0} selected={new Set([revision.metadata.id])} targetDeck={undefined}/>);
  expect(view.lastFrame()).toContain('[×] demo');
  expect(view.lastFrame()).toContain('a add to Deck · d uninstall selected');
});

test('Decks shows the selected Deck contents instead of the whole Library', () => {
  const view = render(<DecksScreen decks={[deck]} deckCursor={0} skills={[revision]} skillCursor={0} focus="skills"/>);
  expect(view.lastFrame()).toContain('Decks · reusable Skill sets');
  expect(view.lastFrame()).toContain('Skills');
  expect(view.lastFrame()).toContain('demo');
});

test('Project shows installed Decks while Plan is a confirmation panel', () => {
  const project = render(<ProjectScreen decks={[deck]} cursor={0} lock={{schemaVersion: 1, decks: [{id: deck.id, name: deck.name}], skills: []}}/>);
  expect(project.lastFrame()).toContain('Installed in this project');
  expect(project.lastFrame()).toContain('frontend');

  const plan = render(<PlanModal kind="apply" deckName="frontend" items={[{action: 'ADD', name: 'demo', detail: 'new Skill'}]}/>);
  expect(plan.lastFrame()).toContain('Apply “frontend”?');
  expect(plan.lastFrame()).toContain('Enter confirm');
});

test('Library keyboard flow adds selected Skills to an existing Deck', async () => {
  const value = await interactiveFixture();
  await createDeck('frontend', value.dataRoot);
  const view = render(<App projectRoot={value.projectRoot} dataRoot={value.dataRoot}/>);
  await waitForFrame(view, 'Ready');

  view.stdin.write('2');
  await waitForFrame(view, 'demo');
  view.stdin.write(' ');
  await waitForFrame(view, '[×] demo');
  view.stdin.write('a');
  await waitForFrame(view, 'Add 1 Skill to Deck');
  view.stdin.write('\r');
  await waitForFrame(view, '● Added 1 Skill to frontend');

  expect((await listDecks(value.dataRoot))[0]!.skills).toEqual([
    {skillId: value.revision.metadata.id, revision: value.revision.revision.hash},
  ]);
});

test('Library keyboard flow creates a Deck with selected Skills', async () => {
  const value = await interactiveFixture();
  const view = render(<App projectRoot={value.projectRoot} dataRoot={value.dataRoot}/>);
  await waitForFrame(view, 'Ready');

  view.stdin.write('2');
  await waitForFrame(view, 'demo');
  view.stdin.write(' ');
  await waitForFrame(view, '[×] demo');
  view.stdin.write('a');
  await waitForFrame(view, 'New Deck name');
  view.stdin.write('starter');
  await waitForFrame(view, 'starter');
  view.stdin.write('\r');
  await waitForFrame(view, '● Created starter with 1 Skill');

  const [created] = await listDecks(value.dataRoot);
  expect(created!.name).toBe('starter');
  expect(created!.skills).toHaveLength(1);
});

test('Library keyboard flow confirms and uninstalls selected Skills', async () => {
  const value = await interactiveFixture();
  const view = render(<App projectRoot={value.projectRoot} dataRoot={value.dataRoot}/>);
  await waitForFrame(view, 'Ready');

  view.stdin.write('2');
  await waitForFrame(view, 'demo');
  view.stdin.write(' ');
  await waitForFrame(view, '[×] demo');
  view.stdin.write('d');
  await waitForFrame(view, 'Uninstall 1 Skill?');
  view.stdin.write('y');
  await waitForFrame(view, '● Uninstalled 1 Skill');

  expect(await listLibrary(value.dataRoot)).toEqual([]);
});

test('Deck keyboard flow adds and removes a Skill', async () => {
  const value = await interactiveFixture();
  await createDeck('frontend', value.dataRoot);
  const view = render(<App projectRoot={value.projectRoot} dataRoot={value.dataRoot}/>);
  await waitForFrame(view, 'Ready');

  view.stdin.write('3');
  await waitForFrame(view, 'Decks · reusable Skill sets');
  view.stdin.write('a');
  await waitForFrame(view, 'Add Skills to frontend');
  view.stdin.write(' ');
  await waitForFrame(view, '[×] demo');
  view.stdin.write('\r');
  await waitForFrame(view, '● Added 1 Skill to frontend');
  expect((await listDecks(value.dataRoot))[0]!.skills).toHaveLength(1);

  view.stdin.write('d');
  await waitForFrame(view, '● Removed Skill from frontend');
  expect((await listDecks(value.dataRoot))[0]!.skills).toHaveLength(0);
});

test('Project keyboard flow previews, cancels, applies, and removes a Deck', async () => {
  const value = await interactiveFixture();
  let frontend = await createDeck('frontend', value.dataRoot);
  frontend = await addToDeck(frontend, value.revision, value.dataRoot);
  await createDeck('secondary', value.dataRoot);
  const view = render(<App projectRoot={value.projectRoot} dataRoot={value.dataRoot}/>);
  await waitForFrame(view, 'Ready');

  view.stdin.write('3');
  await waitForFrame(view, 'frontend');
  view.stdin.write('\u001B[B');
  view.stdin.write('4');
  await waitForFrame(view, 'No Decks installed.');
  view.stdin.write('\r');
  await waitForFrame(view, 'Apply “frontend”?');
  view.stdin.write('\u001B');
  await waitForFrame(view, '● Change cancelled');
  expect((await readProjectLock(value.projectRoot)).decks).toHaveLength(0);

  view.stdin.write('\r');
  await waitForFrame(view, 'Apply “frontend”?');
  view.stdin.write('\r');
  view.stdin.write('\r');
  await waitForFrame(view, '● Applied frontend');
  await new Promise(resolve => setTimeout(resolve, 100));
  expect(view.lastFrame()).toContain('● Applied frontend');
  expect((await readProjectLock(value.projectRoot)).decks).toEqual([{id: frontend.id, name: 'frontend'}]);

  await new Promise(resolve => setTimeout(resolve, 20));
  view.stdin.write('x');
  await waitForFrame(view, 'Remove “frontend”?');
  view.stdin.write('\u001B');
  await waitForFrame(view, '● Change cancelled');
  view.stdin.write('x');
  await waitForFrame(view, 'Remove “frontend”?');
  view.stdin.write('\r');
  await waitForFrame(view, '● Removed frontend');
  expect((await readProjectLock(value.projectRoot)).decks).toHaveLength(0);
});

test('Project conflict preview blocks confirmation', async () => {
  const value = await interactiveFixture();
  let frontend = await createDeck('frontend', value.dataRoot);
  frontend = await addToDeck(frontend, value.revision, value.dataRoot);
  const unmanaged = join(value.projectRoot, '.agents', 'skills', 'demo');
  await mkdir(unmanaged, {recursive: true});
  await writeFile(join(unmanaged, 'SKILL.md'), '# Unmanaged\n');
  const view = render(<App projectRoot={value.projectRoot} dataRoot={value.dataRoot}/>);
  await waitForFrame(view, 'Ready');

  view.stdin.write('4');
  await waitForFrame(view, 'frontend');
  view.stdin.write('\r');
  await waitForFrame(view, 'Resolve conflicts before continuing');
  view.stdin.write('\r');
  await new Promise(resolve => setTimeout(resolve, 20));

  expect(view.lastFrame()).toContain('Resolve conflicts before continuing');
  expect((await readProjectLock(value.projectRoot)).decks).toHaveLength(0);
});
