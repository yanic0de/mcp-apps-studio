import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addComponent } from './add.js';

let target: string;

beforeEach(async () => {
  target = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-add-'));
});

afterEach(() => fs.rm(target, { recursive: true, force: true }));

describe('addComponent', () => {
  it('copies registry component files into the target dir', async () => {
    const { copied } = await addComponent('kpi-card', target);
    expect(copied.length).toBeGreaterThanOrEqual(3);
    const names = await fs.readdir(path.join(target, 'kpi-card'));
    expect(names.sort()).toEqual(['KpiCard.tsx', 'fallback.ts', 'kpi-card.css']);
    const source = await fs.readFile(path.join(target, 'kpi-card', 'KpiCard.tsx'), 'utf8');
    expect(source).toContain('useToolCall');
  });

  it('rejects unknown components, listing available ones', async () => {
    await expect(addComponent('nope', target)).rejects.toThrow(/kpi-card.*data-table|data-table.*kpi-card/);
  });

  it('keeps files the user already has and reports them as skipped', async () => {
    await addComponent('kpi-card', target);
    const file = path.join(target, 'kpi-card', 'KpiCard.tsx');
    await fs.writeFile(file, '// my edits');
    const { copied, skipped } = await addComponent('kpi-card', target);
    expect(await fs.readFile(file, 'utf8')).toBe('// my edits');
    expect(skipped).toHaveLength(3);
    expect(copied).toEqual([]);
  });

  it('replaces existing files with force', async () => {
    await addComponent('kpi-card', target);
    const file = path.join(target, 'kpi-card', 'KpiCard.tsx');
    await fs.writeFile(file, '// my edits');
    const { copied, skipped } = await addComponent('kpi-card', target, { force: true });
    expect(await fs.readFile(file, 'utf8')).toContain('useToolCall');
    expect(skipped).toEqual([]);
    expect(copied).toContain(file);
  });
});
