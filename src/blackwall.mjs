#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { parseEnv } from "node:util";

import packageJson from "../package.json" with { type: "json" };
import claude from "./adapters/claude.mjs";
import codex from "./adapters/codex.mjs";
import { buildConfig, readIfExists, readProjectEnv, trustProjectConfig } from "./config/config.mjs";
import { CACHE, HOME, SIGNED_NODE } from "./constants/paths.mjs";
import { createSandbox } from "./sandbox/srt.mjs";

const USAGE = "usage: blackwall [--add-dir DIR]... [--print-config | --print-file-access | --print-env | --trust | --version] [--] <command> [args...]";

// Each adapter handles one command's quirks, matched by the command's name
const ADAPTERS = { claude, codex };

// Seatbelt can't nest, and inside, ~/.blackwall is unreadable on macOS and empty on Linux
if (process.env.BLACKWALL_SANDBOX === "1") {
  console.error("blackwall: can't run inside a sandbox; run it from a plain terminal");
  process.exit(2);
}

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

  // Replaces this process in place, keeping its pid and stdio, so the terminal sees one process,
  // so that blackwall runs in signed node, not plain node
  process.execve(SIGNED_NODE, [SIGNED_NODE, ...process.execArgv, ...process.argv.slice(1)]);
}

const args = process.argv.slice(2);
const addDirs = [];
let printConfig = false;
let printFileAccess = false;
let printEnv = false;
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
  } else if (args[0] === "--print-env") {
    args.shift();
    printEnv = true;
  } else if (args[0] === "--trust") {
    console.log(`blackwall: trusted ${trustProjectConfig()}`);
    process.exit(0);
  } else if (args[0] === "--version") {
    console.log(packageJson.version);
    process.exit(0);
  } else {
    break;
  }
}

if (args[0] === "--") args.shift();
if (!args[0] && !printConfig && !printFileAccess && !printEnv) exitWithUsage();

function exitWithUsage() {
  console.error(USAGE);
  process.exit(2);
}

const name = basename(args[0] ?? "");
const adapter = Object.hasOwn(ADAPTERS, name) ? ADAPTERS[name] : {};
const { config, presets } = buildConfig({ addDirs, additions: adapter.config?.() ?? {} });

const sandbox = createSandbox(config);

if (printConfig) {
  console.log(JSON.stringify(config, null, 2));
  process.exit(0);
}

if (printFileAccess) {
  await sandbox.printFileAccess();
  process.exit(0);
}

// Each label names where its vars come from, for --print-env
const envSources = [
  ["blackwall: tells scripts they run inside blackwall", { BLACKWALL_SANDBOX: "1" }],
  ...presets.filter((preset) => Object.keys(preset.env).length).map((preset) => [`preset ${preset.name}: ${preset.why}`, preset.env]),
  ...(adapter.env ? [[`adapter ${name}`, adapter.env()]] : []),
];

// Only blackwall's own vars, so keys from ~/.blackwall/.env never reach the terminal
if (printEnv) {
  for (const [label, vars] of envSources) {
    console.log(`# ${label}`);
    for (const [key, value] of Object.entries(vars)) console.log(`${key}=${value}`);
  }
  console.log("# srt adds its proxy, TMPDIR, and git vars at launch");
  process.exit(0);
}

// The project's .env goes only to the command, never into process.env, so its NODE_OPTIONS can't reach an unsandboxed node. It overrides ~/.blackwall/.env but not blackwall's own vars
// Built before prepare() runs, so a process.env write there reaches srt, never the command
const env = { ...process.env, ...readProjectEnv(), ...Object.assign({}, ...envSources.map(([, vars]) => vars)) };

mkdirSync(CACHE, { recursive: true });
for (const preset of presets) preset.prepare?.();
adapter.prepare?.();

await sandbox.run(adapter.args?.(args, { addDirs }) ?? args, env);
