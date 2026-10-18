import { readFileSync } from "node:fs";

export function completion() {
  process.stdout.write(readFileSync(new URL("../completions/_blackwall", import.meta.url), "utf8"));
}
