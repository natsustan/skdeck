import React from 'react';
import {Box, Text} from 'ink';
import {DeckList} from '../components/deck-list.js';
import {SkillList} from '../components/skill-list.js';
import type {Deck} from '../../core/schemas.js';
import type {LibraryRevision} from '../../core/library.js';

export function DecksScreen({decks, deckCursor, skills, skillCursor, focus}: {decks: Deck[]; deckCursor: number; skills: LibraryRevision[]; skillCursor: number; focus: 'decks' | 'skills'}) {
  return <Box flexDirection="column" gap={1}>
    <Text bold>Decks · reusable Skill sets</Text>
    <Box gap={2}>
      <Box width="40%" borderStyle="round" borderColor={focus === 'decks' ? 'cyan' : 'gray'} paddingX={1} flexDirection="column"><Text bold>Decks</Text><DeckList items={decks} selected={deckCursor}/></Box>
      <Box width="60%" borderStyle="round" borderColor={focus === 'skills' ? 'cyan' : 'gray'} paddingX={1} flexDirection="column"><Text bold>Skills</Text><SkillList items={skills} selected={focus === 'skills' ? skillCursor : -1}/></Box>
    </Box>
    <Text dimColor>←/→ focus · n new · r rename · a add Skills · d remove Skill · x delete Deck</Text>
  </Box>;
}
