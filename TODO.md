# TODO

## Security Enhancements

- Per-command env files: `~/.blackwall/<command>.env` (e.g. `claude.env`, `codex.env`) goes only to that command, so tokens like `CLAUDE_CODE_OAUTH_TOKEN` stay away from every other sandboxed command without app-specific code in `blackwall.mjs`
- `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` strips credentials from Claude's Bash tool, hooks, and MCP children, but since v2.1.251 it also strips `CLAUDE_CONFIG_DIR` (nested `claude` calls lose the profile) and likely `GH_TOKEN`
- `denyWrite` cwd `CLAUDE.md`, `.claude/settings.json`, `.claude/settings.local.json`, and `.claude/skills`: srt's mandatory denies cover only `.claude/commands` and `.claude/agents`, so a sandboxed run can plant instructions or hooks that an unsandboxed `claude` in the same project loads. Same for `--add-dir` folders. Check whether Claude Code warns when project hooks change

## Features

- Git worktree detection (agent-safehouse): when `git rev-parse --git-common-dir` is outside cwd and `--add-dir`s, grant it read/write and keep its `hooks/` and `config` in `denyWrite`. If it passes srt `git.safeDirectories`, srt numbers its `safe.directory` entries from the launcher's `GIT_CONFIG_COUNT`, not the child env's, so they overwrite the git preset's `commit.gpgsign=false`
- Escape hatch for commands that can't run sandboxed, e.g. playwright (enclave's `unboxexec`): a daemon on a Unix socket runs allowlisted commands outside. Exec argv directly, never through a shell
- Signed commits from sandboxed runs: gpg can't reach `~/.gnupg`, so commits are unsigned. Until then: `git rebase --exec 'git commit --amend --no-edit -S' <base>`
- Presets assume the default XDG folders (`~/.config`, `~/.cache`, `~/.local/share`). With `XDG_CONFIG_HOME` pointing elsewhere and a git config there, sandboxed git dies with `unable to access`, since git treats EPERM as fatal. Fix: build preset paths on the `XDG_*` vars in `paths.mjs`

## Skill

- `BLACKWALL=1` in every sandboxed command's env, so skills and scripts can tell blackwall from Claude Code's own srt sandbox without reading `CLAUDE_CONFIG_DIR` or the cache dirs (nono's `NONO_CAP_FILE`, enclave's `ENCLAVE_SANDBOX=1`)
- Copy `skills/blackwall` into the claude and codex profiles at launch, so every sandboxed agent has the skill without `npx skills add` (enclave's `skill --install`; Sentry embeds its skill in the CLI). Needs `skills/` in package.json `files`
- `NODE_USE_ENV_PROXY=1` in the `node` preset: Node's global `fetch` ignores `HTTPS_PROXY`, so every host fails with ENOTFOUND. Node 24+. Check it doesn't double-proxy Claude Code, which reads the proxy vars itself
- `readIfExists` treats EPERM like ENOENT, so `blackwall` inside a sandbox fails with a clear nesting message instead of a stack trace from reading `~/.blackwall/.env`

## Unverified

- The skill's Linux rows (denied dirs read as empty tmpfs, writes into them vanish, `--print-*` inside omits the user config, `--trust` writes a marker that vanishes) come from srt's README and `buildConfig`, not from a Linux run. Assert them in the Linux e2e job
- Data-protection keychain items through `com.apple.securityd.xpc`, which srt allows (login keychain items were shown unreadable: `security find-generic-password` can't find them)
