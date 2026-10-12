# Changelog

## Unreleased

### Breaking Changes

- Requires Node.js 22.21.0 or later, the first 22.x with `NODE_USE_ENV_PROXY`, so the `node` preset's proxy fix holds everywhere blackwall runs

### Changes

- Upgrades srt to 0.0.79. On 0.0.78, a folder with `[` and `]` in its name, like `[wip] app`, voided every deny inside it, so a sandboxed command could write the project's `.git/hooks`

## v0.3.0 / 2026-10-11

### Breaking Changes

- The `npm` preset is now `node`, and also reads Node.js installed by fnm. Rename `npm` to `node` in your `presets`
- `git` and `pre-commit` are presets in the default list now. If you set `overrideDefaults.presets`, add `git`, or git refuses to start when it can't read your `~/.gitconfig`

### Changes

- Temp files go to `/tmp/claude` (`/private/tmp/claude` on macOS), the only part of `/tmp` a sandboxed command can write, and on macOS the only part it can read. The rest of `/tmp` holds scratch files that unsandboxed tools like Claude Code run later. On Linux the rest of `/tmp` stays readable, since srt's proxy sockets live there
- Reads only the `~/.local` folders tools need, not all of `~/.local/share` and `~/.local/state`: the `python` preset reads `~/.local/share/uv`, `blackwall claude` reads `~/.local/share/claude`, and the `github` preset reads `~/.local/share/gh/extensions`. Add other tools' folders, like mise's, to `allowRead` in your user config
- Sandboxed commands can't write to `~/.blackwall`, even under `--add-dir ~` or when run from inside it, so they can't forge trust for a project config or replace `blackwall_node`
- `UV_CACHE_DIR`, `NPM_CONFIG_CACHE`, and `GH_CONFIG_DIR` are set only with the `python`, `node`, and `github` presets, which now hold them
- Workarounds are presets now: `git` (signing off), `pre-commit`, and `tmpdir` (`/tmp/claude`) join the others in `src/presets`, each with a `why`. `git` and `pre-commit` sit in the default `presets` list, so `overrideDefaults.presets` can drop them; `tmpdir` stays on like `mac` and `linux`
- `--print-config` includes the launch-time grants: `/tmp/claude`, srt's seccomp helper on Linux, and the `.git/hooks` and `.git/config` write denies in `--add-dir` folders
- `--print-env` labels every preset that sets env vars as `# preset <name>: <why>`
- The wasilibs cache that go-re2 hooks like betterleaks read moves from `mac` to `pre-commit`, and Linux's `~/.cache/com.github.wasilibs` is read too
- `~/.gitconfig`, `~/.gitignore_global`, and `~/.config/git/ignore` move from the default `allowRead` to the `git` preset, so dropping `git` from `presets` drops them too
- The `git` preset reads `~/.config/git/config` too. Git refuses to start when its config exists but can't be read, so every sandboxed `git` command failed for users who keep their config there
- Presets follow `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_STATE_HOME`, and `XDG_CACHE_HOME` when set, so git, uv, gh, and fnm find their files when you moved those folders. The `node` preset reads fnm's per-shell links under `XDG_RUNTIME_DIR` when it is set, where fnm puts them on most Linux desktops
- Sandboxed commands get `BLACKWALL_SANDBOX=1`, so scripts and agent skills can tell blackwall from Claude Code's own sandbox, which also sets `TMPDIR=/tmp/claude`
- `blackwall` inside a sandboxed command exits 2 with `can't run inside a sandbox`. It used to die with a stack trace on macOS
- The `node` preset sets `NODE_USE_ENV_PROXY=1`. Without it, Node's `fetch` and `http` skipped srt's proxy and failed with `ENOTFOUND` for every host, allowed ones too. Needs Node 22.21+
- An agent skill in `skills/blackwall`: teaches Claude Code and Codex to run, configure, and debug blackwall, and to read a denial from inside the sandbox. `blackwall claude` and `blackwall codex` copy it into their config folders on every launch; for agents outside the sandbox, install it with `npx skills add vinta/blackwall -g`

### Environment Variables

- Per-project env vars in `.blackwall/.env`, loaded only with a trusted `.blackwall/config.json`. They override `~/.blackwall/.env` and go only to the sandboxed command

## v0.2.1 / 2026-10-08

### Arguments

- `blackwall --version` shows the version

## v0.2.0 / 2026-10-08

### Changes

- Requires Node.js 22.15.0 or later
- Upgrades srt to 0.0.78
- The network is an allowlist now: only the hosts in presets and adapters are allowed. `python`, `npm`, and `github` are on by default, `mac` and `linux` are added automatically, and `blackwall claude` and `blackwall codex` allow the hosts they need. Add `"*"` to `network.allowedDomains` to allow every host again
- Linux: reads `/usr/local`, `/lib64`, and `/usr/lib64`, and `enableWeakerNestedSandbox` can be set for Docker

### Adapters

- `blackwall claude` copies your `CLAUDE.md`, `rules`, `skills`, `agents`, `commands`, and `output-styles` from `~/.claude` on every launch, and loads your plugins from `~/.claude/plugins` read-only
- `blackwall codex` runs Codex with its own `~/.codex-blackwall` config folder, copies your `AGENTS.md`, `agents`, and `rules` from `~/.codex`, plus `skills` from `~/.agents` on every launch, and turns off Codex's own sandbox, which can't start inside blackwall's

### Arguments

- `blackwall --print-config` no longer lists the paths srt needs to run, like `/private/tmp`. srt still gets them
- `blackwall --print-file-access` shows what the sandbox can read and write
- `blackwall --print-env` shows the env vars blackwall adds for each command, with the workaround each one is for
- Per-project config in `.blackwall/config.json`, loaded only after `blackwall --trust`
- Removed `blackwall --print-default-config`

### Environment Variables

- Every `~/.blackwall/.env` key goes to every command, `CLAUDE_CODE_OAUTH_TOKEN` included, and `BLACKWALL_*` keys configure `blackwall` itself
- `BLACKWALL_USE_SELF_SIGNED_NODE=1` gives `blackwall` its own identity in firewall apps like Little Snitch

## v0.1.0 / 2026-10-01

- First release
- `blackwall <command>` runs any command in an [srt](https://github.com/anthropics/sandbox-runtime) sandbox, with every host allowed
- `blackwall claude` runs Claude Code with its own `~/.claude-blackwall` profile
- `gh`, `uv`, `npm`, and `pre-commit` use their own caches in `~/.cache/blackwall`, so a sandboxed run never writes to your host caches
- Writes are limited to the current folder, `--add-dir` folders, `/private/tmp`, and `~/.cache/blackwall`
- Reads are blocked by default, except those folders and what dev tools need
- Tokens come from an optional `~/.blackwall/.env`: `GH_TOKEN` goes to every command, and `CLAUDE_CODE_OAUTH_TOKEN` only goes to `claude`
- Commits made in the sandbox aren't GPG-signed, since `~/.gnupg` is unreadable
- Customize the defaults in `~/.blackwall/config.json`, and check the result with `blackwall --print-config`
