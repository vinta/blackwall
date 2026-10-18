import { mkdirSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";

import packageJson from "../../package.json" with { type: "json" };
import claude from "../adapters/claude.js";
import codex from "../adapters/codex.js";
import { buildConfig, readProjectEnv } from "../config/config.js";
import { SANDBOX_CACHE } from "../constants/paths.js";
import { createSandbox } from "../sandbox/srt.js";
import { completion } from "./commands/completion.js";
import { printConfig } from "./commands/printConfig.js";
import { printEnv } from "./commands/printEnv.js";
import { printFileAccess } from "./commands/printFileAccess.js";
import { printNetworkAccess } from "./commands/printNetworkAccess.js";
import { trust } from "./commands/trust.js";

const USAGE = "usage: blackwall [--add-dir DIR]... [--print-config | --print-file-access | --print-network-access | --print-env | --trust | --version | --completion zsh | --help] [--] <command> [args...]";

// Each adapter handles one command's quirks, matched by the command's name
const ADAPTERS = { claude, codex };

export async function main(args) {
  const addDirs = [];
  let showConfig = false;
  let showFileAccess = false;
  let showNetworkAccess = false;
  let showEnv = false;
  while (true) {
    if (args[0] === "--add-dir") {
      args.shift();
      if (!args[0]) exitWithError("--add-dir needs a folder");
      if (!statSync(args[0], { throwIfNoEntry: false })?.isDirectory()) exitWithError(`--add-dir ${args[0]}: not a folder`);
      addDirs.push(resolve(args.shift()));
    } else if (args[0] === "--print-config") {
      args.shift();
      showConfig = true;
    } else if (args[0] === "--print-file-access") {
      args.shift();
      showFileAccess = true;
    } else if (args[0] === "--print-network-access") {
      args.shift();
      showNetworkAccess = true;
    } else if (args[0] === "--print-env") {
      args.shift();
      showEnv = true;
    } else if (args[0] === "--trust") {
      trust();
      process.exit(0);
    } else if (args[0] === "--completion") {
      args.shift();
      if (args[0] !== "zsh") exitWithError("--completion supports zsh only");
      completion();
      process.exit(0);
    } else if (args[0] === "--version") {
      console.log(packageJson.version);
      process.exit(0);
    } else if (args[0] === "--help" || args[0] === "-h") {
      console.log(USAGE);
      process.exit(0);
    } else if (args[0]?.startsWith("-") && args[0] !== "--") {
      // No program name starts with -, so this is a mistyped flag; -- still runs one
      console.error(`blackwall: unknown option ${args[0]}`);
      exitWithUsage();
    } else {
      break;
    }
  }

  if (args[0] === "--") args.shift();
  if (!args[0] && !showConfig && !showFileAccess && !showNetworkAccess && !showEnv) exitWithUsage();

  const name = basename(args[0] ?? "");
  const adapter = Object.hasOwn(ADAPTERS, name) ? ADAPTERS[name] : {};
  const { config, presets } = buildConfig({ addDirs, additions: adapter.config?.() ?? {} });

  const sandbox = createSandbox(config);

  if (showConfig) {
    printConfig(config);
    process.exit(0);
  }

  if (showFileAccess) {
    await printFileAccess(sandbox.srtConfig);
    process.exit(0);
  }

  if (showNetworkAccess) {
    printNetworkAccess(sandbox.srtConfig, sandbox.deniedNames);
    process.exit(0);
  }

  // Each label names where its vars come from, for --print-env
  const envSources = [
    ["blackwall: tells scripts they run inside blackwall", { BLACKWALL_SANDBOX: "1" }],
    ...presets.filter((preset) => Object.keys(preset.env).length).map((preset) => [`preset ${preset.name}: ${preset.why}`, preset.env]),
    ...(adapter.env ? [[`adapter ${name}`, adapter.env()]] : []),
  ];

  if (showEnv) {
    printEnv(envSources);
    process.exit(0);
  }

  // The project's .env goes only to the command, never into process.env, so its NODE_OPTIONS can't reach an unsandboxed node. It overrides ~/.blackwall/.env but not blackwall's own vars
  // Built before prepare() runs, so a process.env write there reaches srt, never the command
  const env = { ...process.env, ...readProjectEnv(), ...Object.assign({}, ...envSources.map(([, vars]) => vars)) };

  mkdirSync(SANDBOX_CACHE, { recursive: true });
  for (const preset of presets) preset.prepare?.();
  adapter.prepare?.();

  await sandbox.run(adapter.args?.(args, { addDirs }) ?? args, env);
}

function exitWithUsage() {
  console.error(USAGE);
  process.exit(2);
}

function exitWithError(message) {
  console.error(`blackwall: ${message}`);
  process.exit(2);
}
