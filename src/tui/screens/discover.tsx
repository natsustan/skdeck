import React from 'react';
import {Box, Text} from 'ink';
import type {DiscoveredSkill} from '../../core/github/discover.js';

export function DiscoverScreen({skills, cursor, selected}: {skills: DiscoveredSkill[]; cursor: number; selected: Set<string>}) {
  return <Box flexDirection="column" gap={1}>
    <Text bold>Import complete Skills from GitHub</Text>
    {skills.length === 0 ? <Text dimColor>Press i and enter a repository, skills directory, or single-Skill GitHub URL.</Text> : <Box flexDirection="column">
      <Text dimColor>Space selects · Enter imports · Esc discards checkout</Text>
      {skills.map((skill, index) => <Text key={skill.path} color={index === cursor ? 'cyan' : 'white'}>{index === cursor ? '›' : ' '} [{selected.has(skill.path) ? '×' : ' '}] {skill.name} <Text dimColor>{skill.path}</Text></Text>)}
    </Box>}
  </Box>;
}
