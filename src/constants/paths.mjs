import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

export const HOME = homedir();
export const CWD = process.cwd();

// The package's own skills, copied into each agent profile so they match the running blackwall
export const SKILLS = fileURLToPath(new URL("../../skills", import.meta.url));

export const CACHE = `${HOME}/.cache/blackwall`;
export const CONFIG = `${HOME}/.blackwall/config.json`;

// Loads only once trusted, since a cloned repo can ship one that widens the sandbox
export const PROJECT_CONFIG = `${CWD}/.blackwall/config.json`;
export const PROJECT_ENV = `${CWD}/.blackwall/.env`;
export const TRUSTED = `${HOME}/.blackwall/trusted`;

// Runs unsandboxed on the next launch, so it must stay outside every allowWrite path, unlike CACHE or the package folder
export const SIGNED_NODE = `${HOME}/.blackwall/blackwall_node`;

// srt already lets the sandbox write here, unlike the rest of /tmp, where unsandboxed tools like Claude Code keep scratch files they later run
export const TMPDIR = `${realpathSync("/tmp")}/claude`;
