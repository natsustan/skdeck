import React from 'react';
import {Box, Text} from 'ink';

const pages = ['Discover', 'Library', 'Decks', 'Project'];

export function Navigation({active}: {active: number}) {
  return <Box gap={2}>{pages.map((page, index) => <Text key={page} bold={index === active} color={index === active ? 'cyan' : 'white'}>{index + 1} {page}</Text>)}</Box>;
}
