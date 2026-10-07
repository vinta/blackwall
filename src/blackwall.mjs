#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { parseEnv } from "node:util";

import claude from "./adapters/claude.mjs";
import codex from "./adapters/codex.mjs";
import { CACHE, DEFAULTS, buildConfig, readIfExists, trustProjectConfig } from "./config.mjs";
import { createSandbox } from "./srt.mjs";

const USAGE = "usage: blackwall [--add-dir DIR]... [--print-config | --print-file-access | --print-default-config | --trust] [--] <command> [args...]";
const HOME = homedir();

// Each adapter handles one command's quirks, matched by the command's name
const ADAPTERS = { claude, codex };

// Runs unsandboxed on the next launch, so it must stay outside every allowWrite path, unlike CACHE or the package folder
const SIGNED_NODE = `${HOME}/.blackwall/blackwall_node`;

Object.assign(process.env, parseEnv(readIfExists(`${HOME}/.blackwall/.env`) ?? ""));

// Create an ad-hoc-signed node copy, so users can configure firewall rules for blackwall
if (process.env.BLACKWALL_USE_SELF_SIGNED_NODE === "1" && basename(process.execPath) !== basename(SIGNED_NODE)) {
  if (!existsSync(SIGNED_NODE)) {
    mkdirSync(dirname(SIGNED_NODE), { recursive: true });
    // Signed under a temp name, so an interrupted run can't leave a broken copy that counts as present
    const temp = `${SIGNED_NODE}.tmp`;
    copyFileSync(process.execPath, temp);
    execFileSync("codesign", ["-f", "-s", "-", temp]);
    renameSync(temp, SIGNED_NODE);
  }
  process.execve(SIGNED_NODE, [SIGNED_NODE, ...process.execArgv, ...process.argv.slice(1)]);
}

const args = process.argv.slice(2);
const addDirs = [];
let printConfig = false;
let printFileAccess = false;
while (true) {
  if (args[0] === "--add-dir") {
    args.shift();
    if (!args[0]) exitWithUsage();
    addDirs.push(resolve(args.shift()));
  } else if (args[0] === "--print-config") {
    args.shift();
    printConfig = true;
  } else if (args[0] === "--print-file-access") {
    args.shift();
    printFileAccess = true;
  } else if (args[0] === "--print-default-config") {
    console.log(JSON.stringify(DEFAULTS, null, 2));
    process.exit(0);
  } else if (args[0] === "--trust") {
    console.log(`blackwall: trusted ${trustProjectConfig()}`);
    process.exit(0);
  } else {
    break;
  }
}

if (args[0] === "--") args.shift();
if (!args[0] && !printConfig && !printFileAccess) exitWithUsage();

function exitWithUsage() {
  console.error(USAGE);
  process.exit(2);
}

const name = basename(args[0] ?? "");
const adapter = Object.hasOwn(ADAPTERS, name) ? ADAPTERS[name] : {};
const config = buildConfig({ addDirs, additions: adapter.config?.() ?? {} });

const sandbox = createSandbox(config, { addDirs });

if (printConfig) {
  console.log(JSON.stringify(config, null, 2));
  process.exit(0);
}

if (printFileAccess) {
  await sandbox.printFileAccess();
  process.exit(0);
}

const env = {
  ...process.env,
  // gh exits on the unreadable ~/.config/gh instead of falling back to defaults
  GH_CONFIG_DIR: `${CACHE}/gh`,
  UV_CACHE_DIR: `${CACHE}/uv`,
  npm_config_cache: `${CACHE}/npm`,
  PRE_COMMIT_HOME: `${CACHE}/pre-commit`,
  // gpg can't reach ~/.gnupg under denyRead
  GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "commit.gpgsign",
  GIT_CONFIG_VALUE_0: "false",
  // srt sets http.proxyAuthMethod=basic through GIT_CONFIG_PARAMETERS, which pre-commit strips before cloning hook repos; srt's proxy aborts git's default credential-less CONNECT
  GIT_HTTP_PROXY_AUTHMETHOD: "basic",
  ...adapter.env?.(),
};

mkdirSync(CACHE, { recursive: true });
adapter.prepare?.();

await sandbox.run(adapter.args?.(args, { addDirs }) ?? args, env);
