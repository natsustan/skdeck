import React from 'react';
import {Box, Text} from 'ink';
import type {Deck} from '../../core/schemas.js';

export function DeckPicker({decks, cursor, count}: {decks: Deck[]; cursor: number; count: number}) {
  return <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column">
    <Text bold>Add {count} Skill{count === 1 ? '' : 's'} to Deck</Text>
    {decks.map((deck, index) => <Text key={deck.id} color={index === cursor ? 'cyan' : 'white'}>{index === cursor ? '› ' : '  '}{deck.name}</Text>)}
    <Text dimColor>↑/↓ choose · Enter add · n create new Deck · Esc cancel</Text>
  </Box>;
}
