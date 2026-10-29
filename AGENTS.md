# AGENTS.md

## Security

- Judge every security topic about this project, whether you change code, answer, decide, or review, against the `## Threat Model` section of README.md, and read it first: the attacker is the command inside the sandbox, acting alone across launches. A finding that needs the user to run a hostile command or widen a grant is out of scope; one that needs a trusted project config is a trust gap, not an escape.

## Presets

- A rule that applies through the config, a host, a path, or an env var, goes in a preset in `src/presets/`, never hardcoded in `buildConfig`, so the user can drop it with `overrideDefaults.presets` and see it in `--print-config`.
- The only exceptions are what the user must not turn off: what the sandbox itself needs to run, and what keeps a run from forging trust or replacing blackwall.
- Deny writes only to files a program executes with no model in between: hooks and the settings that register them, env, and apiKeyHelper, MCP config, git hooks and config, shell rc files. Leave instruction files the model reads (CLAUDE.md, AGENTS.md, .claude/rules, .claude/skills, .codex, .agents) writable: prompt injection through them works in an unsandboxed session too, and denying them makes daily work harder than it makes the sandbox safer.

## Network

- Deny precisely and let an `allowedHosts` entry override; never a block-everything rule. Public bare-IP URLs work under `"*"`.
- Match hosts with srt's own matchers (`canonicalizeHost`, `matchesDomainPatternWithPort`, the resolved-address guard). Blackwall's own code validates `deniedHosts` names only, because srt's "overly broad" wildcard rule rejects `*.localhost`.

## srt

- Imports from srt's `dist/` are internals outside its public index: guard each in `tests/config.js` and run e2e on every srt bump.

## Tests

- A platform claim in `skills/blackwall/SKILL.md` ships with an e2e check in the same change.
- In `tests/e2e/**/*.bats`, check with `run -N`, `run !`, and bats-assert (`assert_output`, `refute`): a bare `run` always passes, `! cmd` before a test's last line never fails it, and neither does `[[ ]]` under macOS's bash 3.2.
- To run one folder under `tests/e2e/`, pass `--setup-suite-file tests/e2e/setup_suite.bash`: bats looks for `setup_suite.bash` only in the folder of the first `*.bats` file, so without it `TOOL_GRANTS` stays empty and `claude` is not found.

## Release

- To publish, push a `v*` tag matching the `package.json` version: `.github/workflows/publish.yml` runs `npm publish` with provenance, so a local `npm publish` skips provenance and makes that run fail.
