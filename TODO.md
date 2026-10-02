# TODO

## Security Enhancements

- Per-command env files: `~/.blackwall/<command>.env` (e.g. `claude.env`, `codex.env`) goes only to that command, so tokens like `CLAUDE_CODE_OAUTH_TOKEN` stay away from every other sandboxed command without app-specific code in `blackwall.mjs`
- srt `credentials` masking for `CLAUDE_CODE_OAUTH_TOKEN` and `GH_TOKEN`: the sandboxed process holds a stand-in value and srt's proxy injects the real one. Check whether it needs HTTPS interception (a CA the sandboxed process trusts)
- Hide files inside an allowed folder, e.g. cwd `.env`: srt's `allowRead` wins over `denyRead`, so this needs an srt change (upstream request) or the masking above. agent-safehouse does it with an appended Seatbelt profile
- `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` strips credentials from Claude's Bash tool, hooks, and MCP children, but since v2.1.251 it also strips `CLAUDE_CONFIG_DIR` (nested `claude` calls lose the profile) and likely `GH_TOKEN`
- `denyWrite` cwd `CLAUDE.md`, `.claude/settings.json`, `.claude/settings.local.json`, and `.claude/skills`: srt's mandatory denies cover only `.claude/commands` and `.claude/agents`, so a sandboxed run can plant instructions or hooks that an unsandboxed `claude` in the same project loads. Same for `--add-dir` folders. Check whether Claude Code warns when project hooks change
- Threat-model section in the README, like sandfence's in-scope/out-of-scope list: full internet; cwd secrets readable; tokens visible to every command; `~/.blackwall/.env` readable by any host process while 1Password is unlocked; unsigned commits; same kernel and user as the host

## Features

- In-sandbox test script (sandfence's `./test.sh`): run real commands inside the sandbox with a stub `HOME` and `.env`, and assert each allow/deny: cwd read/write, `~/.ssh` and `~/.zshrc` denied, `~/Desktop` write denied, cwd `.git/config` write denied, `--add-dir` `.git/hooks` denied, cache writable, curl 200, `gh` loads, config errors exit 2
- Git worktree detection (agent-safehouse): when `git rev-parse --git-common-dir` is outside cwd and `--add-dir`s, grant it read/write and keep its `hooks/` and `config` in `denyWrite`
- Escape hatch for commands that can't run sandboxed, e.g. playwright (enclave's `unboxexec`): a daemon on a Unix socket runs allowlisted commands outside. Exec argv directly, never through a shell
- Agent skill or `autoMode.environment` entry telling the agent it's sandboxed (enclave's `enclave skill --install`); srt already sets `SANDBOX_RUNTIME=1`
- Signed commits from sandboxed runs: gpg can't reach `~/.gnupg`, so commits are unsigned. Until then: `git rebase --exec 'git commit --amend --no-edit -S' <base>`
- Signed node with a self-signed code-signing certificate instead of ad-hoc: the identity survives a Node upgrade, so Little Snitch doesn't alert again
- `--print-config` lists which config files loaded (enclave's `enclave config`)
- Codex support: `~/.codex` is under `denyRead ~/`, and its own Seatbelt sandbox likely can't nest inside srt (unverified)

## Unverified

- WebFetch honoring srt's proxy (only curl, `gh api`, and the Claude API call were measured)
- Plugin marketplace auto-update under read-only `~/.claude/plugins`: if it aborts instead of warning, set `autoUpdate: false` in the profile
- Hosts a `claude` run needs beyond `api.anthropic.com` when `allowedDomains` is a strict allowlist
- Whether `/Library/Application Support/ClaudeCode` (managed settings) needs a read grant, so an unreadable file isn't taken for a broken policy
- srt passes the profile inline to `sandbox-exec -p`, so very long path lists may hit ARG_MAX (Claude Code issue #73468)
- The Keychain `securityd` Mach lookup inside the sandbox (only file reads of `~/Library/Keychains` were shown blocked)
