export default {
  why: "settings.json carries hooks, env, and apiKeyHelper that an unsandboxed claude in the same folder runs even before the folder is trusted, and .claude/hooks holds the scripts those hooks run, so a run that writes them plants commands on the host",
  filesystem: {
    // relative, so they apply to the current folder and every --add-dir folder
    denyWrite: [".claude/settings.json", ".claude/settings.local.json", ".claude/hooks"],
  },
};
