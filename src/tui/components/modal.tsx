import React from 'react';
import {Box, Text} from 'ink';

export function Modal({title, value, hint}: {title: string; value: string; hint: string | undefined}) {
  return <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column">
    <Text bold>{title}</Text>
    <Text>{value}<Text inverse> </Text></Text>
    <Text dimColor>{hint ?? 'Enter confirm · Esc cancel'}</Text>
  </Box>;
}
