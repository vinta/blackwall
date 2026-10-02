#!/usr/bin/env node
import { SandboxManager, SandboxRuntimeConfigSchema } from '@anthropic-ai/sandbox-runtime';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { parseEnv } from 'node:util';

const USAGE = 'usage: blackwall [--add-dir DIR]... [--print-config | --print-default-config] [--] <command> [args...]';
const HOME = homedir();
const PROFILE = `${HOME}/.claude-blackwall`;
// Copied into the profile on every launch rather than linked, so a sandboxed run can change only its copies, never ~/.claude
const SHARED = ['CLAUDE.md', 'rules', 'skills', 'agents', 'commands', 'output-styles'];
// Private to blackwall runs: host tools later execute what lands in a package cache
const CACHE = `${HOME}/.cache/blackwall`;
const CONFIG = `${HOME}/.blackwall/config.json`;
// Runs unsandboxed on the next launch, so it must stay outside every allowWrite path, unlike CACHE or the package folder
const SIGNED_NODE = `${HOME}/.blackwall/blackwall_node`;

// A 1Password Environments mount (a FIFO) or a hand-made file. Loaded before the re-exec below so it can set BLACKWALL_* keys; the signed copy inherits the values, since a second read of a FIFO may prompt again
if (basename(process.execPath) !== basename(SIGNED_NODE)) {
  try {
    Object.assign(process.env, parseEnv(readFileSync(`${HOME}/.blackwall/.env`, 'utf8')));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
// An ad-hoc-signed node copy gets its own code identity, so a firewall rule for blackwall doesn't cover every node script
if (process.env.BLACKWALL_USE_SELF_SIGNED_NODE === '1' && basename(process.execPath) !== basename(SIGNED_NODE)) {
  if (!existsSync(SIGNED_NODE)) {
    mkdirSync(dirname(SIGNED_NODE), { recursive: true });
    // Signed under a temp name, so an interrupted run can't leave a broken copy that counts as present
    const temp = `${SIGNED_NODE}.tmp`;
    copyFileSync(process.execPath, temp);
    execFileSync('codesign', ['-f', '-s', '-', temp]);
    renameSync(temp, SIGNED_NODE);
  }
  process.execve(SIGNED_NODE, [SIGNED_NODE, ...process.execArgv, ...process.argv.slice(1)]);
}
// Explained in the README; also the shape a user config must match
const DEFAULTS = JSON.parse(readFileSync(new URL('../configs/default-config.json', import.meta.url), 'utf8'));

const args = process.argv.slice(2);
const addDirs = [];
let printConfig = false;
for (;;) {
  if (args[0] === '--add-dir') {
    args.shift();
    if (!args[0]) exitWithUsage();
    addDirs.push(resolve(args.shift()));
  } else if (args[0] === '--print-config') {
    args.shift();
    printConfig = true;
  } else if (args[0] === '--print-default-config') {
    console.log(JSON.stringify(DEFAULTS, null, 2));
    process.exit(0);
  } else {
    break;
  }
}
if (args[0] === '--') args.shift();
if (!args[0] && !printConfig) exitWithUsage();

function exitWithUsage() {
  console.error(USAGE);
  process.exit(2);
}

function readUserConfig() {
  let user;
  try {
    user = JSON.parse(readFileSync(CONFIG, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { additions: {}, overrides: {}, presets: [] };
    throw error;
  }
  checkShape(user, { ...DEFAULTS, overrideDefaults: {} }, '', true, ['overrideDefaults']);
  const { overrideDefaults: overrides = {}, presets = [], ...additions } = user;
  checkShape(overrides, DEFAULTS, 'overrideDefaults.', false);
  return { additions, overrides, presets };
}

// A preset has the shape of the top-level lists in a user config
function readPreset(name) {
  try {
    return JSON.parse(readFileSync(new URL(`../configs/presets/${name}.json`, import.meta.url), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') exitWithConfigError(`unknown preset ${name}`);
    throw error;
  }
}

// Keys and types mirror default-config.json: a misspelled key would otherwise drop its paths without a word, and a string would spread into characters
function checkShape(value, shape, prefix, listsOnly, skip = []) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    exitWithConfigError(`${prefix.slice(0, -1) || 'the file'} must be an object`);
  }
  for (const [key, item] of Object.entries(value)) {
    if (skip.includes(key)) continue;
    const name = `${prefix}${key}`;
    if (!Object.hasOwn(shape, key)) exitWithConfigError(`unknown key ${name}`);
    const expected = shape[key];
    if (Array.isArray(expected)) {
      if (!Array.isArray(item) || !item.every((entry) => typeof entry === 'string')) {
        exitWithConfigError(`${name} must be a list of strings`);
      }
    } else if (typeof expected === 'object') {
      checkShape(item, expected, `${name}.`, listsOnly);
    } else if (listsOnly) {
      exitWithConfigError(`${name} can only be set under overrideDefaults`);
    } else if (typeof item !== typeof expected) {
      exitWithConfigError(`${name} must be a ${typeof expected}`);
    }
  }
}

function exitWithConfigError(message) {
  console.error(`blackwall: ${CONFIG}: ${message}`);
  process.exit(2);
}

// Only claude gets the profile
const isClaude = args[0] !== undefined && basename(args[0]) === 'claude';

// overrideDefaults replaces default values, then the presets and the top-level lists are added on top
const { additions, overrides, presets } = readUserConfig();
// presets is blackwall's own key, so it never reaches srt
const { presets: basePresets, ...base } = {
  ...DEFAULTS,
  ...overrides,
  network: { ...DEFAULTS.network, ...overrides.network },
  filesystem: { ...DEFAULTS.filesystem, ...overrides.filesystem },
};
// mac and claude aren't in the presets list, so overriding it can't drop them
const automatic = [...(process.platform === 'darwin' ? ['mac'] : []), ...(isClaude ? ['claude'] : [])];
const layers = [...new Set([...automatic, ...basePresets, ...presets])].map(readPreset);
layers.push(additions);
const expandPath = (path) => resolve(path.replace(/^~(?=\/|$)/, HOME));
if (!base.filesystem.denyRead.some((path) => `${HOME}/`.startsWith(`${expandPath(path)}/`.replace('//', '/')))) {
  console.warn(`blackwall: overrideDefaults.filesystem.denyRead in ${CONFIG} no longer denies ~/, so your home directory is readable`);
}
const added = (section, key) => layers.flatMap((layer) => layer[section]?.[key] ?? []);

const cwd = process.cwd();
const config = {
  ...base,
  network: {
    allowedDomains: [...base.network.allowedDomains, ...added('network', 'allowedDomains')],
    deniedDomains: [...base.network.deniedDomains, ...added('network', 'deniedDomains')],
  },
  filesystem: {
    denyRead: [...base.filesystem.denyRead, ...added('filesystem', 'denyRead')],
    allowRead: [cwd, ...addDirs, ...base.filesystem.allowRead, CACHE, ...added('filesystem', 'allowRead')],
    allowWrite: [cwd, ...addDirs, ...base.filesystem.allowWrite, '/private/tmp', CACHE, ...added('filesystem', 'allowWrite')],
    // srt's built-in denies anchor on cwd only
    denyWrite: [...base.filesystem.denyWrite, ...addDirs.flatMap((dir) => [`${dir}/.git/hooks`, `${dir}/.git/config`]), ...added('filesystem', 'denyWrite')],
  },
};

if (isClaude) {
  config.filesystem.allowRead.push(PROFILE, '~/.claude/plugins');
  config.filesystem.allowWrite.push(PROFILE);
  // Right after the command name, so a trailing `--` or prompt argument can't swallow them
  args.splice(1, 0, ...addDirs.flatMap((dir) => ['--add-dir', dir]));
}

// Seatbelt checks a symlink and its target separately. Only configured entries under ~ are resolved (dotfile-manager links), not system links like /var, whose target would
// widen the grant, and never links inside a granted directory, which a run could plant there
for (const path of [...config.filesystem.allowRead]) {
  const absolute = expandPath(path);
  if (!absolute.startsWith(`${HOME}/`)) continue;
  try {
    if (lstatSync(absolute).isSymbolicLink()) config.filesystem.allowRead.push(realpathSync(absolute));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

// srt rejects "*", so blackwall turns it into an ask callback that allows every host no rule matches
const allowAllDomains = config.network.allowedDomains.includes('*');
const srtConfig = { ...config, network: { ...config.network, allowedDomains: config.network.allowedDomains.filter((domain) => domain !== '*') } };
SandboxRuntimeConfigSchema.parse(srtConfig);
if (printConfig) {
  console.log(JSON.stringify(config, null, 2));
  process.exit(0);
}

// srt sets the child's TMPDIR from this; /tmp alone fails Claude's Bash tool
process.env.CLAUDE_CODE_TMPDIR = '/private/tmp';
const env = {
  ...process.env,
  // gh exits on the unreadable ~/.config/gh instead of falling back to defaults
  GH_CONFIG_DIR: `${CACHE}/gh`,
  UV_CACHE_DIR: `${CACHE}/uv`,
  npm_config_cache: `${CACHE}/npm`,
  PRE_COMMIT_HOME: `${CACHE}/pre-commit`,
  // gpg can't reach ~/.gnupg under denyRead
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'commit.gpgsign',
  GIT_CONFIG_VALUE_0: 'false',
  // srt sets http.proxyAuthMethod=basic through GIT_CONFIG_PARAMETERS, which pre-commit strips before cloning hook repos; srt's proxy aborts git's default credential-less CONNECT
  GIT_HTTP_PROXY_AUTHMETHOD: 'basic',
};
if (isClaude) {
  env.CLAUDE_CONFIG_DIR = PROFILE;
  // Claude loads the host's plugins in place without writing there, and forces their auto-update off
  env.CLAUDE_CODE_PLUGIN_SEED_DIR = `${HOME}/.claude/plugins`;
}

mkdirSync(CACHE, { recursive: true });
if (isClaude) {
  mkdirSync(PROFILE, { recursive: true });
  for (const name of SHARED) {
    const source = `${HOME}/.claude/${name}`;
    if (!existsSync(source)) continue;
    // Removes a dotfile-manager link itself, never its target
    rmSync(`${PROFILE}/${name}`, { recursive: true, force: true });
    // -L resolves nested links too (cpSync's dereference doesn't), since their targets are unreadable in the sandbox; cp reports a dangling one and copies the rest
    spawnSync('cp', ['-RL', source, `${PROFILE}/${name}`], { stdio: 'inherit' });
  }
}
await SandboxManager.initialize(srtConfig, async () => allowAllDomains);

const quote = (arg) => `'${arg.replaceAll("'", `'\\''`)}'`;
const command = await SandboxManager.wrapWithSandbox(args.map(quote).join(' '));
const child = spawn(command, { shell: true, stdio: 'inherit', env });
// The terminal sends Ctrl+C to the child too; the launcher must outlive it to keep srt's proxy up
process.on('SIGINT', () => {});
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('exit', (code) => process.exit(code ?? 1));
