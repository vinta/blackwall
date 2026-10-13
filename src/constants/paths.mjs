import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

export const HOME = homedir();
export const CWD = process.cwd();

// Where tools look when the user moved their XDG folders. The spec says to ignore a relative value
const xdg = (name) => (process.env[name]?.startsWith("/") ? process.env[name] : undefined);
export const XDG_CONFIG = xdg("XDG_CONFIG_HOME") ?? `${HOME}/.config`;
export const XDG_DATA = xdg("XDG_DATA_HOME") ?? `${HOME}/.local/share`;
export const XDG_STATE = xdg("XDG_STATE_HOME") ?? `${HOME}/.local/state`;
export const XDG_CACHE = xdg("XDG_CACHE_HOME") ?? `${HOME}/.cache`;
// Unset on macOS and on Linux without a login session, so it has no default
export const XDG_RUNTIME = xdg("XDG_RUNTIME_DIR");

// The package's own skills, copied into each agent profile so they match the running blackwall
export const SKILLS = fileURLToPath(new URL("../../skills", import.meta.url));

export const SANDBOX_CACHE = `${HOME}/.cache-blackwall`;
export const USER_CONFIG = `${HOME}/.blackwall/config.json`;

// Loads only once trusted, since a cloned repo can ship one that widens the sandbox
export const PROJECT_CONFIG = `${CWD}/.blackwall/config.json`;
export const PROJECT_ENV = `${CWD}/.blackwall/.env`;
export const TRUST_MARKERS = `${HOME}/.blackwall/trusted`;

// Runs unsandboxed on the next launch, so it must stay outside every allowWrite path, unlike SANDBOX_CACHE or the package folder
export const SIGNED_NODE = `${HOME}/.blackwall/blackwall_node`;

// srt already lets the sandbox write here, unlike the rest of /tmp, where unsandboxed tools like Claude Code keep scratch files they later run
export const TMPDIR = `${realpathSync("/tmp")}/claude`;
