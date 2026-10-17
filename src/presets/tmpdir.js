import { mkdirSync } from "node:fs";

import { TMPDIR } from "../constants/paths.js";

export default {
  why: "srt sets every child's TMPDIR from the launcher's CLAUDE_CODE_TMPDIR, and Seatbelt sees /tmp/claude as /private/tmp/claude; zsh writes heredocs under TMPPREFIX, /tmp/zsh by default, so they fail with `can't create temp file for here document`",
  env: {
    TMPPREFIX: `${TMPDIR}/zsh`,
  },
  filesystem: {
    allowRead: [TMPDIR],
  },

  // srt reads it from the launcher's own environment, not the child's
  prepare() {
    mkdirSync(TMPDIR, { recursive: true });
    process.env.CLAUDE_CODE_TMPDIR = TMPDIR;
  },
};
