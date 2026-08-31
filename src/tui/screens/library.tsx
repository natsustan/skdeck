import React from 'react';
import {Box, Text} from 'ink';
import {SkillList} from '../components/skill-list.js';
import type {LibraryRevision} from '../../core/library.js';

export function LibraryScreen({library, cursor, selected, targetDeck}: {library: LibraryRevision[]; cursor: number; selected: Set<string>; targetDeck: string | undefined}) {
  return <Box flexDirection="column" gap={1}>
    <Text bold>{targetDeck ? `Add Skills to ${targetDeck}` : 'Library'}</Text>
    <SkillList items={library} selected={cursor} checked={selected}/>
    <Text dimColor>Space select · {targetDeck ? 'Enter add to Deck · Esc back' : 'a add to Deck · d uninstall selected'} · Deck references stay pinned</Text>
  </Box>;
}
