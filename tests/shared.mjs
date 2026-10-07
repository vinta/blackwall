import assert from "node:assert/strict";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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

  mkdirSync(`${source}/skills/nested`, { recursive: true });
  writeFileSync(`${root}/SKILL.md`, "linked skill");
  symlinkSync(`${root}/SKILL.md`, `${source}/skills/nested/SKILL.md`);
  symlinkSync(`${root}/missing`, `${source}/skills/dangling`);
  copyShared(source, profile, ["skills"]);
  assert.equal(readFileSync(`${profile}/skills/nested/SKILL.md`, "utf8"), "linked skill");
  assert(!lstatSync(`${profile}/skills/nested/SKILL.md`).isSymbolicLink());
  assert(!existsSync(`${profile}/skills/dangling`));
  console.log("PASS  nested skill links are copied and dangling links are skipped");

  writeFileSync(`${source}/AGENTS.md`, "unreadable instructions");
  chmodSync(`${source}/AGENTS.md`, 0);
  try {
    assert.throws(() => copyShared(source, profile, ["AGENTS.md"]), { code: "EACCES" });
  } finally {
    chmodSync(`${source}/AGENTS.md`, 0o600);
  }
  console.log("PASS  unreadable shared instructions stop copying");
} finally {
  rmSync(root, { recursive: true, force: true });
}
