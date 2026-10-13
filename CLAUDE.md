# CLAUDE.md

## Presets

- A rule that applies through the config, a host, a path, or an env var, goes in a preset in `src/presets/`, never hardcoded in `buildConfig`, so the user can drop it with `overrideDefaults.presets` and see it in `--print-config`.
- The only exceptions are what the user must not turn off: what the sandbox itself needs to run, and what keeps a run from forging trust or replacing blackwall.
- Deny writes only to files a program executes with no model in between: hooks and the settings that register them, env, and apiKeyHelper, MCP config, git hooks and config, shell rc files. Leave instruction files the model reads (CLAUDE.md, AGENTS.md, .claude/rules, .claude/skills, .codex, .agents) writable: prompt injection through them works in an unsandboxed session too, and denying them makes daily work harder than it makes the sandbox safer.
- Presets are `.mjs` modules with one exported shape, never a `.json`/`.mjs` mix: a mixed folder reads as two concepts.

## Network

- Two lists, `allowedHosts` and `deniedHosts`: no regex entries, no third key, no aliases for old keys, since you are the only user.
- Deny precisely and let an `allowedHosts` entry override; never a block-everything rule. Public bare-IP URLs work under `"*"`.
- Match hosts with srt's own matchers (`canonicalizeHost`, `matchesDomainPatternWithPort`, the resolved-address guard). Blackwall's own code validates `deniedHosts` names only, because srt's "overly broad" wildcard rule rejects `*.localhost`.

## srt

- Imports from srt's `dist/` are internals outside its public index: guard each in `tests/config.mjs` and run e2e on every srt bump.

## Tests

- A platform claim in `skills/blackwall/SKILL.md` ships with an e2e check in the same change.
- In `tests/e2e.sh` (pipefail), check error text with `grep -q … <<<"$(cmd 2>&1)"`, not `cmd 2>&1 | grep -q`: the failing command's status wins the pipe.
