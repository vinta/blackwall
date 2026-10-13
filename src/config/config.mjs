import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

import { CACHE, CONFIG, CWD, HOME, PROJECT_CONFIG, PROJECT_ENV, TRUSTED } from "../constants/paths.mjs";
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
import { CONFIG_SCHEMA, configErrorMap } from "./schema.mjs";

const DEFAULTS = JSON.parse(readFileSync(new URL("./default-config.json", import.meta.url), "utf8"));

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
  mkdirSync(TRUSTED, { recursive: true });
  writeFileSync(trustMarker(text), "");
  return PROJECT_CONFIG;
}

// additions is the adapter's layer, added after every config file's lists
export function buildConfig({ addDirs, additions }) {
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
  const layers = [...presets, user.additions, project.additions, additions];

  const expandPath = (path) => resolve(path.replace(/^~(?=\/|$)/, HOME));
  if (!base.filesystem.denyRead.some((path) => `${HOME}/`.startsWith(`${expandPath(path)}/`.replace("//", "/")))) {
    console.warn("blackwall: overrideDefaults.filesystem.denyRead no longer denies ~/, so your home directory is readable");
  }

  const added = (section, key) => layers.flatMap((layer) => layer[section]?.[key] ?? []);

  const config = {
    ...base,
    network: {
      allowedHosts: [...base.network.allowedHosts, ...added("network", "allowedHosts")],
      deniedHosts: [...base.network.deniedHosts, ...added("network", "deniedHosts")],
    },
    filesystem: {
      denyRead: [...base.filesystem.denyRead, ...added("filesystem", "denyRead")],
      allowRead: [CWD, ...addDirs, ...base.filesystem.allowRead, CACHE, ...added("filesystem", "allowRead")],
      allowWrite: [CWD, ...addDirs, ...base.filesystem.allowWrite, CACHE, ...added("filesystem", "allowWrite")],
      // cwd/.blackwall keeps a run from writing a project config for you to trust, and ~/.blackwall from forging trust or replacing blackwall_node, even when
      // cwd or an --add-dir covers it
      // A relative entry applies to the current folder and every --add-dir folder
      denyWrite: [...base.filesystem.denyWrite, `${CWD}/.blackwall`, `${HOME}/.blackwall`, ...added("filesystem", "denyWrite")].flatMap((path) =>
        /^[~/]/.test(path) ? [path] : [CWD, ...addDirs].map((dir) => `${dir}/${path}`),
      ),
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
  if (PROJECT_CONFIG === CONFIG) return {};
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
  const result = CONFIG_SCHEMA.safeParse(parsed, { errorMap: configErrorMap });
  if (!result.success) {
    const [issue] = result.error.issues;
    const path = issue.path.join(".");
    exitWithConfigError(file, path && issue.code !== "unrecognized_keys" ? `${path}: ${issue.message}` : issue.message);
  }
  const { overrideDefaults: overrides = {}, presets = [], ...additions } = parsed;
  return { additions, overrides, presets };
}

function exitWithConfigError(file, message) {
  console.error(`blackwall: ${file}: ${message}`);
  process.exit(2);
}
