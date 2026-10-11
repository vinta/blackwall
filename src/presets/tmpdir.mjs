import { mkdirSync, realpathSync } from "node:fs";

// srt already lets the sandbox write here, unlike the rest of /tmp, where unsandboxed tools like Claude Code keep scratch files they later run
export const TMPDIR = `${realpathSync("/tmp")}/claude`;

export default {
  why: "srt sets every child's TMPDIR from the launcher's CLAUDE_CODE_TMPDIR, and Seatbelt sees /tmp/claude as /private/tmp/claude",
  filesystem: {
    allowRead: [TMPDIR],
  },

  // srt reads it from the launcher's own environment, not the child's
  prepare() {
    mkdirSync(TMPDIR, { recursive: true });
    process.env.CLAUDE_CODE_TMPDIR = TMPDIR;
  },
};
