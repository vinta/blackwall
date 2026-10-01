# Changelog

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
