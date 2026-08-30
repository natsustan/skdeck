import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execa} from 'execa';
import {parseGitHubUrl} from './parse-url.js';

export interface Checkout {
  directory: string;
  sourceDirectory: string;
  owner: string;
  repository: string;
  sourceUrl: string;
  skillPath: string;
  commit: string;
  cleanup(): Promise<void>;
}

function remoteRefs(output: string): string[] {
  return output.split('\n').map(line => line.split('\t')[1]).filter((value): value is string => Boolean(value))
    .flatMap(ref => ref.startsWith('refs/heads/') ? [ref.slice(11)] : ref.startsWith('refs/tags/') && !ref.endsWith('^{}') ? [ref.slice(10)] : []);
}

async function splitRef(cloneUrl: string, tail: string[]): Promise<{ref: string; path: string}> {
  if (tail.length === 0) return {ref: '', path: ''};
  const {stdout} = await execa('git', ['ls-remote', '--heads', '--tags', cloneUrl]);
  const refs = remoteRefs(stdout).sort((a, b) => b.length - a.length);
  const joined = tail.join('/');
  const ref = refs.find(candidate => joined === candidate || joined.startsWith(`${candidate}/`));
  if (ref) return {ref, path: joined === ref ? '' : joined.slice(ref.length + 1)};
  if (/^[0-9a-f]{7,40}$/i.test(tail[0]!)) return {ref: tail[0]!, path: tail.slice(1).join('/')};
  throw new Error(`Cannot resolve a branch or tag from: ${joined}`);
}

export async function checkoutGitHub(input: string): Promise<Checkout> {
  const parsed = parseGitHubUrl(input);
  const temporary = await mkdtemp(join(tmpdir(), 'skdeck-'));
  const repositoryDirectory = join(temporary, 'repository');
  try {
    const resolved = await splitRef(parsed.cloneUrl, parsed.treeTail);
    if (resolved.ref) {
      await execa('git', ['clone', '--no-checkout', '--filter=blob:none', parsed.cloneUrl, repositoryDirectory]);
      await execa('git', ['fetch', '--depth', '1', 'origin', resolved.ref], {cwd: repositoryDirectory});
      await execa('git', ['checkout', '--detach', 'FETCH_HEAD'], {cwd: repositoryDirectory});
    } else {
      await execa('git', ['clone', '--depth', '1', parsed.cloneUrl, repositoryDirectory]);
    }
    const {stdout: commit} = await execa('git', ['rev-parse', 'HEAD'], {cwd: repositoryDirectory});
    return {
      directory: repositoryDirectory,
      sourceDirectory: join(repositoryDirectory, ...resolved.path.split('/').filter(Boolean)),
      owner: parsed.owner,
      repository: parsed.repository,
      sourceUrl: input,
      skillPath: resolved.path,
      commit,
      cleanup: () => rm(temporary, {recursive: true, force: true}),
    };
  } catch (error) {
    await rm(temporary, {recursive: true, force: true});
    throw error;
  }
}
