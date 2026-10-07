const TMPDIR = "/private/tmp";

export default {
  why: "srt sets the child's TMPDIR from CLAUDE_CODE_TMPDIR; /tmp alone fails Claude's Bash tool",

  grants() {
    return { allowWrite: [TMPDIR] };
  },

  env() {
    return { CLAUDE_CODE_TMPDIR: TMPDIR };
  },

  // srt reads it from the launcher's own environment, not the child's
  prepare() {
    process.env.CLAUDE_CODE_TMPDIR = TMPDIR;
  },
};
