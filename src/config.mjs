import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HOME = homedir();
const cwd = process.cwd();

// Private to blackwall runs: host tools later execute what lands in a package cache
export const CACHE = `${HOME}/.cache/blackwall`;
const CONFIG = `${HOME}/.blackwall/config.json`;

// Loads only once trusted, since a cloned repo can ship one that widens the sandbox
const PROJECT_CONFIG = `${cwd}/.blackwall/config.json`;
const TRUSTED = `${HOME}/.blackwall/trusted`;

export const DEFAULTS = JSON.parse(readFileSync(new URL("./configs/default-config.json", import.meta.url), "utf8"));

export function trustProjectConfig() {
  const text = readIfExists(PROJECT_CONFIG);
  if (text === undefined) exitWithConfigError(PROJECT_CONFIG, "not found");
  // A malformed file fails now rather than on the next launch
  parseConfig(PROJECT_CONFIG, text);
  mkdirSync(TRUSTED, { recursive: true });
  writeFileSync(trustMarker(text), "");
  return PROJECT_CONFIG;
}

export function buildConfig({ addDirs, presets }) {
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

  // Platform and adaptor presets aren't in the presets list, so overriding it can't drop them
  const platformPresets = { darwin: ["mac"], linux: ["linux"] }[process.platform] ?? [];
  const automatic = [...platformPresets, ...presets];
  const layers = [...new Set([...automatic, ...basePresets, ...user.presets, ...project.presets])].map(readPreset);
  layers.push(user.additions, project.additions);

  const expandPath = (path) => resolve(path.replace(/^~(?=\/|$)/, HOME));
  if (!base.filesystem.denyRead.some((path) => `${HOME}/`.startsWith(`${expandPath(path)}/`.replace("//", "/")))) {
    console.warn("blackwall: overrideDefaults.filesystem.denyRead no longer denies ~/, so your home directory is readable");
  }

  const added = (section, key) => layers.flatMap((layer) => layer[section]?.[key] ?? []);

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
      // srt's built-in denies anchor on cwd only. cwd/.blackwall keeps a run from writing a project config for you to trust
      denyWrite: [...base.filesystem.denyWrite, `${cwd}/.blackwall`, ...addDirs.flatMap((dir) => [`${dir}/.git/hooks`, `${dir}/.git/config`]), ...added("filesystem", "denyWrite")],
    },
  };

  // srt runs its apply-seccomp helper inside the sandbox, from wherever npm installed srt
  if (process.platform === "linux") {
    config.filesystem.allowRead.push(fileURLToPath(new URL("../vendor", import.meta.resolve("@anthropic-ai/sandbox-runtime"))));
  }

  // Seatbelt checks a symlink and its target separately. Only configured entries under ~ are resolved (dotfile-manager links), not system links like /var, whose target would
  // widen the grant, and never links inside a granted directory, which a run could plant there
  for (const path of [...config.filesystem.allowRead]) {
    const absolute = expandPath(path);
    if (!absolute.startsWith(`${HOME}/`)) continue;
    try {
      if (lstatSync(absolute).isSymbolicLink()) config.filesystem.allowRead.push(realpathSync(absolute));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  return config;
}

export function readIfExists(file) {
  try {
    return readFileSync(file, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function readConfig(file, requireTrust = false) {
  const text = readIfExists(file);
  if (text === undefined) return { additions: {}, overrides: {}, presets: [] };
  // Checks the same text it parses, so an edit in between can't skip the check
  if (requireTrust && !existsSync(trustMarker(text))) exitWithConfigError(file, "not trusted. Review it, then run `blackwall --trust`");
  return parseConfig(file, text);
}

// Like direnv, trust covers this path with these exact contents, so any edit needs a new --trust
function trustMarker(text) {
  return `${TRUSTED}/${createHash("sha256").update(`${PROJECT_CONFIG}\n${text}`).digest("hex")}`;
}

function parseConfig(file, text) {
  const parsed = JSON.parse(text);
  checkShape(file, parsed, { ...DEFAULTS, overrideDefaults: {} }, "", true, ["overrideDefaults"]);
  const { overrideDefaults: overrides = {}, presets = [], ...additions } = parsed;
  checkShape(file, overrides, DEFAULTS, "overrideDefaults.", false);
  return { additions, overrides, presets };
}

function readPreset(name) {
  const text = readIfExists(new URL(`./configs/presets/${name}.json`, import.meta.url));
  if (text === undefined) {
    console.error(`blackwall: unknown preset ${name}`);
    process.exit(2);
  }
  return JSON.parse(text);
}

// Keys and types mirror default-config.json: a misspelled key would otherwise drop its paths without a word, and a string would spread into characters
function checkShape(file, value, shape, prefix, listsOnly, skip = []) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    exitWithConfigError(file, `${prefix.slice(0, -1) || "the file"} must be an object`);
  }
  for (const [key, item] of Object.entries(value)) {
    if (skip.includes(key)) continue;
    const name = `${prefix}${key}`;
    if (!Object.hasOwn(shape, key)) exitWithConfigError(file, `unknown key ${name}`);
    const expected = shape[key];
    if (Array.isArray(expected)) {
      if (!Array.isArray(item) || !item.every((entry) => typeof entry === "string")) {
        exitWithConfigError(file, `${name} must be a list of strings`);
      }
    } else if (typeof expected === "object") {
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
