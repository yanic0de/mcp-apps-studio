import fs from 'node:fs';
import path from 'node:path';

export interface DependencyFilter {
  root: string;
  /** True for local files a story was built from (fixtures, helpers), by absolute path. */
  isDependency: (absPath: string) => boolean;
}

/**
 * Story files, widget HTML and the local files stories import matter; our own temp story modules,
 * node_modules and dot-dirs do not.
 */
export function isRelevantChange(relPath: string, deps?: DependencyFilter): boolean {
  const segments = relPath.split(/[/\\]/);
  if (segments.some((s) => s === 'node_modules' || s.startsWith('.'))) return false;
  if (relPath.endsWith('.stories.mcp.ts') || relPath.endsWith('.html')) return true;
  return deps ? deps.isDependency(path.resolve(deps.root, relPath)) : false;
}

/** Recursively watches `root`; bursts of relevant changes call `onChange` once after `debounceMs`. */
export function watchProject(
  root: string,
  onChange: () => void,
  opts: { debounceMs?: number; isDependency?: (absPath: string) => boolean } = {},
): () => void {
  const deps = opts.isDependency ? { root, isDependency: opts.isDependency } : undefined;
  let timer: NodeJS.Timeout | undefined;
  let watcher: fs.FSWatcher;
  try {
    watcher = fs.watch(root, { recursive: true }, (_event, filename) => {
      if (!filename || !isRelevantChange(filename.toString(), deps)) return;
      clearTimeout(timer);
      timer = setTimeout(onChange, opts.debounceMs ?? 100);
    });
  } catch (err) {
    // Watching is a convenience: the studio still works with manual refreshes.
    console.warn(`File watching unavailable (${err instanceof Error ? err.message : String(err)}); refresh manually.`);
    return () => {};
  }
  watcher.on('error', () => {});
  return () => {
    clearTimeout(timer);
    watcher.close();
  };
}
