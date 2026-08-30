import {mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
import type {ZodType} from 'zod';

export function dataRoot(env: NodeJS.ProcessEnv = process.env): string {
  if (env.SKDECK_HOME) return env.SKDECK_HOME;
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'skdeck');
  if (process.platform === 'win32') return join(env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'skdeck');
  return join(env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), 'skdeck');
}

export async function readJson<T>(path: string, schema: ZodType<T>): Promise<T> {
  try {
    return schema.parse(JSON.parse(await readFile(path, 'utf8')));
  } catch (error) {
    throw new Error(`Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`, {cause: error});
  }
}

export async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), {recursive: true});
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
  try {
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, {force: true});
    throw error;
  }
}
