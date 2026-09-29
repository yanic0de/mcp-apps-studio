import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Assets {
  /** Built studio SPA (contains index.html when built). */
  studioDist: string;
  /** Directory holding registry.json and the component sources it lists. */
  registryRoot: string;
  /**
   * `bundled`: installed package; `workspace`: running src/ in the monorepo (the studio may still need a
   * build); `missing`: neither — a broken install, the paths point at where the bundle should be.
   */
  source: 'bundled' | 'workspace' | 'missing';
}

const defaultResolveWorkspace = (pkg: string) =>
  path.dirname(createRequire(import.meta.url).resolve(`${pkg}/package.json`));

/**
 * Installed package: `dist/studio` and `dist/registry` sit next to the bundled CLI.
 * Development (running src/ via tsx): the workspace packages `@studio/app` and `@studio/components`.
 */
export function locateAssets(
  moduleUrl: string = import.meta.url,
  resolveWorkspace: (pkg: string) => string = defaultResolveWorkspace,
): Assets {
  const here = path.dirname(fileURLToPath(moduleUrl));
  const bundled = { studioDist: path.join(here, 'studio'), registryRoot: path.join(here, 'registry') };
  if (fs.existsSync(path.join(bundled.studioDist, 'index.html'))) {
    return { ...bundled, source: 'bundled' };
  }
  try {
    return {
      studioDist: path.join(resolveWorkspace('@studio/app'), 'dist'),
      registryRoot: fs.existsSync(path.join(bundled.registryRoot, 'registry.json'))
        ? bundled.registryRoot
        : resolveWorkspace('@studio/components'),
      source: 'workspace',
    };
  } catch (err) {
    // Outside the monorepo the workspace packages do not exist: report, do not crash.
    if ((err as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') throw err;
    return { ...bundled, source: 'missing' };
  }
}
