import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyShared } from "../src/adapters/shared.mjs";

const root = mkdtempSync(join(tmpdir(), "blackwall-shared-"));
try {
  const source = `${root}/source`;
  const profile = `${root}/profile`;
  mkdirSync(`${source}/skills`, { recursive: true });
  mkdirSync(profile);
  writeFileSync(`${source}/AGENTS.md`, "host instructions");
  writeFileSync(`${source}/skills/SKILL.md`, "host skill");
  copyShared(source, profile, ["AGENTS.md", "skills"]);
  assert.equal(readFileSync(`${profile}/AGENTS.md`, "utf8"), "host instructions");
  assert.equal(readFileSync(`${profile}/skills/SKILL.md`, "utf8"), "host skill");

  rmSync(`${source}/AGENTS.md`);
  rmSync(`${source}/skills`, { recursive: true });
  copyShared(source, profile, ["AGENTS.md", "skills"]);
  assert(!existsSync(`${profile}/AGENTS.md`), "deleted instructions must disappear from the profile");
  assert(!existsSync(`${profile}/skills`), "deleted skills must disappear from the profile");
  console.log("PASS  shared copies follow source deletions");
} finally {
  rmSync(root, { recursive: true, force: true });
}
