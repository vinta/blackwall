#!/usr/bin/env node
import { existsSync } from "node:fs";
import { basename } from "node:path";
import { parseEnv } from "node:util";

import { main } from "./cli/index.js";
import { readIfExists } from "./config/config.js";
import { HOME, SIGNED_NODE } from "./constants/paths.js";

// Seatbelt can't nest, and inside, ~/.blackwall is unreadable
if (process.env.BLACKWALL_SANDBOX === "1") {
  console.error("blackwall: can't run inside a sandbox; run it from a plain terminal");
  process.exit(2);
}
if (process.platform !== "darwin") {
  console.error("blackwall: works on macOS only");
  process.exit(2);
}

// main() parses flags too late, since this .env and the signed node check below already depend on them. Flags end at the command or --
let noConfig = false;
let generateSignedNode = false;
const args = process.argv.slice(2);
for (let i = 0; i < args.length && args[i].startsWith("-") && args[i] !== "--"; i += args[i] === "--add-dir" ? 2 : 1) {
  if (args[i] === "--no-config") noConfig = true;
  if (args[i] === "--generate-signed-node") generateSignedNode = true;
}
if (!noConfig) Object.assign(process.env, parseEnv(readIfExists(`${HOME}/.blackwall/.env`) ?? ""));

// --generate-signed-node copies process.execPath, so it stays in plain node rather than copy the copy
if (!generateSignedNode && existsSync(SIGNED_NODE) && basename(process.execPath) !== basename(SIGNED_NODE)) {
  // Replaces this process in place, keeping its pid and stdio, so the terminal sees one process,
  // so that blackwall runs in signed node, not plain node
  process.execve(SIGNED_NODE, [SIGNED_NODE, ...process.execArgv, ...process.argv.slice(1)]);
}

await main(process.argv.slice(2));
