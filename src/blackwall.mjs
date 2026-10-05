#!/usr/bin/env node
import { SandboxManager, SandboxRuntimeConfigSchema } from '@anthropic-ai/sandbox-runtime';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const USAGE = 'usage: blackwall [--add-dir DIR]... [--print-config | --print-file-access | --print-default-config | --trust] [--] <command> [args...]';
const HOME = homedir();
const cwd = process.cwd();
const PROFILE = `${HOME}/.claude-blackwall`;
// Copied into the profile on every launch rather than linked, so a sandboxed run can change only its copies, never ~/.claude
const SHARED = ['CLAUDE.md', 'rules', 'skills', 'agents', 'commands', 'output-styles'];
// Private to blackwall runs: host tools later execute what lands in a package cache
const CACHE = `${HOME}/.cache/blackwall`;
const CONFIG = `${HOME}/.blackwall/config.json`;
// Loads only once trusted, since a cloned repo can ship one that widens the sandbox
const PROJECT_CONFIG = `${cwd}/.blackwall/config.json`;
const TRUSTED = `${HOME}/.blackwall/trusted`;
// Runs unsandboxed on the next launch, so it must stay outside every allowWrite path, unlike CACHE or the package folder
const SIGNED_NODE = `${HOME}/.blackwall/blackwall_node`;

// A 1Password Environments mount (a FIFO) or a hand-made file. Loaded before the re-exec below so it can set BLACKWALL_* keys; the signed copy inherits the values, since a second read of a FIFO may prompt again
if (basename(process.execPath) !== basename(SIGNED_NODE)) {
  Object.assign(process.env, parseEnv(readIfExists(`${HOME}/.blackwall/.env`) ?? ''));
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
const DEFAULTS = JSON.parse(readFileSync(new URL('../configs/default-config.json', import.meta.url), 'utf8'));

const args = process.argv.slice(2);
const addDirs = [];
let printConfig = false;
let printFileAccess = false;
for (;;) {
  if (args[0] === '--add-dir') {
    args.shift();
    if (!args[0]) exitWithUsage();
    addDirs.push(resolve(args.shift()));
  } else if (args[0] === '--print-config') {
    args.shift();
    printConfig = true;
  } else if (args[0] === '--print-file-access') {
    args.shift();
    printFileAccess = true;
  } else if (args[0] === '--print-default-config') {
    console.log(JSON.stringify(DEFAULTS, null, 2));
    process.exit(0);
  } else if (args[0] === '--trust') {
    const text = readIfExists(PROJECT_CONFIG);
    if (text === undefined) exitWithConfigError(PROJECT_CONFIG, 'not found');
    // A malformed file fails now rather than on the next launch
    parseConfig(PROJECT_CONFIG, text);
    mkdirSync(TRUSTED, { recursive: true });
    writeFileSync(trustMarker(text), '');
    console.log(`blackwall: trusted ${PROJECT_CONFIG}`);
    process.exit(0);
  } else {
    break;
  }
}
if (args[0] === '--') args.shift();
if (!args[0] && !printConfig && !printFileAccess) exitWithUsage();

function exitWithUsage() {
  console.error(USAGE);
  process.exit(2);
}

function readIfExists(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function readConfig(file, requireTrust = false) {
  const text = readIfExists(file);
  if (text === undefined) return { additions: {}, overrides: {}, presets: [] };
  // Checks the same text it parses, so an edit in between can't skip the check
  if (requireTrust && !existsSync(trustMarker(text))) exitWithConfigError(file, 'not trusted. Review it, then run `blackwall --trust`');
  return parseConfig(file, text);
}

// Like direnv, trust covers this path with these exact contents, so any edit needs a new --trust
function trustMarker(text) {
  return `${TRUSTED}/${createHash('sha256').update(`${PROJECT_CONFIG}\n${text}`).digest('hex')}`;
}

function parseConfig(file, text) {
  const parsed = JSON.parse(text);
  checkShape(file, parsed, { ...DEFAULTS, overrideDefaults: {} }, '', true, ['overrideDefaults']);
  const { overrideDefaults: overrides = {}, presets = [], ...additions } = parsed;
  checkShape(file, overrides, DEFAULTS, 'overrideDefaults.', false);
  return { additions, overrides, presets };
}

function readPreset(name) {
  const text = readIfExists(new URL(`../configs/presets/${name}.json`, import.meta.url));
  if (text === undefined) {
    console.error(`blackwall: unknown preset ${name}`);
    process.exit(2);
  }
  return JSON.parse(text);
}

// Keys and types mirror default-config.json: a misspelled key would otherwise drop its paths without a word, and a string would spread into characters
function checkShape(file, value, shape, prefix, listsOnly, skip = []) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    exitWithConfigError(file, `${prefix.slice(0, -1) || 'the file'} must be an object`);
  }
  for (const [key, item] of Object.entries(value)) {
    if (skip.includes(key)) continue;
    const name = `${prefix}${key}`;
    if (!Object.hasOwn(shape, key)) exitWithConfigError(file, `unknown key ${name}`);
    const expected = shape[key];
    if (Array.isArray(expected)) {
      if (!Array.isArray(item) || !item.every((entry) => typeof entry === 'string')) {
        exitWithConfigError(file, `${name} must be a list of strings`);
      }
    } else if (typeof expected === 'object') {
      checkShape(file, item, expected, `${name}.`, listsOnly);
    } else if (listsOnly) {
      exitWithConfigError(file, `${name} can only be set under overrideDefaults`);
    } else if (typeof item !== typeof expected) {
      exitWithConfigError(file, `${name} must be a ${typeof expected}`);
    }
  }
}

function exitWithConfigError(file, message) {
  console.error(`blackwall: ${file}: ${message}`);
  process.exit(2);
}

const isClaude = args[0] !== undefined && basename(args[0]) === 'claude';

// overrideDefaults replaces default values, the project's over the user's, then the presets and the top-level lists of both are added on top
const user = readConfig(CONFIG);
// From ~, both paths name the user config
const project = PROJECT_CONFIG === CONFIG ? { additions: {}, overrides: {}, presets: [] } : readConfig(PROJECT_CONFIG, true);
// presets is blackwall's own key, so it never reaches srt
const { presets: basePresets, ...base } = {
  ...DEFAULTS,
  ...user.overrides,
  ...project.overrides,
  network: { ...DEFAULTS.network, ...user.overrides.network, ...project.overrides.network },
  filesystem: { ...DEFAULTS.filesystem, ...user.overrides.filesystem, ...project.overrides.filesystem },
};
// mac, linux, and claude aren't in the presets list, so overriding it can't drop them
const platformPresets = { darwin: ['mac'], linux: ['linux'] }[process.platform] ?? [];
const automatic = [...platformPresets, ...(isClaude ? ['claude'] : [])];
const layers = [...new Set([...automatic, ...basePresets, ...user.presets, ...project.presets])].map(readPreset);
layers.push(user.additions, project.additions);
const expandPath = (path) => resolve(path.replace(/^~(?=\/|$)/, HOME));
if (!base.filesystem.denyRead.some((path) => `${HOME}/`.startsWith(`${expandPath(path)}/`.replace('//', '/')))) {
  console.warn('blackwall: overrideDefaults.filesystem.denyRead no longer denies ~/, so your home directory is readable');
}
const added = (section, key) => layers.flatMap((layer) => layer[section]?.[key] ?? []);

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
    // srt's built-in denies anchor on cwd only. cwd/.blackwall keeps a run from writing a project config for you to trust
    denyWrite: [...base.filesystem.denyWrite, `${cwd}/.blackwall`, ...addDirs.flatMap((dir) => [`${dir}/.git/hooks`, `${dir}/.git/config`]), ...added('filesystem', 'denyWrite')],
  },
};

if (isClaude) {
  config.filesystem.allowRead.push(PROFILE, '~/.claude/plugins');
  config.filesystem.allowWrite.push(PROFILE);
  // Right after the command name, so a trailing `--` or prompt argument can't swallow them
  args.splice(1, 0, ...addDirs.flatMap((dir) => ['--add-dir', dir]));
}
// srt runs its apply-seccomp helper inside the sandbox, from wherever npm installed srt
if (process.platform === 'linux') {
  config.filesystem.allowRead.push(fileURLToPath(new URL('../vendor', import.meta.resolve('@anthropic-ai/sandbox-runtime'))));
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
if (printFileAccess) {
  // srt's view, not the config's: it adds its own write paths, and denies writes to these names in the cwd at any depth
  SandboxManager.updateConfig(srtConfig);
  const read = SandboxManager.getFsReadConfig();
  const write = SandboxManager.getFsWriteConfig();
  // Not in the package's index, but srt builds its mandatory write denies from these. Loaded only here, so an srt update that moves them breaks this flag, not every launch
  const { DANGEROUS_FILES, getDangerousDirectories } = await import('@anthropic-ai/sandbox-runtime/dist/sandbox/sandbox-utils.js');
  const mandatory = [...DANGEROUS_FILES, ...getDangerousDirectories(), '.git/hooks', '.git/config'].map((name) => `${cwd}/**/${name}`);
  for (const [title, paths] of [
    ['read allowed', read.allowWithinDeny],
    ['read denied', read.denyOnly],
    ['write allowed', write.allowOnly],
    ['write denied', [...write.denyWithinAllow, ...mandatory]],
  ]) {
    console.log(`${title}:`);
    for (const path of new Set(paths)) console.log(`  ${path}`);
  }
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
  const firstRun = !existsSync(PROFILE);
  mkdirSync(PROFILE, { recursive: true });
  // Seeded once, then the user's: seed plugins load only when enabled, while the host's other settings (hooks, permissions) assume no sandbox
  let seeded = false;
  if (!existsSync(`${PROFILE}/settings.json`)) {
    try {
      const { enabledPlugins } = JSON.parse(readFileSync(`${HOME}/.claude/settings.json`, 'utf8'));
      if (enabledPlugins) {
        // wx refuses a dangling dotfile-manager link instead of writing to its target
        writeFileSync(`${PROFILE}/settings.json`, `${JSON.stringify({ enabledPlugins }, null, 2)}\n`, { flag: 'wx' });
        seeded = true;
      }
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'EEXIST') throw error;
    }
  }
  if (firstRun) {
    console.warn(`blackwall: created ${PROFILE} as claude's config folder. Every launch copies ${SHARED.join(', ')} from ~/.claude into it, and plugins load from ~/.claude/plugins read-only`);
    console.warn(`blackwall: sessions, settings, and login stay apart from ~/.claude. Settings go in ${PROFILE}/settings.json${seeded ? ', which starts with your enabledPlugins' : ''}`);
  }
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
