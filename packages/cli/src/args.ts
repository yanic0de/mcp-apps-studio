import { parseArgs } from 'node:util';
import type { Theme } from './test-plan.js';

/**
 * Pure argument parsing for the `mcp-apps-studio` bin: no I/O, so every rule is unit-tested.
 * Commands, flags and help text come from one table so help cannot drift from what is accepted.
 */

export type Command =
  | { name: 'start'; dir: string | undefined; port: number; token: string | undefined }
  | {
      name: 'test';
      dir: string | undefined;
      out: string;
      themes: Theme[];
      updateSnapshots: boolean;
      snapshots: string | undefined;
      threshold: number;
      maxDiffPixels: number;
    }
  | { name: 'init'; files: string[]; tool: string | undefined }
  | { name: 'add'; component: string | undefined; dir: string; force: boolean }
  | { name: 'install-browser'; withDeps: boolean };

export type Cli =
  | { kind: 'run'; command: Command }
  | { kind: 'help'; text: string }
  | { kind: 'version' }
  | { kind: 'error'; message: string };

type CommandName = Command['name'];

interface Flag {
  type: 'string' | 'boolean';
  short?: string;
  /** Placeholder shown in help, e.g. `<n>`. */
  value?: string;
  description: string;
  /** Automation-only flags stay out of help. */
  hidden?: boolean;
}

interface CommandSpec {
  usage: string;
  summary: string;
  flags: Record<string, Flag>;
}

const helpFlag: Flag = { type: 'boolean', short: 'h', description: 'Show this help' };

const COMMANDS: Record<CommandName, CommandSpec> = {
  start: {
    usage: 'mcp-apps-studio [dir] [options]',
    summary: 'Serve the studio over the *.stories.mcp.ts files under dir (default: current directory)',
    flags: {
      port: { type: 'string', value: '<n>', description: 'Port on 127.0.0.1 (default 4400)' },
      token: { type: 'string', value: '<token>', description: 'Fixed access token', hidden: true },
      help: helpFlag,
    },
  },
  test: {
    usage: 'mcp-apps-studio test [dir] [options]',
    summary: 'Run every story × theme in headless Chromium; exit 1 on any failure',
    flags: {
      out: { type: 'string', value: '<dir>', description: 'Screenshots and reports (default .mcp-studio/test)' },
      themes: { type: 'string', value: '<list>', description: 'Comma-separated themes (default light,dark)' },
      'update-snapshots': { type: 'boolean', description: 'Write baselines from passing runs instead of comparing' },
      snapshots: { type: 'string', value: '<dir>', description: 'Baseline directory (default mcp-studio-snapshots)' },
      threshold: { type: 'string', value: '<0..1>', description: 'Per-pixel color tolerance (default 0.1)' },
      'max-diff-pixels': { type: 'string', value: '<n>', description: 'Differing pixels still accepted (default 0)' },
      help: helpFlag,
    },
  },
  init: {
    usage: 'mcp-apps-studio init [widget.html…] [options]',
    summary: 'Scaffold a story next to each widget (default: every MCP Apps widget HTML found)',
    flags: {
      tool: { type: 'string', value: '<name>', description: 'Tool name used in the scenarios (default my_tool)' },
      help: helpFlag,
    },
  },
  add: {
    usage: 'mcp-apps-studio add <component> [options]',
    summary: 'Copy a library component into your project (existing files are kept)',
    flags: {
      dir: { type: 'string', value: '<dir>', description: 'Target directory (default src/components)' },
      force: { type: 'boolean', description: 'Replace files that already exist' },
      help: helpFlag,
    },
  },
  'install-browser': {
    usage: 'mcp-apps-studio install-browser [options]',
    summary: 'Install the Chromium build matching the bundled Playwright (needed by test)',
    flags: {
      'with-deps': { type: 'boolean', description: 'Also install system dependencies (Linux CI)' },
      help: helpFlag,
    },
  },
};

const SUBCOMMANDS = ['test', 'init', 'add', 'install-browser'] as const;
const isSubcommand = (s: string | undefined): s is (typeof SUBCOMMANDS)[number] =>
  (SUBCOMMANDS as readonly (string | undefined)[]).includes(s);

const flagLines = (flags: Record<string, Flag>) =>
  Object.entries(flags)
    .filter(([, f]) => !f.hidden)
    .map(([name, f]) => {
      const left = `${f.short ? `-${f.short}, ` : ''}--${name}${f.value ? ` ${f.value}` : ''}`;
      return `  ${left.padEnd(28)}${f.description}`;
    });

function commandHelp(name: CommandName): string {
  const spec = COMMANDS[name];
  return [`Usage: ${spec.usage}`, '', spec.summary, '', 'Options:', ...flagLines(spec.flags)].join('\n');
}

function generalHelp(): string {
  const commands = SUBCOMMANDS.map((c) => `  ${c.padEnd(18)}${COMMANDS[c].summary}`);
  return [
    'MCP Apps Studio — Storybook + Playwright for MCP Apps widgets',
    '',
    `Usage: ${COMMANDS.start.usage}`,
    `       mcp-apps-studio <command> [options]`,
    '',
    COMMANDS.start.summary,
    '',
    'Commands:',
    ...commands,
    '',
    'Options:',
    ...flagLines(COMMANDS.start.flags),
    `  ${'-v, --version'.padEnd(28)}Print the version`,
    '',
    'Run `mcp-apps-studio <command> --help` for the options of a command.',
  ].join('\n');
}

/** A user-facing failure: printed as one `error: …` line, exit 1, never with a stack. */
export class CliError extends Error {}

/** Turns node:util parseArgs errors into one line naming the flag. */
function parseFlags(name: CommandName, argv: string[]) {
  const options = Object.fromEntries(
    Object.entries(COMMANDS[name].flags).map(([flag, f]) => [
      flag,
      f.short ? { type: f.type, short: f.short } : { type: f.type },
    ]),
  );
  try {
    return parseArgs({ args: argv, options, strict: true, allowPositionals: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    const message = err instanceof Error ? err.message : String(err);
    const flag = message.match(/'(-[^' ]+)/)?.[1];
    if (code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') throw new CliError(`unknown option ${flag} for ${name}`);
    if (code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE') throw new CliError(`${flag} needs a value`);
    if (code?.startsWith('ERR_PARSE_ARGS_')) throw new CliError(message);
    throw err;
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

function number(flag: string, raw: string | undefined, fallback: number, check: (n: number) => boolean): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (raw.trim() === '' || !Number.isFinite(n) || !check(n)) throw new CliError(`invalid ${flag} value: ${raw}`);
  return n;
}

function atMostOne(positionals: string[], what: string): string | undefined {
  if (positionals.length > 1) throw new CliError(`expected one ${what}, got: ${positionals.join(' ')}`);
  return positionals[0];
}

function build(name: CommandName, values: Record<string, unknown>, positionals: string[]): Command {
  switch (name) {
    case 'start': {
      const token = str(values.token);
      // The token is the only thing between a local page and the studio API: no guessable values.
      if (token !== undefined && !/^[A-Za-z0-9_-]{32,}$/.test(token)) {
        throw new CliError('invalid --token value: use at least 32 characters from [A-Za-z0-9_-]');
      }
      return {
        name,
        dir: atMostOne(positionals, 'project directory'),
        port: number('--port', str(values.port), 4400, (n) => Number.isInteger(n) && n >= 1 && n <= 65535),
        token,
      };
    }
    case 'test': {
      const rawThemes = str(values.themes);
      const themes = rawThemes === undefined ? ['light', 'dark'] : rawThemes.split(',').filter(Boolean);
      if (themes.length === 0 || themes.some((t) => t !== 'light' && t !== 'dark')) {
        throw new CliError(`invalid --themes value: ${rawThemes} (use light,dark)`);
      }
      return {
        name,
        dir: atMostOne(positionals, 'project directory'),
        out: str(values.out) ?? '.mcp-studio/test',
        themes: themes as Theme[],
        updateSnapshots: values['update-snapshots'] === true,
        snapshots: str(values.snapshots),
        threshold: number('--threshold', str(values.threshold), 0.1, (n) => n >= 0 && n <= 1),
        maxDiffPixels: number(
          '--max-diff-pixels',
          str(values['max-diff-pixels']),
          0,
          (n) => Number.isInteger(n) && n >= 0,
        ),
      };
    }
    case 'init':
      return { name, files: positionals, tool: str(values.tool) };
    case 'add':
      return {
        name,
        component: atMostOne(positionals, 'component'),
        dir: str(values.dir) ?? 'src/components',
        force: values.force === true,
      };
    case 'install-browser':
      if (positionals.length > 0) throw new CliError(`install-browser takes no arguments, got: ${positionals[0]}`);
      return { name, withDeps: values['with-deps'] === true };
  }
}

export function parseCli(argv: string[]): Cli {
  const [first, ...rest] = argv;
  if (first === '--version' || first === '-v') return { kind: 'version' };
  if (first === '--help' || first === '-h') return { kind: 'help', text: generalHelp() };
  if (first === 'help') {
    const topic = rest[0];
    if (topic === undefined) return { kind: 'help', text: generalHelp() };
    if (!isSubcommand(topic)) return { kind: 'error', message: `unknown command: ${topic}` };
    return { kind: 'help', text: commandHelp(topic) };
  }
  const name: CommandName = isSubcommand(first) ? first : 'start';
  const args = name === 'start' ? argv : rest;
  try {
    const { values, positionals } = parseFlags(name, args);
    if (values.help === true) return { kind: 'help', text: name === 'start' ? generalHelp() : commandHelp(name) };
    return { kind: 'run', command: build(name, values, positionals) };
  } catch (err) {
    if (err instanceof CliError) return { kind: 'error', message: err.message };
    throw err;
  }
}
