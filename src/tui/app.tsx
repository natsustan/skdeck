import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Box, Text, useApp, useInput} from 'ink';
import {addManyToDeck, createDeck, deleteDeck, listDecks, removeFromDeck, renameDeck} from '../core/deck.js';
import {checkoutGitHub, type Checkout} from '../core/github/checkout.js';
import {discoverSkills, type DiscoveredSkill} from '../core/github/discover.js';
import {dataRoot as defaultDataRoot} from '../core/filesystem.js';
import {importSkills, latestLibrarySkills, listLibraryRevisions, removeLibrarySkills, type LibraryRevision} from '../core/library.js';
import {planDeck, readProjectLock, type ApplyPlan} from '../core/planner.js';
import {applyPlan, planRemoveDeck, removeDeckFromProject, type RemovePlan} from '../core/project.js';
import type {Deck, ProjectLock} from '../core/schemas.js';
import {DeckPicker} from './components/deck-picker.js';
import {Modal} from './components/modal.js';
import {Navigation} from './components/navigation.js';
import {PlanModal} from './components/plan-modal.js';
import {DecksScreen} from './screens/decks.js';
import {DiscoverScreen} from './screens/discover.js';
import {LibraryScreen} from './screens/library.js';
import {ProjectScreen} from './screens/project.js';
import type {InputMode, Page} from './state.js';

interface Discovery {checkout: Checkout; skills: DiscoveredSkill[]; selected: Set<string>}
type ProjectPlan = {kind: 'apply'; value: ApplyPlan} | {kind: 'remove'; value: RemovePlan};
const libraryKey = (item: LibraryRevision) => item.metadata.id;
const skillCount = (count: number) => `${count} Skill${count === 1 ? '' : 's'}`;

export function App({projectRoot = process.cwd(), dataRoot = defaultDataRoot()}: {projectRoot?: string; dataRoot?: string}) {
  const {exit} = useApp();
  const [page, setPage] = useState<Page>(0);
  const [library, setLibrary] = useState<LibraryRevision[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [lock, setLock] = useState<ProjectLock>();
  const [status, setStatus] = useState('Ready');
  const [busy, setBusy] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>();
  const [discovery, setDiscovery] = useState<Discovery>();
  const [cursor, setCursor] = useState(0);
  const [deckCursor, setDeckCursor] = useState(0);
  const [projectCursor, setProjectCursor] = useState(0);
  const [libraryCursor, setLibraryCursor] = useState(0);
  const [selectedLibrary, setSelectedLibrary] = useState<Set<string>>(new Set());
  const [libraryTargetDeckId, setLibraryTargetDeckId] = useState<string>();
  const [deckSkillCursor, setDeckSkillCursor] = useState(0);
  const [focus, setFocus] = useState<'decks' | 'skills'>('decks');
  const [deckPicker, setDeckPicker] = useState(false);
  const [deckPickerCursor, setDeckPickerCursor] = useState(0);
  const [projectPlan, setProjectPlan] = useState<ProjectPlan>();
  const discoveryRef = useRef<Discovery | undefined>(undefined);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    const [nextLibrary, nextDecks, nextLock] = await Promise.all([listLibraryRevisions(dataRoot), listDecks(dataRoot), readProjectLock(projectRoot)]);
    setLibrary(nextLibrary); setDecks(nextDecks); setLock(nextLock);
  }, [dataRoot, projectRoot]);

  useEffect(() => { void refresh().catch(error => setStatus(error instanceof Error ? error.message : String(error))); }, [refresh]);
  useEffect(() => { discoveryRef.current = discovery; }, [discovery]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void discoveryRef.current?.checkout.cleanup();
      discoveryRef.current = undefined;
    };
  }, []);

  const run = useCallback((label: string, operation: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setStatus(label);
    void operation()
      .then(() => mountedRef.current ? refresh() : undefined)
      .catch(error => { if (mountedRef.current) setStatus(error instanceof Error ? error.message : String(error)); })
      .finally(() => {
        busyRef.current = false;
        if (mountedRef.current) setBusy(false);
      });
  }, [refresh]);
  const projectDecks = [...decks, ...(lock?.decks.filter(installed => !decks.some(deck => deck.id === installed.id)).map(installed => ({schemaVersion: 1 as const, ...installed, skills: []})) ?? [])];
  const librarySkills = latestLibrarySkills(library);
  const selectedDeck = decks[deckCursor];
  const selectedDeckSkills = selectedDeck?.skills.map(ref => library.find(item => item.metadata.id === ref.skillId && item.revision.hash === ref.revision)).filter((item): item is LibraryRevision => item !== undefined) ?? [];
  const selectedLibraryItems = librarySkills.filter(item => selectedLibrary.has(libraryKey(item)));
  const libraryTargetDeck = decks.find(deck => deck.id === libraryTargetDeckId);

  useInput((character, key) => {
    if (key.ctrl && character === 'c') { exit(); return; }
    if (busyRef.current) return;
    if (inputMode) {
      if (key.escape) { setInputMode(undefined); return; }
      if (inputMode.kind === 'deleteDeck' || inputMode.kind === 'uninstallLibrary') {
        if (character.toLowerCase() === 'y') {
          const mode = inputMode.kind;
          setInputMode(undefined);
          if (mode === 'deleteDeck') {
            const deck = decks[deckCursor];
            if (deck) run('Deleting Deck…', async () => { await deleteDeck(deck, dataRoot); setStatus(`Deleted ${deck.name}`); });
          } else {
            const count = selectedLibraryItems.length;
            run('Uninstalling Skills…', async () => {
              await removeLibrarySkills(selectedLibraryItems, dataRoot);
              setSelectedLibrary(new Set());
              setLibraryCursor(0);
              setStatus(`Uninstalled ${skillCount(count)}`);
            });
          }
        } else if (character.toLowerCase() === 'n') setInputMode(undefined);
        return;
      }
      if (key.return) {
        const value = inputMode.value.trim();
        if (!value) return;
        const mode = inputMode.kind;
        setInputMode(undefined);
        if (mode === 'url') run('Checking out repository…', async () => {
          const checkout = await checkoutGitHub(value);
          let retained = false;
          try {
            if (!mountedRef.current) return;
            const skills = await discoverSkills(checkout);
            if (!mountedRef.current) return;
            const next = {checkout, skills, selected: new Set(skills.map(skill => skill.path))};
            discoveryRef.current = next;
            setDiscovery(next);
            retained = true;
            setCursor(0); setStatus(`Found ${skills.length} Skills`);
          } finally {
            if (!retained) await checkout.cleanup();
          }
        });
        if (mode === 'newDeck') run('Creating Deck…', async () => {
          const deck = await createDeck(value, dataRoot, inputMode.addSelected ? selectedLibraryItems : []);
          setSelectedLibrary(new Set()); setDeckCursor(decks.length); setPage(2); setFocus('decks');
          setStatus(inputMode.addSelected ? `Created ${deck.name} with ${skillCount(selectedLibraryItems.length)}` : `Created ${deck.name}`);
        });
        if (mode === 'renameDeck') {
          const deck = decks[deckCursor];
          if (deck) run('Renaming Deck…', async () => { await renameDeck(deck, value, dataRoot); setStatus(`Renamed to ${value}`); });
        }
        return;
      }
      if (key.backspace || key.delete) setInputMode({...inputMode, value: inputMode.value.slice(0, -1)});
      else if (character && !key.ctrl && !key.meta) setInputMode({...inputMode, value: inputMode.value + character});
      return;
    }
    if (deckPicker) {
      if (key.escape) { setDeckPicker(false); return; }
      if (key.upArrow) setDeckPickerCursor(value => Math.max(0, value - 1));
      if (key.downArrow) setDeckPickerCursor(value => Math.min(decks.length - 1, value + 1));
      if (character === 'n') { setDeckPicker(false); setInputMode({kind: 'newDeck', value: '', addSelected: true}); }
      if (key.return && decks[deckPickerCursor]) {
        const deck = decks[deckPickerCursor]!;
        setDeckPicker(false);
        run('Adding Skills…', async () => {
          await addManyToDeck(deck, selectedLibraryItems, dataRoot); setSelectedLibrary(new Set()); setStatus(`Added ${skillCount(selectedLibraryItems.length)} to ${deck.name}`);
        });
      }
      return;
    }
    if (projectPlan) {
      if (key.escape) { setProjectPlan(undefined); setStatus('Change cancelled'); return; }
      if (key.return && !projectPlan.value.items.some(item => item.action === 'CONFLICT')) {
        if (projectPlan.kind === 'apply') run('Applying Deck…', async () => {
          await applyPlan(projectPlan.value); setProjectPlan(undefined); setStatus(`Applied ${projectPlan.value.deck.name}`);
        });
        else run('Removing Deck…', async () => {
          await removeDeckFromProject(projectPlan.value); setProjectPlan(undefined); setStatus(`Removed ${projectPlan.value.deck.name}`);
        });
      }
      return;
    }
    if (page === 0 && discovery) {
      if (key.escape) { void discovery.checkout.cleanup(); discoveryRef.current = undefined; setDiscovery(undefined); setStatus('Checkout discarded'); return; }
      if (key.upArrow) setCursor(value => Math.max(0, value - 1));
      if (key.downArrow) setCursor(value => Math.min(discovery.skills.length - 1, value + 1));
      if (character === ' ') setDiscovery(value => {
        if (!value) return value;
        const selected = new Set(value.selected); const path = value.skills[cursor]?.path;
        if (path) selected.has(path) ? selected.delete(path) : selected.add(path);
        return {...value, selected};
      });
      if (key.return && discovery.selected.size > 0) run('Importing selected Skills…', async () => {
        const selected = discovery.skills.filter(skill => discovery.selected.has(skill.path));
        await importSkills(discovery.checkout, selected, dataRoot);
        await discovery.checkout.cleanup();
        discoveryRef.current = undefined;
        setDiscovery(undefined);
        setStatus(`Imported ${skillCount(selected.length)}`);
      });
      return;
    }
    if (page === 1 && libraryTargetDeckId && key.escape) { setLibraryTargetDeckId(undefined); setSelectedLibrary(new Set()); setPage(2); return; }
    if (character === 'q' || key.escape) { exit(); return; }
    if (character >= '1' && character <= '4') { setPage((Number(character) - 1) as Page); setProjectPlan(undefined); return; }
    if (key.tab) { setPage(value => ((value + 1) % 4) as Page); setProjectPlan(undefined); return; }
    if (page === 0 && character === 'i') setInputMode({kind: 'url', value: ''});
    if (page === 1) {
      if (key.upArrow) setLibraryCursor(value => Math.max(0, value - 1));
      if (key.downArrow) setLibraryCursor(value => Math.min(librarySkills.length - 1, value + 1));
      if (character === ' ' && librarySkills[libraryCursor]) setSelectedLibrary(value => {
        const next = new Set(value); const id = libraryKey(librarySkills[libraryCursor]!); next.has(id) ? next.delete(id) : next.add(id); return next;
      });
      if (character === 'a' && !libraryTargetDeckId && selectedLibraryItems.length > 0) {
        if (decks.length === 0) setInputMode({kind: 'newDeck', value: '', addSelected: true});
        else { setDeckPickerCursor(0); setDeckPicker(true); }
      }
      if (character === 'd' && !libraryTargetDeckId && selectedLibraryItems.length > 0) {
        setInputMode({kind: 'uninstallLibrary', value: String(selectedLibraryItems.length)});
      }
      if (key.return && libraryTargetDeck && selectedLibraryItems.length > 0) run('Adding Skills…', async () => {
        await addManyToDeck(libraryTargetDeck, selectedLibraryItems, dataRoot); setSelectedLibrary(new Set()); setLibraryTargetDeckId(undefined); setPage(2); setFocus('skills'); setDeckSkillCursor(0); setStatus(`Added ${skillCount(selectedLibraryItems.length)} to ${libraryTargetDeck.name}`);
      });
    }
    if (page === 2) {
      if (key.leftArrow) setFocus('decks');
      if (key.rightArrow && selectedDeckSkills.length > 0) { setFocus('skills'); setDeckSkillCursor(0); }
      if (key.upArrow) focus === 'decks' ? setDeckCursor(value => Math.max(0, value - 1)) : setDeckSkillCursor(value => Math.max(0, value - 1));
      if (key.downArrow) focus === 'decks' ? setDeckCursor(value => Math.min(decks.length - 1, value + 1)) : setDeckSkillCursor(value => Math.min(selectedDeckSkills.length - 1, value + 1));
      if (character === 'n') setInputMode({kind: 'newDeck', value: '', addSelected: false});
      if (character === 'r' && decks[deckCursor]) setInputMode({kind: 'renameDeck', value: decks[deckCursor]!.name});
      if (character === 'x' && focus === 'decks' && selectedDeck) setInputMode({kind: 'deleteDeck', value: selectedDeck.name});
      if (character === 'a' && selectedDeck) { setLibraryTargetDeckId(selectedDeck.id); setSelectedLibrary(new Set()); setPage(1); setStatus(`Select Skills for ${selectedDeck.name}`); }
      if (character === 'd' && focus === 'skills' && selectedDeck && selectedDeckSkills[deckSkillCursor]) run('Removing Skill…', async () => {
        await removeFromDeck(selectedDeck, selectedDeckSkills[deckSkillCursor]!.metadata.id, dataRoot); setDeckSkillCursor(value => Math.max(0, value - 1)); setStatus(`Removed Skill from ${selectedDeck.name}`);
      });
    }
    if (page === 3) {
      if (key.upArrow) { setProjectCursor(value => Math.max(0, value - 1)); setProjectPlan(undefined); }
      if (key.downArrow) { setProjectCursor(value => Math.min(projectDecks.length - 1, value + 1)); setProjectPlan(undefined); }
      const deck = projectDecks[projectCursor];
      const installed = deck && lock?.decks.some(item => item.id === deck.id);
      if (key.return && deck && !installed) run('Preparing changes…', async () => { const value = await planDeck(deck, projectRoot, dataRoot); setProjectPlan({kind: 'apply', value}); setStatus('Review changes'); });
      if (key.return && installed) setStatus(`${deck.name} is already installed`);
      if (character === 'x' && deck && installed) run('Preparing removal…', async () => { const value = await planRemoveDeck(deck, projectRoot); setProjectPlan({kind: 'remove', value}); setStatus('Review changes'); });
      if (character === 'x' && deck && !installed) setStatus(`${deck.name} is not installed`);
    }
  });

  return <Box flexDirection="column" paddingX={1} gap={1}>
    <Box justifyContent="space-between"><Text bold color="cyan">SKDECK</Text><Navigation active={page}/><Text dimColor>q quit</Text></Box>
    <Box borderStyle="single" borderColor="gray" paddingX={1} minHeight={12} flexDirection="column">
      {page === 0 && <DiscoverScreen skills={discovery?.skills ?? []} cursor={cursor} selected={discovery?.selected ?? new Set()}/>}
      {page === 1 && <LibraryScreen library={librarySkills} cursor={libraryCursor} selected={selectedLibrary} targetDeck={libraryTargetDeck?.name}/>}
      {page === 2 && <DecksScreen decks={decks} deckCursor={deckCursor} skills={selectedDeckSkills} skillCursor={deckSkillCursor} focus={focus}/>}
      {page === 3 && <ProjectScreen decks={projectDecks} cursor={projectCursor} lock={lock} projectRoot={projectRoot}/>}
    </Box>
    {deckPicker && <DeckPicker decks={decks} cursor={deckPickerCursor} count={selectedLibraryItems.length}/>}
    {projectPlan && <PlanModal kind={projectPlan.kind} deckName={projectPlan.value.deck.name} items={projectPlan.value.items}/>}
    {inputMode && <Modal
      title={inputMode.kind === 'url' ? 'GitHub URL' : inputMode.kind === 'newDeck' ? 'New Deck name' : inputMode.kind === 'renameDeck' ? 'Rename Deck' : inputMode.kind === 'deleteDeck' ? `Delete local Deck "${inputMode.value}"?` : `Uninstall ${skillCount(Number(inputMode.value))}?`}
      value={inputMode.kind === 'deleteDeck' || inputMode.kind === 'uninstallLibrary' ? '' : inputMode.value}
      hint={inputMode.kind === 'deleteDeck' ? 'Installed project content is unchanged · y delete · n/Esc cancel' : inputMode.kind === 'uninstallLibrary' ? 'Removes local Library data · y uninstall · n/Esc cancel' : undefined}
    />}
    <Text color={status.toLowerCase().includes('error') || status.toLowerCase().includes('cannot') ? 'red' : busy ? 'yellow' : 'green'}>{busy ? '◌ ' : '● '}{status}</Text>
  </Box>;
}
