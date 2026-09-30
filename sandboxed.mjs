#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, resolve } from "node:path";
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";

const USAGE = "usage: sandboxed [--add-dir DIR]... [--] <command> [args...]";
const HOME = homedir();
const PROFILE = `${HOME}/.claude-sandboxed`;
// Private to sandboxed runs: host tools later execute what lands in a package cache
const CACHE = `${HOME}/.cache/sandboxed`;

const args = process.argv.slice(2);
const addDirs = [];
while (args[0] === "--add-dir") {
  args.shift();
  if (!args[0]) exitWithUsage();
  addDirs.push(resolve(args.shift()));
}
if (args[0] === "--") args.shift();
if (!args[0]) exitWithUsage();

function exitWithUsage() {
  console.error(USAGE);
  process.exit(2);
}

// Created with Keychain `-T ""`, so each read shows a dialog: click Allow, never Always Allow
function readKeychain(service) {
  return execFileSync("security", ["find-generic-password", "-s", service, "-w"], { encoding: "utf8" }).trim();
}

const cwd = process.cwd();
const config = {
  network: { allowedDomains: [], deniedDomains: [] },
  // Go tools such as gh fail TLS verification without it
  enableWeakerNetworkIsolation: true,
  allowPty: true,
  filesystem: {
    denyRead: ["~/"],
    allowRead: [
      cwd,
      ...addDirs,
      "~/.local/bin",
      "~/.local/share",
      "~/.local/state/fnm_multishells",
      "~/.gitconfig",
      "~/.gitignore_global",
      "~/.config/uv/uv.toml",
      "~/.npmrc",
      CACHE,
    ],
    allowWrite: [cwd, ...addDirs, "/private/tmp", CACHE],
    // srt's built-in denies anchor on cwd only
    denyWrite: addDirs.flatMap((dir) => [`${dir}/.git/hooks`, `${dir}/.git/config`]),
  },
};
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
  GH_TOKEN: readKeychain("sandboxed-gh-token"),
};

// Only claude gets the subscription token: any other command would hold it with no classifier
function applyClaude() {
  env.CLAUDE_CODE_OAUTH_TOKEN = readKeychain("sandboxed-claude-oauth-token");
  env.CLAUDE_CONFIG_DIR = PROFILE;
  config.filesystem.allowRead.push(PROFILE, "~/.claude/skills", "~/.claude/plugins");
  config.filesystem.allowWrite.push(PROFILE);
  // Right after the command name, so a trailing `--` or prompt argument can't swallow them
  args.splice(1, 0, ...addDirs.flatMap((dir) => ["--add-dir", dir]));
}

if (basename(args[0]) === "claude") applyClaude();

mkdirSync(CACHE, { recursive: true });
// No rule matches any host, so srt asks for each one: allow all for full internet
await SandboxManager.initialize(config, async () => true);

const quote = (arg) => `'${arg.replaceAll("'", `'\\''`)}'`;
const command = await SandboxManager.wrapWithSandbox(args.map(quote).join(" "));
const child = spawn(command, { shell: true, stdio: "inherit", env });
// The terminal sends Ctrl+C to the child too; the launcher must outlive it to keep srt's proxy up
process.on("SIGINT", () => {});
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("exit", (code) => process.exit(code ?? 1));
