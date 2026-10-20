export default {
  why: "settings.json carries hooks, env, and apiKeyHelper that an unsandboxed claude in the same folder runs even before the folder is trusted, and .claude/hooks holds the scripts those hooks run, so a run that writes them plants commands on the host; srt denies .mcp.json, .claude/commands, and .claude/agents only beneath the current folder, at any depth, so they are listed here for --add-dir folders",
  filesystem: {
    // relative, so they apply to the current folder and every --add-dir folder
    denyWrite: [".claude/settings.json", ".claude/settings.local.json", ".claude/hooks", ".mcp.json", ".claude/commands", ".claude/agents"],
  },
};
