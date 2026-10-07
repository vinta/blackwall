# Changelog

## vX.Y.Z / xxxx-xx-xx

- Requires Node.js 22.15.0 or later
- The network is an allowlist now: only the hosts in presets and adapters are allowed. `python`, `npm`, and `github` are on by default, `mac` and `linux` are added automatically, and `blackwall claude` and `blackwall codex` allow the hosts they need. Add `"*"` to `network.allowedDomains` to allow every host again
- Every `~/.blackwall/.env` key goes to every command, `CLAUDE_CODE_OAUTH_TOKEN` included, and `BLACKWALL_*` keys configure `blackwall` itself
- `blackwall claude` copies your `CLAUDE.md`, `rules`, `skills`, `agents`, `commands`, and `output-styles` from `~/.claude` on every launch, and loads your plugins from `~/.claude/plugins` read-only
- `blackwall codex` runs Codex with its own `~/.codex-blackwall` config folder, copies your `AGENTS.md`, `agents`, `prompts`, `rules`, and `skills` from `~/.codex` on every launch, and turns off Codex's own sandbox, which can't start inside blackwall's
- `BLACKWALL_USE_SELF_SIGNED_NODE=1` gives `blackwall` its own identity in firewall apps like Little Snitch
- Per-project config in `.blackwall/config.json`, loaded only after `blackwall --trust`
- `blackwall --print-file-access` shows what the sandbox can read and write
- `blackwall --print-env` shows the env vars blackwall adds for each command, with the workaround each one is for
- `blackwall --print-config` no longer lists the paths srt needs to run, like `/private/tmp`. srt still gets them
- Removed `blackwall --print-default-config`
- Linux: reads `/usr/local`, `/lib64`, and `/usr/lib64`, and `enableWeakerNestedSandbox` can be set for Docker

## v0.1.0 / 2026-10-01

- First release
- `blackwall <command>` runs any command in an [srt](https://github.com/anthropics/sandbox-runtime) sandbox, with every host allowed
- Writes are limited to the current folder, `--add-dir` folders, `/private/tmp`, and `~/.cache/blackwall`
- Reads are blocked by default, except those folders and what dev tools need
- `blackwall claude` runs Claude Code with its own `~/.claude-blackwall` profile
- Tokens come from an optional `~/.blackwall/.env`: `GH_TOKEN` goes to every command, and `CLAUDE_CODE_OAUTH_TOKEN` only goes to `claude`
- `gh`, `uv`, `npm`, and `pre-commit` use their own caches in `~/.cache/blackwall`, so a sandboxed run never writes to your host caches
- Commits made in the sandbox aren't GPG-signed, since `~/.gnupg` is unreadable
- Customize the defaults in `~/.blackwall/config.json`, and check the result with `blackwall --print-config`
