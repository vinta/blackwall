import { mkdirSync, realpathSync } from "node:fs";

// srt already lets the sandbox write here, unlike the rest of /tmp, where unsandboxed tools like Claude Code keep scratch files they later run
const TMPDIR = `${realpathSync("/tmp")}/claude`;

export default {
  why: "srt sets the child's TMPDIR from CLAUDE_CODE_TMPDIR; /tmp/claude fails Claude's Bash tool on macOS, where Seatbelt sees /private/tmp/claude",

  grants() {
    return { allowRead: [TMPDIR] };
  },

  env() {
    return { CLAUDE_CODE_TMPDIR: TMPDIR };
  },

  // srt reads it from the launcher's own environment, not the child's
  prepare() {
    mkdirSync(TMPDIR, { recursive: true });
    process.env.CLAUDE_CODE_TMPDIR = TMPDIR;
  },
};
