#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { basename, dirname } from "node:path";
import { parseEnv } from "node:util";

import { main } from "./cli/index.mjs";
import { readIfExists } from "./config/config.mjs";
import { HOME, SIGNED_NODE } from "./constants/paths.mjs";

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
    execFileSync("codesign", ["-f", "-s", "-", temp], { stdio: "pipe" });
    renameSync(temp, SIGNED_NODE);
  }

  // Replaces this process in place, keeping its pid and stdio, so the terminal sees one process,
  // so that blackwall runs in signed node, not plain node
  process.execve(SIGNED_NODE, [SIGNED_NODE, ...process.execArgv, ...process.argv.slice(1)]);
}

await main(process.argv.slice(2));
