export interface GitHubUrl {
  owner: string;
  repository: string;
  treeTail: string[];
  cloneUrl: string;
  canonicalUrl: string;
}

export function parseGitHubUrl(input: string): GitHubUrl {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Enter a complete GitHub URL, for example https://github.com/owner/repo.');
  }
  if (url.hostname.toLowerCase() !== 'github.com') throw new Error('Only github.com URLs are supported.');
  const parts = url.pathname.split('/').filter(Boolean).map(part => {
    const decoded = decodeURIComponent(part);
    if (decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\')) {
      throw new Error('The GitHub URL contains an invalid path segment.');
    }
    return decoded;
  });
  if (parts.length < 2) throw new Error('The GitHub URL must include an owner and repository.');
  const owner = parts[0]!;
  const repository = parts[1]!.replace(/\.git$/, '');
  const rest = parts.slice(2);
  if (rest.length > 0 && rest[0] !== 'tree') throw new Error('Use a repository URL or a GitHub /tree/ref/path URL.');
  if (rest[0] === 'tree' && rest.length < 2) throw new Error('The GitHub tree URL is missing its ref.');
  return {
    owner,
    repository,
    treeTail: rest[0] === 'tree' ? rest.slice(1) : [],
    cloneUrl: `https://github.com/${owner}/${repository}.git`,
    canonicalUrl: `https://github.com/${owner}/${repository}`,
  };
}
