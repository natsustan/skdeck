import React from 'react';
import {Box, Text} from 'ink';
import {DeckList} from '../components/deck-list.js';
import type {Deck, ProjectLock} from '../../core/schemas.js';

export function ProjectScreen({decks, cursor, lock, projectRoot = process.cwd()}: {decks: Deck[]; cursor: number; lock: ProjectLock | undefined; projectRoot?: string}) {
  const installedIds = new Set(lock?.decks.map(deck => deck.id));
  return <Box flexDirection="column" gap={1}>
    <Text bold>Project · {projectRoot}</Text>
    <Box gap={2}>
      <Box width="50%" borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column"><Text bold>Available Decks</Text><DeckList items={decks} selected={cursor} emptyMessage="No Decks available."/>{decks[cursor] && <Text dimColor>{installedIds.has(decks[cursor]!.id) ? 'Installed' : 'Not installed'}</Text>}</Box>
      <Box width="50%" borderStyle="round" paddingX={1} flexDirection="column"><Text bold>Installed in this project</Text>{lock?.decks.length ? lock.decks.map(deck => <Text key={deck.id}>  {deck.name}</Text>) : <Text dimColor>No Decks installed.</Text>}</Box>
    </Box>
    <Text dimColor>↑/↓ choose · Enter apply · x remove · changes are reviewed before execution</Text>
  </Box>;
}
