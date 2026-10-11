import { mkdirSync } from "node:fs";

import { TMPDIR } from "../paths.mjs";

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
