---
name: blackwall
description: "Run, configure, and debug blackwall, the sandbox for claude, codex, and other dev commands (srt: Seatbelt on macOS, bubblewrap on Linux). Use when the user asks whether this session is sandboxed or what it can read, write, or reach, mentions blackwall, wants a command run sandboxed, or wants the sandbox to reach a path, host, or tool: ~/.blackwall/config.json, .blackwall/config.json, presets, --add-dir, --trust. Also use inside a sandboxed session when a command fails with `Operation not permitted` on a path that exists, `CONNECT tunnel failed, response 403`, ENOTFOUND or `nodename nor servname provided` for every host, a write under /tmp or ~ that fails or vanishes, or blackwall itself refuses with `can't run inside a sandbox`: those are blackwall denials, not project bugs. Not for configuring Claude Code's built-in sandbox or Codex's sandbox_mode."
license: MIT
compatibility: Node.js 22.21+; macOS (Seatbelt) or Linux (bubblewrap)
allowed-tools: Bash(blackwall --print-config:*) Bash(blackwall --print-file-access:*) Bash(blackwall --print-env:*) Bash(blackwall --version)
---

# Blackwall

`blackwall <command>` runs the command under [srt](https://github.com/anthropics/sandbox-runtime) with a policy fixed at launch:

- Writes: the current folder, `--add-dir` folders, `/tmp/claude`, `~/.cache/blackwall`. Write-denied even inside those: `~/.blackwall`, `.blackwall` in the current folder, `.git/hooks` and `.git/config`, and srt's own list for the current folder (`.zshrc`, `.gitconfig`, `.mcp.json`, `.claude/commands`, …), which `blackwall --print-file-access` prints.
- Reads: those folders, the system paths and preset paths in the default config, and `allowRead` entries from the user and project configs. The rest of `~` is invisible.
- Network: only hosts from presets, the `claude` and `codex` adapters, and `network.allowedDomains`, all through srt's proxy. The sandbox has no direct DNS, so a tool that ignores `HTTPS_PROXY` can't resolve any host.

A denial is the policy working. The fix is a grant plus a relaunch, never a retry, a copy into another folder, or `sudo`.

## Inside or outside?

Inside a sandboxed session (`blackwall claude`, `blackwall codex`), `$BLACKWALL_SANDBOX` is `1`. blackwall 0.2.1 and older don't set it; there, one of these holds:

- `$CLAUDE_CONFIG_DIR` is `~/.claude-blackwall`, or `$CODEX_HOME` is `~/.codex-blackwall`
- `$GH_CONFIG_DIR`, `$UV_CACHE_DIR`, or `$NPM_CONFIG_CACHE` is under `~/.cache/blackwall`
- `$TMPDIR` is exactly `/tmp/claude` (`/private/tmp/claude` on macOS)

Inside, `blackwall` is unavailable: every flag, `--version` included, exits 2 with `blackwall: can't run inside a sandbox; run it from a plain terminal`. Diagnose from the error text and the grant list above, read the project's `.blackwall/config.json` if one exists, then hand the user the exact edit and commands. Outside (a plain terminal, or an agent that isn't sandboxed), run the `--print-*` flags and edit the user config yourself.

## Reading a denial

| The command printed | Cause | Grant |
|---|---|---|
| `Operation not permitted` on a path that exists (macOS). On Linux the path reads as missing, or a write succeeds and the file is gone after the run | path outside the read or write grants | `filesystem.allowRead` or `filesystem.allowWrite` for one path; `--add-dir DIR` for a whole folder, read and write |
| `curl: (56) CONNECT tunnel failed, response 403`; git: `unable to access '…': CONNECT tunnel failed, response 403`; Node's `fetch`: `fetch failed` caused by `Request was cancelled.`; Node's `http`: `ERR_PROXY_TUNNEL`, `HTTP/1.1 403 Forbidden` | host outside the allowlist | `network.allowedDomains`, or the preset for that tool |
| `ENOTFOUND`, `getaddrinfo` failure, `[Errno 8] nodename nor servname provided, or not known`, for allowed hosts too | the tool ignores `HTTPS_PROXY` | make it use the proxy; no config change. curl, git, gh, npm, pip, uv, and urllib honor it already, and so do Node's `fetch` and `http` (22.21+) through the `node` preset's `NODE_USE_ENV_PROXY=1` |
| `blackwall: …/.blackwall/config.json: not trusted. Review it, then run \`blackwall --trust\`` | project config is new or edited | the user reviews it and runs `blackwall --trust` |
| `blackwall: …/.blackwall/.env: loads only with a trusted .blackwall/config.json` | project `.env` without a trusted config | add `.blackwall/config.json` (`{}` is enough), then `--trust` |
| `blackwall: unknown preset <name>`; `blackwall: <file>: unknown key <key>`; `must be a list of strings` (exit 2) | config typo | fix the key; preset names are under Config |
| `sandbox_apply: Operation not permitted` from `codex` | Seatbelt can't nest | `blackwall codex` already passes `-c sandbox_mode="danger-full-access"`; a codex started from inside another sandboxed command needs the same flag |
| git: `could not write config file .git/config: Operation not permitted`. `git remote add`, `git config`, `git branch -m` fail; `git push -u`, `git branch -D`, `git switch -c` exit 0 but lose the tracking update | `.git/config` is write-denied, no grant lifts it | none. The user sets remotes and upstreams on the host; push with `git push origin HEAD` |

Noise, harmless, the command still ran:

- git: `fatal: failed to store: -60008`, the keychain credential helper can't save
- `make: error: couldn't create cache file '/var/folders/…/xcrun_db-…' (errno=Operation not permitted)`, same from `xcrun`
- pip: `WARNING: The directory '…/Library/Caches/pip' or its parent directory is not owned or is not writable … The cache has been disabled`

## Granting the narrowest thing

1. Confirm the denial: a marker from "Inside or outside?" plus a row above. Then ask whether the task needs the grant at all: writing under the current folder or `$TMPDIR`, or `npx` instead of a global install, needs none.
2. Pick the grant, narrowest first:
   - One run, one folder, read and write: `blackwall --add-dir DIR <command>`. Under `blackwall claude` the folder is also passed to claude as `--add-dir`.
   - One path: `filesystem.allowRead` or `filesystem.allowWrite`. One host: `network.allowedDomains` (`*.example.com` wildcards work). Everything one tool needs: its preset.
   - Per project: `.blackwall/config.json`. Per machine: `~/.blackwall/config.json`. Secrets: `~/.blackwall/.env` or `.blackwall/.env`, never a config file.
   - `"*"` in `allowedDomains` and `overrideDefaults.filesystem.denyRead` open the sandbox; propose them only when the user asks for an open sandbox.
   - Credentials under `~/.ssh`, `~/.aws`, `~/.gnupg`, and writes to `~/.claude`, `~/.codex`, `~/.blackwall` are what the sandbox exists to deny: report the need to the user instead of proposing a grant.
3. Deliver. Inside: print the JSON to add, the file it goes in, and the commands, for the user to run outside. Outside: write `~/.blackwall/config.json` yourself; for a project config, write it and leave `blackwall --trust` to the user, who re-runs it after every edit. `--trust` exists so a human reviews the file.
4. Relaunch: config loads at launch, so the user restarts the sandboxed command and reruns what failed. Done when it passes with that grant and nothing broader.

## Config

`~/.blackwall/config.json` and `.blackwall/config.json` take the same keys. Lists from both are added to the defaults. `overrideDefaults` replaces a default value, the project's winning over the user's, and is applied first. `~` expands.

```json
{
  "network": { "allowedDomains": ["api.example.com", "*.example.com"] },
  "filesystem": { "allowRead": ["~/.npmrc", "/path/to/other/repo"], "allowWrite": [] },
  "overrideDefaults": { "presets": ["github", "git"], "allowPty": false }
}
```

- Presets: `python`, `node`, `github`, `git`, `pre-commit`, `private-network` are on by default; `tmpdir`, `mac`, `linux` are always on. Each is one tool's hosts, read paths, and env vars. What each grants: https://github.com/vinta/blackwall#presets
- Dropping `git` from `presets` makes every sandboxed `git` refuse to start when `~/.gitconfig` exists.
- `.blackwall/.env` keys override `~/.blackwall/.env` and reach only the sandboxed command.
- Verify outside: `blackwall --print-config claude` (merged config with the launch-time grants), `blackwall --print-file-access claude` (srt's view), `blackwall --print-env claude` (env vars blackwall adds, each with its why).

## Run and install

```bash
npm install -g blackwall-sandbox                                   # Node.js 22.15+
sudo apt-get install -y bubblewrap socat ripgrep                   # Linux only
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0      # Ubuntu 24.04+ only
blackwall claude                                                   # or codex, or any command
blackwall --add-dir ../other-repo claude
blackwall --trust                                                  # in the project, after reviewing .blackwall/config.json
```

`blackwall` with no command prints the one-line usage. There is no `--help`: `blackwall --help` runs a command named `--help`. Exit 2 means a usage or config error.

## Under `blackwall claude` and `blackwall codex`

- claude's config folder is `~/.claude-blackwall`, codex's is `~/.codex-blackwall`. `CLAUDE.md`, `rules`, `skills`, `agents`, `commands`, `output-styles` (claude) and `AGENTS.md`, `agents`, `rules`, plus `~/.agents/skills` (codex) are copied from the host folders on every launch, so edits to the copies vanish. User-level instruction and skill edits happen outside, in `~/.claude` or `~/.codex`; files in the current folder persist.
- `~/.claude-blackwall/settings.json` is separate and starts with only `enabledPlugins`: host hooks and permissions don't apply. Plugins load from `~/.claude/plugins` read-only, auto-update off.
- Login is separate: `/login`, or `CLAUDE_CODE_OAUTH_TOKEN` in `~/.blackwall/.env`; for codex, `blackwall codex login --device-auth`.
- Commits are unsigned: `commit.gpgsign=false` is injected because gpg can't reach `~/.gnupg`.
- Temp files go under `$TMPDIR` (`/tmp/claude`); the rest of `/tmp` is write-denied.
- Codex's own sandbox is off inside; blackwall is the sandbox.
