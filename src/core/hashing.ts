import {createHash} from 'node:crypto';
import {chmod, copyFile, lstat, mkdir, readdir, readFile} from 'node:fs/promises';
import {join, relative, sep} from 'node:path';

interface Entry { absolute: string; relative: string; type: 'directory' | 'file'; executable: boolean }

async function filesIn(root: string, directory = root): Promise<Entry[]> {
  const entries = await readdir(directory, {withFileTypes: true});
  const files: Entry[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = join(directory, entry.name);
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Skill contains a symbolic link: ${relative(root, absolute)}`);
    const relativePath = relative(root, absolute).split(sep).join('/');
    if (stat.isDirectory()) {
      files.push({absolute, relative: relativePath, type: 'directory', executable: false});
      files.push(...await filesIn(root, absolute));
    }
    else if (stat.isFile()) files.push({absolute, relative: relativePath, type: 'file', executable: (stat.mode & 0o111) !== 0});
    else throw new Error(`Skill contains an unsupported file: ${relative(root, absolute)}`);
  }
  return files;
}

export async function hashDirectory(root: string): Promise<string> {
  const hash = createHash('sha256');
  for (const file of await filesIn(root)) {
    hash.update(`${file.type}\0${file.relative}\0${file.executable ? 'x' : '-'}\0`);
    if (file.type === 'file') {
      const content = await readFile(file.absolute);
      hash.update(`${content.length}\0`);
      hash.update(content);
    }
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

export async function copyDirectory(source: string, destination: string): Promise<void> {
  await mkdir(destination, {recursive: true});
  for (const file of await filesIn(source)) {
    const target = join(destination, ...file.relative.split('/'));
    if (file.type === 'directory') { await mkdir(target, {recursive: true}); continue; }
    await mkdir(join(target, '..'), {recursive: true});
    await copyFile(file.absolute, target);
    await chmod(target, file.executable ? 0o755 : 0o644);
  }
}

export function revisionDirectoryName(hash: string): string {
  return hash.replace('sha256:', '');
}
