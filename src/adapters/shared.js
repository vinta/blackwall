import { cpSync, rmSync, statSync } from "node:fs";

// Copied rather than linked, so a sandboxed run can change only its copies, never the host's folder
export function copyShared(from, to, names) {
  for (const name of names) {
    // Removes a dotfile-manager link itself, never its target
    rmSync(`${to}/${name}`, { recursive: true, force: true });
    cpSync(`${from}/${name}`, `${to}/${name}`, {
      recursive: true,
      dereference: true,
      // Skip missing sources and dangling skill links, but let other errors stop the launch
      filter: (source) => statSync(source, { throwIfNoEntry: false }) !== undefined,
    });
  }
}
