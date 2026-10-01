#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, resolve } from "node:path";
import { parseEnv } from "node:util";
import { SandboxManager, SandboxRuntimeConfigSchema } from "@anthropic-ai/sandbox-runtime";

const USAGE = "usage: sandboxed [--add-dir DIR]... [--print-config | --print-default-config] [--] <command> [args...]";
const HOME = homedir();
const PROFILE = `${HOME}/.claude-sandboxed`;
// Private to sandboxed runs: host tools later execute what lands in a package cache
const CACHE = `${HOME}/.cache/sandboxed`;
const CONFIG = `${HOME}/.sandboxed/config.json`;
// Explained in the README; also the shape a user config must match
const DEFAULTS = JSON.parse(readFileSync(new URL("./configs/default-config.json", import.meta.url), "utf8"));

const args = process.argv.slice(2);
const addDirs = [];
let printConfig = false;
for (;;) {
  if (args[0] === "--add-dir") {
    args.shift();
    if (!args[0]) exitWithUsage();
    addDirs.push(resolve(args.shift()));
  } else if (args[0] === "--print-config") {
    args.shift();
    printConfig = true;
  } else if (args[0] === "--print-default-config") {
    console.log(JSON.stringify(DEFAULTS, null, 2));
    process.exit(0);
  } else {
    break;
  }
}
if (args[0] === "--") args.shift();
if (!args[0] && !printConfig) exitWithUsage();

function exitWithUsage() {
  console.error(USAGE);
  process.exit(2);
}

function readUserConfig() {
  let user;
  try {
    user = JSON.parse(readFileSync(CONFIG, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { additions: {}, overrides: {} };
    throw error;
  }
  checkShape(user, { ...DEFAULTS, overrideDefaults: {} }, "", true, ["overrideDefaults"]);
  const { overrideDefaults: overrides = {}, ...additions } = user;
  checkShape(overrides, DEFAULTS, "overrideDefaults.", false);
  return { additions, overrides };
}

// Keys and types mirror default-config.json: a misspelled key would otherwise drop its paths without a word, and a string would spread into characters
function checkShape(value, shape, prefix, listsOnly, skip = []) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    exitWithConfigError(`${prefix.slice(0, -1) || "the file"} must be an object`);
  }
  for (const [key, item] of Object.entries(value)) {
    if (skip.includes(key)) continue;
    const name = `${prefix}${key}`;
    if (!Object.hasOwn(shape, key)) exitWithConfigError(`unknown key ${name}`);
    const expected = shape[key];
    if (Array.isArray(expected)) {
      if (!Array.isArray(item) || !item.every((entry) => typeof entry === "string")) {
        exitWithConfigError(`${name} must be a list of strings`);
      }
    } else if (typeof expected === "object") {
      checkShape(item, expected, `${name}.`, listsOnly);
    } else if (listsOnly) {
      exitWithConfigError(`${name} can only be set under overrideDefaults`);
    } else if (typeof item !== typeof expected) {
      exitWithConfigError(`${name} must be a ${typeof expected}`);
    }
  }
}

function exitWithConfigError(message) {
  console.error(`sandboxed: ${CONFIG}: ${message}`);
  process.exit(2);
}

// overrideDefaults replaces default values, then the top-level lists are added on top
const { additions, overrides } = readUserConfig();
const base = {
  ...DEFAULTS,
  ...overrides,
  network: { ...DEFAULTS.network, ...overrides.network },
  filesystem: { ...DEFAULTS.filesystem, ...overrides.filesystem },
};
const expandPath = (path) => resolve(path.replace(/^~(?=\/|$)/, HOME));
if (!base.filesystem.denyRead.some((path) => expandPath(path) === HOME)) {
  console.warn(`sandboxed: overrideDefaults.filesystem.denyRead in ${CONFIG} no longer denies ~/, so your home directory is readable`);
}
const added = (section, key) => additions[section]?.[key] ?? [];

const cwd = process.cwd();
const config = {
  ...base,
  network: {
    allowedDomains: [...base.network.allowedDomains, ...added("network", "allowedDomains")],
    deniedDomains: [...base.network.deniedDomains, ...added("network", "deniedDomains")],
  },
  filesystem: {
    denyRead: [...base.filesystem.denyRead, ...added("filesystem", "denyRead")],
    allowRead: [cwd, ...addDirs, ...base.filesystem.allowRead, CACHE, ...added("filesystem", "allowRead")],
    allowWrite: [cwd, ...addDirs, ...base.filesystem.allowWrite, "/private/tmp", CACHE, ...added("filesystem", "allowWrite")],
    // srt's built-in denies anchor on cwd only
    denyWrite: [
      ...base.filesystem.denyWrite,
      ...addDirs.flatMap((dir) => [`${dir}/.git/hooks`, `${dir}/.git/config`]),
      ...added("filesystem", "denyWrite"),
    ],
  },
};

// Only claude gets the profile, and further down the subscription token: any other command would hold it with no classifier
const isClaude = args[0] !== undefined && basename(args[0]) === "claude";
if (isClaude) {
  config.filesystem.allowRead.push(PROFILE, "~/.claude/skills", "~/.claude/plugins");
  config.filesystem.allowWrite.push(PROFILE);
  // Right after the command name, so a trailing `--` or prompt argument can't swallow them
  args.splice(1, 0, ...addDirs.flatMap((dir) => ["--add-dir", dir]));
}

// srt rejects "*", so sandboxed turns it into an ask callback that allows every host no rule matches
const allowAllDomains = config.network.allowedDomains.includes("*");
const srtConfig = { ...config, network: { ...config.network, allowedDomains: config.network.allowedDomains.filter((domain) => domain !== "*") } };
SandboxRuntimeConfigSchema.parse(srtConfig);
if (printConfig) {
  console.log(JSON.stringify(config, null, 2));
  process.exit(0);
}

// A 1Password Environments mount (a FIFO) or a hand-made file; parsed, not loaded, so non-claude commands never inherit the OAuth token
const secrets = parseEnv(readFileSync(`${HOME}/.sandboxed/.env`, "utf8"));
// srt sets the child's TMPDIR from this; /tmp alone fails Claude's Bash tool
process.env.CLAUDE_CODE_TMPDIR = "/private/tmp";
const env = {
  ...process.env,
  // gh exits on the unreadable ~/.config/gh instead of falling back to defaults
  GH_CONFIG_DIR: `${CACHE}/gh`,
  UV_CACHE_DIR: `${CACHE}/uv`,
  npm_config_cache: `${CACHE}/npm`,
  // gpg can't reach ~/.gnupg under denyRead
  GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "commit.gpgsign",
  GIT_CONFIG_VALUE_0: "false",
  GH_TOKEN: secrets.GH_TOKEN,
};
if (isClaude) {
  env.CLAUDE_CODE_OAUTH_TOKEN = secrets.CLAUDE_CODE_OAUTH_TOKEN;
  env.CLAUDE_CONFIG_DIR = PROFILE;
}

mkdirSync(CACHE, { recursive: true });
await SandboxManager.initialize(srtConfig, async () => allowAllDomains);

const quote = (arg) => `'${arg.replaceAll("'", `'\\''`)}'`;
const command = await SandboxManager.wrapWithSandbox(args.map(quote).join(" "));
const child = spawn(command, { shell: true, stdio: "inherit", env });
// The terminal sends Ctrl+C to the child too; the launcher must outlive it to keep srt's proxy up
process.on("SIGINT", () => {});
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("exit", (code) => process.exit(code ?? 1));
