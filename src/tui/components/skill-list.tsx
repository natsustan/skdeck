import React from 'react';
import {Box, Text} from 'ink';
import type {LibraryRevision} from '../../core/library.js';

export function SkillList({items, selected = -1, checked}: {items: LibraryRevision[]; selected?: number; checked?: Set<string>}) {
  if (items.length === 0) return <Text dimColor>No imported Skills.</Text>;
  return <Box flexDirection="column">{items.map((item, index) => {
    const key = `${item.metadata.id}:${item.revision.hash}`;
    return <Text key={key} color={index === selected ? 'cyan' : 'white'}>
      {index === selected ? '› ' : '  '}{checked ? `[${checked.has(item.metadata.id) ? '×' : ' '}] ` : ''}{item.metadata.name} <Text dimColor>{item.metadata.repository}@{item.revision.commit.slice(0, 7)}</Text>
    </Text>;
  })}</Box>;
}
