import fs from 'node:fs';

/** Story files and widget HTML matter; our own temp story modules, node_modules and dot-dirs do not. */
export function isRelevantChange(relPath: string): boolean {
  const segments = relPath.split(/[/\\]/);
  if (segments.some((s) => s === 'node_modules' || s.startsWith('.'))) return false;
  return relPath.endsWith('.stories.mcp.ts') || relPath.endsWith('.html');
}

/** Recursively watches `root`; bursts of relevant changes call `onChange` once after `debounceMs`. */
export function watchProject(root: string, onChange: () => void, opts: { debounceMs?: number } = {}): () => void {
  let timer: NodeJS.Timeout | undefined;
  let watcher: fs.FSWatcher;
  try {
    watcher = fs.watch(root, { recursive: true }, (_event, filename) => {
      if (!filename || !isRelevantChange(filename.toString())) return;
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
