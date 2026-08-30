import React from 'react';
import {Box, Text} from 'ink';
import {PlanView} from './plan-view.js';

export function PlanModal({kind, deckName, items}: {kind: 'apply' | 'remove'; deckName: string; items: Array<{action: string; name: string; detail: string}>}) {
  const blocked = items.some(item => item.action === 'CONFLICT');
  return <Box borderStyle="round" borderColor={blocked ? 'red' : 'cyan'} paddingX={1} flexDirection="column">
    <Text bold>{kind === 'apply' ? 'Apply' : 'Remove'} “{deckName}”?</Text>
    <PlanView items={items}/>
    <Text dimColor>{blocked ? 'Resolve conflicts before continuing · Esc cancel' : 'Enter confirm · Esc cancel'}</Text>
  </Box>;
}
