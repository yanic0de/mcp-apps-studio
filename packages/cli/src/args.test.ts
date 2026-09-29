import { describe, expect, it } from 'vitest';
import { type Cli, parseCli } from './args.js';

const TOKEN = 'a'.repeat(32);

const run = (argv: string[]) => {
  const cli = parseCli(argv);
  if (cli.kind !== 'run') throw new Error(`expected run, got ${JSON.stringify(cli)}`);
  return cli.command;
};
const error = (argv: string[]) => {
  const cli = parseCli(argv);
  if (cli.kind !== 'error') throw new Error(`expected error, got ${JSON.stringify(cli)}`);
  return cli.message;
};
const help = (argv: string[]) => {
  const cli: Cli = parseCli(argv);
  if (cli.kind !== 'help') throw new Error(`expected help, got ${JSON.stringify(cli)}`);
  return cli.text;
};

describe('parseCli: start (default command)', () => {
  it('defaults', () => {
    expect(run([])).toEqual({ name: 'start', dir: undefined, port: 4400, token: undefined });
  });

  it('takes a project dir, port and an automation token', () => {
    expect(run(['proj', '--port', '4500', '--token', TOKEN])).toEqual({
      name: 'start',
      dir: 'proj',
      port: 4500,
      token: TOKEN,
    });
    expect(run(['--port=4501']).name).toBe('start');
  });

  it.each([['0'], ['70000'], ['12.5'], ['abc']])('rejects --port %s', (port) => {
    expect(error(['--port', port])).toContain('--port');
  });

  it.each([['abc'], ['a'.repeat(31)], [`${'a'.repeat(31)}!`]])('rejects a weak --token %s', (token) => {
    expect(error(['--token', token])).toContain('--token');
  });

  it('rejects unknown flags and a second directory', () => {
    expect(error(['--prot', '1'])).toContain('--prot');
    expect(error(['a', 'b'])).toMatch(/one project directory/);
  });
});

describe('parseCli: test', () => {
  it('defaults', () => {
    expect(run(['test'])).toEqual({
      name: 'test',
      dir: undefined,
      out: '.mcp-studio/test',
      themes: ['light', 'dark'],
      updateSnapshots: false,
      snapshots: undefined,
      threshold: 0.1,
      maxDiffPixels: 0,
    });
  });

  it('takes every flag', () => {
    expect(
      run([
        'test',
        'widgets',
        '--out',
        'o',
        '--themes',
        'dark',
        '--update-snapshots',
        '--snapshots',
        's',
        '--threshold',
        '0.2',
        '--max-diff-pixels',
        '5',
      ]),
    ).toEqual({
      name: 'test',
      dir: 'widgets',
      out: 'o',
      themes: ['dark'],
      updateSnapshots: true,
      snapshots: 's',
      threshold: 0.2,
      maxDiffPixels: 5,
    });
  });

  it('names an unknown flag', () => {
    const message = error(['test', '--theme', 'dark']);
    expect(message).toContain('--theme');
  });

  it('names a flag without its value, also when the next token is a flag', () => {
    expect(error(['test', '--out'])).toContain('--out');
    expect(error(['test', '--out', '--themes', 'dark'])).toContain('--out');
  });

  it.each([
    [['--themes', 'sepia'], '--themes'],
    [['--themes', ''], '--themes'],
    [['--threshold', '2'], '--threshold'],
    [['--max-diff-pixels', '-1'], '--max-diff-pixels'],
    [['--max-diff-pixels', '1.5'], '--max-diff-pixels'],
  ])('rejects %j', (flags, flag) => {
    expect(error(['test', ...flags])).toContain(flag);
  });
});

describe('parseCli: init, add, install-browser', () => {
  it('init takes widget files and a tool', () => {
    expect(run(['init', 'a.html', 'b.html', '--tool', 'weather'])).toEqual({
      name: 'init',
      files: ['a.html', 'b.html'],
      tool: 'weather',
    });
  });

  it('add takes a component, dir and force', () => {
    expect(run(['add', 'kpi-card', '--dir', 'src/w', '--force'])).toEqual({
      name: 'add',
      component: 'kpi-card',
      dir: 'src/w',
      force: true,
    });
    expect(run(['add'])).toMatchObject({ name: 'add', component: undefined, dir: 'src/components', force: false });
  });

  it('install-browser takes --with-deps only', () => {
    expect(run(['install-browser', '--with-deps'])).toEqual({ name: 'install-browser', withDeps: true });
    expect(error(['install-browser', 'chromium'])).toContain('chromium');
  });
});

describe('parseCli: help and version', () => {
  it.each([[['--help']], [['-h']], [['help']]])('%j prints general usage listing every command', (argv) => {
    const text = help(argv);
    for (const cmd of ['test', 'init', 'add', 'install-browser']) expect(text).toContain(cmd);
  });

  it('keeps automation-only flags out of help', () => {
    expect(help(['--help'])).not.toContain('--token');
  });

  it.each([[['test', '--help']], [['test', '-h']], [['help', 'test']]])('%j prints the test flags', (argv) => {
    const text = help(argv);
    for (const flag of ['--out', '--themes', '--update-snapshots', '--snapshots', '--threshold', '--max-diff-pixels'])
      expect(text).toContain(flag);
  });

  it('help for an unknown command is an error', () => {
    expect(error(['help', 'nope'])).toContain('nope');
  });

  it.each([[['--version']], [['-v']]])('%j asks for the version', (argv) => {
    expect(parseCli(argv)).toEqual({ kind: 'version' });
  });
});
