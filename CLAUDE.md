# CLAUDE.md

## Presets

- A rule that applies through the config, a host, a path, or an env var, goes in a preset in `src/presets/`, never hardcoded in `buildConfig`, so the user can drop it with `overrideDefaults.presets` and see it in `--print-config`.
- The only exceptions are what the user must not turn off: what the sandbox itself needs to run, and what keeps a run from forging trust or replacing blackwall.
- Deny writes only to files a program executes with no model in between: hooks and the settings that register them, env, and apiKeyHelper, MCP config, git hooks and config, shell rc files. Leave instruction files the model reads (CLAUDE.md, AGENTS.md, .claude/rules, .claude/skills, .codex, .agents) writable: prompt injection through them works in an unsandboxed session too, and denying them makes daily work harder than it makes the sandbox safer.
