import React from 'react';
import {Box, Text} from 'ink';
import type {Deck} from '../../core/schemas.js';

export function DeckList({items, selected, emptyMessage = 'No Decks. Press n to create one.'}: {items: Deck[]; selected: number; emptyMessage?: string}) {
  if (items.length === 0) return <Text dimColor>{emptyMessage}</Text>;
  return <Box flexDirection="column">{items.map((deck, index) =>
    <Text key={deck.id} color={index === selected ? 'cyan' : 'white'}>{index === selected ? '› ' : '  '}{deck.name} <Text dimColor>{deck.skills.length}</Text></Text>)}</Box>;
}
