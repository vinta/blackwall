# TODO

## Security Enhancements

- Per-command env files: `~/.blackwall/<command>.env` (e.g. `claude.env`, `codex.env`) goes only to that command, so tokens like `CLAUDE_CODE_OAUTH_TOKEN` stay away from every other sandboxed command without app-specific code in `blackwall.mjs`
- `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` strips credentials from Claude's Bash tool, hooks, and MCP children, but since v2.1.251 it also strips `CLAUDE_CONFIG_DIR` (nested `claude` calls lose the profile) and likely `GH_TOKEN`
- `denyWrite` cwd `CLAUDE.md`, `.claude/settings.json`, `.claude/settings.local.json`, and `.claude/skills`: srt's mandatory denies cover only `.claude/commands` and `.claude/agents`, so a sandboxed run can plant instructions or hooks that an unsandboxed `claude` in the same project loads. Same for `--add-dir` folders. Check whether Claude Code warns when project hooks change

## Features

- e2e checks `tests/e2e.sh` still lacks: cwd `.git/config` write denied, `--add-dir` `.git/hooks` denied, cache writable, `gh` loads, config errors exit 2
- Git worktree detection (agent-safehouse): when `git rev-parse --git-common-dir` is outside cwd and `--add-dir`s, grant it read/write and keep its `hooks/` and `config` in `denyWrite`
- Escape hatch for commands that can't run sandboxed, e.g. playwright (enclave's `unboxexec`): a daemon on a Unix socket runs allowlisted commands outside. Exec argv directly, never through a shell
- Signed commits from sandboxed runs: gpg can't reach `~/.gnupg`, so commits are unsigned. Until then: `git rebase --exec 'git commit --amend --no-edit -S' <base>`

## Unverified

- Data-protection keychain items through `com.apple.securityd.xpc`, which srt allows (login keychain items were shown unreadable: `security find-generic-password` can't find them)
