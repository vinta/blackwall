import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

// Copied rather than linked, so a sandboxed run can change only its copies, never the host's folder
export function copyShared(from, to, names) {
  for (const name of names) {
    const source = `${from}/${name}`;
    // Removes a dotfile-manager link itself, never its target
    rmSync(`${to}/${name}`, { recursive: true, force: true });
    if (!existsSync(source)) continue;
    // -L resolves nested links too (cpSync's dereference doesn't), since their targets are unreadable in the sandbox; cp reports a dangling one and copies the rest
    spawnSync("cp", ["-RL", source, `${to}/${name}`], { stdio: "inherit" });
  }
}
