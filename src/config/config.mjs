import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

import { CWD, HOME, PROJECT_CONFIG, PROJECT_ENV, SANDBOX_CACHE, TRUST_MARKERS, USER_CONFIG } from "../constants/paths.mjs";
import agentFiles from "../presets/agent-files.mjs";
import git from "../presets/git.mjs";
import github from "../presets/github.mjs";
import linux from "../presets/linux.mjs";
import localNetwork from "../presets/local-network.mjs";
import mac from "../presets/mac.mjs";
import node from "../presets/node.mjs";
import preCommit from "../presets/pre-commit.mjs";
import privateNetwork from "../presets/private-network.mjs";
import python from "../presets/python.mjs";
import tmpdir from "../presets/tmpdir.mjs";
import { CONFIG_SCHEMA, configErrorMap, DEFAULTS } from "./schema.mjs";

// A config picks a preset only by name from this list, never a file by path
export const PRESETS = {
  "agent-files": agentFiles,
  git,
  github,
  linux,
  "local-network": localNetwork,
  mac,
  node,
  "pre-commit": preCommit,
  "private-network": privateNetwork,
  python,
  tmpdir,
};

export function trustProjectConfig() {
  const text = readIfExists(PROJECT_CONFIG);
  if (text === undefined) exitWithConfigError(PROJECT_CONFIG, "not found");
  // A malformed file fails now rather than on the next launch
  parseConfig(PROJECT_CONFIG, text);
  mkdirSync(TRUST_MARKERS, { recursive: true });
  writeFileSync(trustMarker(text), "");
  return PROJECT_CONFIG;
}

// additions is the adapter's layer, added after every config file's lists
export function buildConfig({ addDirs, additions }) {
  // overrideDefaults replaces default values and srt replaces them per key, the project's over the user's, then the presets and the top-level lists of both are added on top
  const user = readConfig(USER_CONFIG);
  // From ~, both paths name the user config
  const project = PROJECT_CONFIG === USER_CONFIG ? { additions: {}, overrides: {}, presets: [], srt: {} } : readConfig(PROJECT_CONFIG, true);

  // presets is blackwall's own key, so it never reaches srt
  const { presets: basePresets, ...base } = {
    ...DEFAULTS,
    ...user.overrides,
    ...project.overrides,
    network: { ...DEFAULTS.network, ...user.overrides.network, ...project.overrides.network },
    filesystem: { ...DEFAULTS.filesystem, ...user.overrides.filesystem, ...project.overrides.filesystem },
    srt: { ...DEFAULTS.srt, ...user.srt, ...project.srt },
  };

  // Always on, so overriding presets can't drop the sandbox's own needs
  const ALWAYS = ["tmpdir", ...({ darwin: ["mac"], linux: ["linux"] }[process.platform] ?? [])];
  const names = [...new Set([...ALWAYS, ...basePresets, ...user.presets, ...project.presets])];
  const presets = names.map((name) => {
    if (!Object.hasOwn(PRESETS, name)) {
      console.error(`blackwall: unknown preset ${name}`);
      process.exit(2);
    }
    // env is a preset-only key, so it never reaches srt
    return { name, env: {}, ...PRESETS[name] };
  });

  const expandPath = (path) => resolve(path.replace(/^~(?=\/|$)/, HOME));
  if (!base.filesystem.denyRead.some((path) => `${HOME}/`.startsWith(`${expandPath(path)}/`.replace("//", "/")))) {
    console.warn("blackwall: overrideDefaults.filesystem.denyRead no longer denies ~/, so your home directory is readable");
  }

  const entriesOf = (layer, section, key) => layer[section]?.[key] ?? [];
  const fromPresets = (section, key) => presets.flatMap((preset) => entriesOf(preset, section, key));
  const fromUserConfig = (section, key) => entriesOf(user.additions, section, key);
  const fromProjectConfig = (section, key) => entriesOf(project.additions, section, key);
  const fromAdapter = (section, key) => entriesOf(additions, section, key);

  // A relative entry applies to the current folder and every --add-dir folder
  const applyToEachDir = (path) => (/^[~/]/.test(path) ? [path] : [CWD, ...addDirs].map((dir) => `${dir}/${path}`));

  const config = {
    ...base,
    network: {
      allowedHosts: [
        ...base.network.allowedHosts,
        ...fromPresets("network", "allowedHosts"),
        ...fromUserConfig("network", "allowedHosts"),
        ...fromProjectConfig("network", "allowedHosts"),
        ...fromAdapter("network", "allowedHosts"),
      ],
      deniedHosts: [
        ...base.network.deniedHosts,
        ...fromPresets("network", "deniedHosts"),
        ...fromUserConfig("network", "deniedHosts"),
        ...fromProjectConfig("network", "deniedHosts"),
        ...fromAdapter("network", "deniedHosts"),
      ],
    },
    filesystem: {
      // Listed in srt's precedence: a later key wins where it overlaps an earlier one, except a denyRead nested inside an allowRead
      denyRead: [
        ...base.filesystem.denyRead,
        ...fromPresets("filesystem", "denyRead"),
        ...fromUserConfig("filesystem", "denyRead"),
        ...fromProjectConfig("filesystem", "denyRead"),
        ...fromAdapter("filesystem", "denyRead"),
      ].flatMap(applyToEachDir),
      allowRead: [
        SANDBOX_CACHE,
        CWD,
        ...addDirs,
        ...base.filesystem.allowRead,
        ...fromPresets("filesystem", "allowRead"),
        ...fromUserConfig("filesystem", "allowRead"),
        ...fromProjectConfig("filesystem", "allowRead"),
        ...fromAdapter("filesystem", "allowRead"),
      ],
      allowWrite: [
        SANDBOX_CACHE,
        CWD,
        ...addDirs,
        ...base.filesystem.allowWrite,
        ...fromPresets("filesystem", "allowWrite"),
        ...fromUserConfig("filesystem", "allowWrite"),
        ...fromProjectConfig("filesystem", "allowWrite"),
        ...fromAdapter("filesystem", "allowWrite"),
      ],
      denyWrite: [
        `${HOME}/.blackwall`, // a sandboxed command must not edit the user's blackwall setups
        ".blackwall", // same as above, but applies to CWD and any --add-dir folder
        ...base.filesystem.denyWrite,
        ...fromPresets("filesystem", "denyWrite"),
        ...fromUserConfig("filesystem", "denyWrite"),
        ...fromProjectConfig("filesystem", "denyWrite"),
        ...fromAdapter("filesystem", "denyWrite"),
      ].flatMap(applyToEachDir),
    },
  };

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

  return { config, presets };
}

export function readProjectEnv() {
  // From ~, it's the user's own .env, already loaded
  if (PROJECT_CONFIG === USER_CONFIG) return {};
  const env = readIfExists(PROJECT_ENV);
  if (env === undefined) return {};
  const config = readIfExists(PROJECT_CONFIG);
  if (config === undefined || !existsSync(trustMarker(config))) {
    exitWithConfigError(PROJECT_ENV, "loads only with a trusted .blackwall/config.json. Create one ({} is enough), review both, then run `blackwall --trust`");
  }
  return parseEnv(env);
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
  if (text === undefined) return { additions: {}, overrides: {}, presets: [], srt: {} };
  // Checks the same text it parses, so an edit in between can't skip the check
  if (requireTrust && !existsSync(trustMarker(text))) exitWithConfigError(file, "not trusted. Review it, then run `blackwall --trust`");
  return parseConfig(file, text);
}

// Like direnv, trust covers this path with these exact contents, so any edit needs a new --trust
function trustMarker(text) {
  return `${TRUST_MARKERS}/${createHash("sha256").update(`${PROJECT_CONFIG}\n${text}`).digest("hex")}`;
}

function parseConfig(file, text) {
  const parsed = JSON.parse(text);
  const result = CONFIG_SCHEMA.safeParse(parsed, { errorMap: configErrorMap });
  if (!result.success) {
    const [issue] = result.error.issues;
    const path = issue.path.join(".");
    exitWithConfigError(file, path && issue.code !== "unrecognized_keys" ? `${path}: ${issue.message}` : issue.message);
  }
  const { overrideDefaults: overrides = {}, presets = [], srt = {}, ...additions } = parsed;
  return { additions, overrides, presets, srt };
}

function exitWithConfigError(file, message) {
  console.error(`blackwall: ${file}: ${message}`);
  process.exit(2);
}
