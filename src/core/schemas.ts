import {z} from 'zod';

export const revisionRefSchema = z.object({
  skillId: z.string().min(1),
  revision: z.string().startsWith('sha256:'),
});

export const deckSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  name: z.string().trim().min(1),
  skills: z.array(revisionRefSchema),
});

export const skillRevisionSchema = z.object({
  hash: z.string().startsWith('sha256:'),
  commit: z.string().min(7),
  importedAt: z.string().datetime(),
});

export const skillMetadataSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  sourceUrl: z.string().url(),
  repository: z.string().min(3),
  path: z.string(),
  revisions: z.array(skillRevisionSchema),
});

export const lockSkillSchema = z.object({
  name: z.string().min(1),
  skillId: z.string().min(1),
  revision: z.string().startsWith('sha256:'),
  installedHash: z.string().startsWith('sha256:'),
  owners: z.array(z.string().uuid()).min(1),
});

export const projectLockSchema = z.object({
  schemaVersion: z.literal(1),
  decks: z.array(z.object({id: z.string().uuid(), name: z.string().min(1)})),
  skills: z.array(lockSkillSchema),
});

export type Deck = z.infer<typeof deckSchema>;
export type SkillMetadata = z.infer<typeof skillMetadataSchema>;
export type SkillRevision = z.infer<typeof skillRevisionSchema>;
export type ProjectLock = z.infer<typeof projectLockSchema>;
export type LockSkill = z.infer<typeof lockSkillSchema>;

export const emptyLock = (): ProjectLock => ({schemaVersion: 1, decks: [], skills: []});
