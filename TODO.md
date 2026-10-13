# TODO

## Security Enhancements

- Per-command env files: `~/.blackwall/<command>.env` (e.g. `claude.env`, `codex.env`) goes only to that command, so tokens like `CLAUDE_CODE_OAUTH_TOKEN` stay away from every other sandboxed command without app-specific code in `blackwall.mjs`
- `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` strips credentials from Claude's Bash tool, hooks, and MCP children, but since v2.1.251 it also strips `CLAUDE_CONFIG_DIR` (nested `claude` calls lose the profile) and likely `GH_TOKEN`
- `HTTP_PROXY`/`HTTPS_PROXY` in the launcher env or `~/.blackwall/.env` makes srt route through that parent proxy and skip its resolved-address check (`sandbox-config.js:666`), so `deniedHosts` ranges and srt's built-in classes aren't enforced for names on that path; only IP literals under `"*"` are still judged by the callback. Options: refuse to start with a parent proxy, or warn, or document it in README and CHANGELOG
- Nested exec files: the `agent-files` denies anchor at the top of the current and `--add-dir` folders, so a sandboxed run can plant `sub/.claude/settings.json` or `sub/.claude/hooks`, which run when `claude` is later started from `sub/`. Accepted for now. If it's ever closed, push the preset's names into srt's `DANGEROUS_FILES` / `DANGEROUS_DIRECTORIES` at launch (srt's own macOS globs and Linux ripgrep scan then cover nesting); a `**/` entry in the preset works on macOS only, since srt drops user write globs on Linux
- Publish the next version: the global npm install is on 0.3.0, which still has the allow-all loopback hole

## Upstream (srt)

- `deniedDomains` has the same trailing-dot edge blackwall fixed in its callback: `canonicalizeHost` strips one dot, so `evil.com..` matches no deny entry and dials `evil.com.`
- srt's mandatory denies cover `.claude/commands` and `.claude/agents` but not `.claude/settings.json` hooks or `.claude/skills`, which execute by the same criterion

## Features

- Skill trigger evals via skill-creator: the description is 767 chars and untested against Claude Code's own sandbox errors as near-misses
- `--print-network-access`: the effective network policy as text in evaluation order, the twin of `--print-file-access`, including srt's built-in refused classes that `--print-config` leaves out
- CIDR ranges in `network.allowedHosts`: the callback allows an IP literal inside the range. Needs `strictAllowlist` off whenever a CIDR is present, and a README note that it matches literal requests only, never a name resolving into the range
- Expose `network.allowLocalBinding` under `overrideDefaults`, for dev servers that bind a port inside the sandbox
- Git worktree detection (agent-safehouse): when `git rev-parse --git-common-dir` is outside cwd and `--add-dir`s, grant it read/write and keep its `hooks/` and `config` in `denyWrite`. If it passes srt `git.safeDirectories`, srt numbers its `safe.directory` entries from the launcher's `GIT_CONFIG_COUNT`, not the child env's, so they overwrite the git preset's `commit.gpgsign=false`
- Escape hatch for commands that can't run sandboxed, e.g. playwright (enclave's `unboxexec`): a daemon on a Unix socket runs allowlisted commands outside. Exec argv directly, never through a shell
- Signed commits from sandboxed runs: gpg can't reach `~/.gnupg`, so commits are unsigned. Until then: `git rebase --exec 'git commit --amend --no-edit -S' <base>`

## Unverified

- Data-protection keychain items through `com.apple.securityd.xpc`, which srt allows (login keychain items were shown unreadable: `security find-generic-password` can't find them)
