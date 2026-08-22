const API_ROOT = 'https://api.github.com';

function headers(token?: string): Record<string, string> {
  const result: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'CodeFlow-App',
  };
  if (token) result.Authorization = `token ${token}`;
  return result;
}

async function githubJson(path: string, token?: string): Promise<unknown> {
  const response = await fetch(`${API_ROOT}${path}`, { headers: headers(token) });
  if (!response.ok) throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  return response.json();
}

export function fetchRepositoryTree(owner: string, repo: string, token?: string) {
  return githubJson(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/HEAD?recursive=1`, token);
}

export function fetchUserRepositories(token: string) {
  return githubJson('/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator', token);
}
