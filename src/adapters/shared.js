import { cpSync, lstatSync, mkdirSync, rmSync, statSync } from "node:fs";

export function mkdirManaged(path) {
  // Recursive mkdir accepts a link to a folder without throwing, so check for the link first
  if (lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) {
    console.error(`blackwall: ${path} is a symlink. A sandboxed command may have planted it to reach what it points to; remove it and relaunch`);
    process.exit(2);
  }
  mkdirSync(path, { recursive: true });
}

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
