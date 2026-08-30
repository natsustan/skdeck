import React from 'react';
import {Box, Text} from 'ink';

export function PlanView({items}: {items: Array<{action: string; name: string; detail: string}>}) {
  if (items.length === 0) return <Text dimColor>No changes.</Text>;
  return <Box flexDirection="column">{items.map(item => <Text key={`${item.action}:${item.name}`} color={item.action === 'CONFLICT' || item.action === 'REMOVE' ? 'red' : item.action === 'ADD' ? 'green' : 'yellow'}>
    {item.action.padEnd(9)} <Text color="white">{item.name}</Text> <Text dimColor>— {item.detail}</Text>
  </Text>)}</Box>;
}
