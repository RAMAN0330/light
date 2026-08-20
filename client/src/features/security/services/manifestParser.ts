import type { ManifestPackage } from './osv';

interface SourceFile { name: string; content?: string }

export function extractManifestDependencies(files: SourceFile[]): ManifestPackage[] {
  return files.flatMap(file => {
    if (!file.content) return [];
    if (file.name === 'package.json') {
      try {
        const manifest = JSON.parse(file.content) as { dependencies?: Record<string, string> };
        return Object.entries(manifest.dependencies ?? {}).flatMap(([name, range]) => {
          const version = range.replace(/^[^0-9]*/, '');
          return version ? [{ name, version, ecosystem: 'npm' }] : [];
        });
      } catch { return []; }
    }
    const specs: Array<[RegExp, string]> = file.name === 'requirements.txt'
      ? [[/^([A-Za-z0-9_.-]+)[=~<>!]+([0-9][^\s;]*)/, 'PyPI']]
      : file.name === 'go.mod'
        ? [[/^([^\s]+)\s+v([0-9][^\s]*)/, 'Go']]
        : file.name === 'Gemfile.lock'
          ? [[/^([A-Za-z0-9_-]+)\s+\(([0-9][^)]*)\)/, 'RubyGems']]
          : [];
    return file.content.split('\n').flatMap(line => {
      const match = line.trim().match(specs[0]?.[0]);
      return match ? [{ name: match[1], version: match[2], ecosystem: specs[0][1] }] : [];
    });
  });
}
