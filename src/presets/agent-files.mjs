export default {
  why: "an unsandboxed claude or codex in the same folder loads these, so a run that writes them plants hooks, skills, or instructions on the host",
  filesystem: {
    // relative, so they apply to the current folder and every --add-dir folder
    denyWrite: [".claude/settings.json", ".claude/settings.local.json", ".claude/skills", ".claude/hooks", "CLAUDE.md", "CLAUDE.local.md", "AGENTS.md", ".codex", ".agents"],
  },
};
