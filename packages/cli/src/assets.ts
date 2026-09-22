import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Assets {
  /** Built studio SPA (contains index.html when built). */
  studioDist: string;
  /** Directory holding registry.json and the component sources it lists. */
  registryRoot: string;
}

/**
 * Installed package: `dist/studio` and `dist/registry` sit next to the bundled CLI.
 * Development (running src/ via tsx): the workspace packages `@studio/app` and `@studio/components`.
 */
export function locateAssets(moduleUrl: string = import.meta.url): Assets {
  const here = path.dirname(fileURLToPath(moduleUrl));
  const bundledStudio = path.join(here, 'studio');
  const bundledRegistry = path.join(here, 'registry');
  const require = createRequire(import.meta.url);
  const workspace = (pkg: string) => path.dirname(require.resolve(`${pkg}/package.json`));
  return {
    studioDist: fs.existsSync(path.join(bundledStudio, 'index.html'))
      ? bundledStudio
      : path.join(workspace('@studio/app'), 'dist'),
    registryRoot: fs.existsSync(path.join(bundledRegistry, 'registry.json'))
      ? bundledRegistry
      : workspace('@studio/components'),
  };
}
