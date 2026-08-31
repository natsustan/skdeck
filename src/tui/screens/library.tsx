import React from 'react';
import {Box, Text} from 'ink';
import {SkillList} from '../components/skill-list.js';
import type {LibraryRevision, LibrarySort} from '../../core/library.js';

export function LibraryScreen({library, cursor, selected, targetDeck, sort}: {library: LibraryRevision[]; cursor: number; selected: Set<string>; targetDeck: string | undefined; sort: LibrarySort}) {
  return <Box flexDirection="column" gap={1}>
    <Box justifyContent="space-between">
      <Text bold>{targetDeck ? `Add Skills to ${targetDeck}` : 'Library'}</Text>
      <Text dimColor>Sort: {sort === 'recent' ? 'Recently installed' : 'Name'}</Text>
    </Box>
    <SkillList items={library} selected={cursor} checked={selected}/>
    <Text dimColor>Space select · s change sort · {targetDeck ? 'Enter add to Deck · Esc back' : 'a add to Deck · d uninstall selected'} · Deck references stay pinned</Text>
  </Box>;
}
