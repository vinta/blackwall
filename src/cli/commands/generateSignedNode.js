import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, renameSync } from "node:fs";
import { dirname } from "node:path";

import { SIGNED_NODE } from "../../constants/paths.js";

// An ad-hoc-signed node copy, so users can configure firewall rules for blackwall
export function generateSignedNode() {
  mkdirSync(dirname(SIGNED_NODE), { recursive: true });
  // Signed under a temp name, so an interrupted run can't leave a broken copy that counts as present
  const temp = `${SIGNED_NODE}.tmp`;
  copyFileSync(process.execPath, temp);
  execFileSync("codesign", ["-f", "-s", "-", temp], { stdio: "pipe" });
  renameSync(temp, SIGNED_NODE);

  console.log(`blackwall: generated ${SIGNED_NODE}`);
}
