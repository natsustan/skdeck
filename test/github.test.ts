import {describe, expect, test} from 'bun:test';
import {parseGitHubUrl} from '../src/core/github/parse-url.js';

describe('parseGitHubUrl', () => {
  test('parses repository and tree URLs', () => {
    expect(parseGitHubUrl('https://github.com/acme/skills')).toMatchObject({owner: 'acme', repository: 'skills', treeTail: []});
    expect(parseGitHubUrl('https://github.com/acme/skills/tree/feat/ui/skills/macos').treeTail).toEqual(['feat', 'ui', 'skills', 'macos']);
  });

  test('rejects unsupported hosts and blob URLs', () => {
    expect(() => parseGitHubUrl('https://gitlab.com/acme/skills')).toThrow('Only github.com');
    expect(() => parseGitHubUrl('https://github.com/acme/skills/blob/main/SKILL.md')).toThrow('/tree/ref/path');
  });
});
