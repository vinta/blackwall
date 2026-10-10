# Blackwall

[![npm Version](https://img.shields.io/npm/v/blackwall-sandbox?style=for-the-badge)](https://www.npmjs.com/package/blackwall-sandbox)

Opinionated lightweight sandbox for daily dev tasks with coding agents. Built on Anthropic's [sandbox-runtime](https://github.com/anthropics/sandbox-runtime) (srt): Seatbelt on macOS, bubblewrap on Linux.

> This project is named after the Blackwall in Cyberpunk 2077, a firewall NetWatch built to keep rogue AIs out of the Net.

## Installation

```bash
npm install -g blackwall-sandbox
```

## Usage

```bash
blackwall claude                              # run Claude Code in the sandbox
blackwall --add-dir ../another-repo claude    # also let it write to another folder
blackwall npm test                            # any command works, not only claude
blackwall --print-config claude               # show the merged config, after your config and the launch-time grants
blackwall --print-file-access claude          # show what it can read and write, as srt sees it
blackwall --print-env claude                  # show the env vars blackwall adds, and why
blackwall --trust                             # trust .blackwall/config.json in the current folder
blackwall --version                           # show the blackwall version
```

By default, a sandboxed command:

- Writes only to the current folder, `--add-dir` folders, `/private/tmp`, and `~/.cache/blackwall`
- Reads only those folders, plus the `allowRead` paths in the [default config](#default-config) and [presets](#presets)
- Connects only to the hosts in [presets](#presets), and the ones [Claude Code](#claude-code) or [Codex](#codex) needs

### Claude Code

`blackwall claude` uses `~/.claude-blackwall` as its config folder instead of `~/.claude`. For security, a sandboxed run never writes to `~/.claude`, and reads only `~/.claude/plugins`.

- Every launch copies your `CLAUDE.md`, `rules`, `skills`, `agents`, `commands`, and `output-styles` from `~/.claude`, replacing what was there, so edits to those copies don't last
- Your plugins load from `~/.claude/plugins` read-only, without auto-update
- Sessions, settings, and login stay separate
- `settings.json` starts with only your `enabledPlugins`, since your other settings, like hooks and permissions, assume no sandbox. After that it's yours to edit

Log in with `/login`, or put `CLAUDE_CODE_OAUTH_TOKEN` in `~/.blackwall/.env`.

### Codex

`blackwall codex` uses `~/.codex-blackwall` as its config folder instead of `~/.codex`. A sandboxed run never writes to `~/.codex`, and reads only `~/.codex/packages`, where the standalone installer puts the `codex` binary.

- Every launch copies your `AGENTS.md`, `agents`, and `rules` from `~/.codex`, plus `skills` from `~/.agents`. These copies replace what was there, so edits to them don't last
- Sessions, `config.toml`, and login stay separate
- Codex's own sandbox is off (`-c sandbox_mode="danger-full-access"`), since it can't start inside blackwall's. blackwall is the sandbox

Log in with `blackwall codex login --device-auth`.

### Environment Variables

Put your env vars in `~/.blackwall/.env` if you need them.

```bash
GH_TOKEN=xxx                  # generate a read-only PAT from https://github.com/settings/personal-access-tokens
CLAUDE_CODE_OAUTH_TOKEN=xxx   # run `claude setup-token` to get one
```

## Configuration

### Default

[`src/configs/default-config.json`](src/configs/default-config.json) is the default layer, and your `~/.blackwall/config.json` goes on top of it. Every key except `presets` is an [srt setting](https://github.com/anthropics/sandbox-runtime), passed to srt after `blackwall` adds the launch-time grants. srt settings missing from this file can't be set.

- `presets: ["python", "npm", "github"]`: The [presets](#presets) on by default
- `network.allowedDomains: []`: No hosts beyond presets. Add `"*"` to allow every host; srt itself rejects `"*"`, so `blackwall` handles it
- `filesystem.denyRead: ["/"]`: Blocks every read, then `allowRead` opens what dev tools need

### Presets

A preset adds hosts or read paths for one tool, with the same lists as a user config:

- [python](src/configs/presets/python.json): PyPI, for `pip` and `uv`
- [npm](src/configs/presets/npm.json): The npm registry
- [github](src/configs/presets/github.json): GitHub, for `git`, `gh`, and raw files
- [mac](src/configs/presets/mac.json): System paths macOS tools need, added on macOS
- [linux](src/configs/presets/linux.json): `/usr/local` and the 64-bit lib folders, added on Linux

`mac` and `linux` aren't in the `presets` list, so overriding it can't drop them.

<details>
<summary>

### User Config

</summary>

Put your customizations in `~/.blackwall/config.json`. Top-level lists are added to the defaults. To replace a default value, set it under `overrideDefaults`:

```json
{
  "filesystem": { "allowRead": ["~/.npmrc"] },
  "overrideDefaults": {
    "presets": ["github"],
    "allowPty": false
  }
}
```

- Top-level `presets`, `filesystem`, and `network` keys take lists only, and they're **added** to the defaults
- To allow every host, add `"*"` to `network.allowedDomains`
- `overrideDefaults` takes any key in `default-config.json` and **replaces** its default value. It's applied first, then the top-level lists are added

</details>

<details>
<summary>

### Project Config

</summary>

Put a project's own config in `.blackwall/config.json` in that folder. It takes the same keys as `~/.blackwall/config.json`, e.g. to read a skill folder from another repo:

```json
{
  "filesystem": { "allowRead": ["/path/to/file"] }
}
```

- Its lists are added to yours, and its `overrideDefaults` wins over yours
- Only the current folder's config loads, not its parent folders'

A cloned repo can ship one that widens the sandbox, so `blackwall` refuses to run until you review the file and run `blackwall --trust`. Like direnv, trust covers that path with that exact content, so run it again after every edit. Sandboxed commands can't write to `.blackwall` in the current folder.

Put a project's own env vars in `.blackwall/.env`, e.g. a `GH_TOKEN` that can merge PRs in that repo only:

- Its keys override `~/.blackwall/.env`, and go only to the sandboxed command, so `BLACKWALL_*` keys there don't configure `blackwall`
- It loads only with a trusted `.blackwall/config.json` (`{}` is enough). Like direnv's `dotenv`, trust doesn't cover the `.env` itself, so edits to it need no new `--trust`

</details>

<details>
<summary>

### Signed Node

</summary>

For firewall apps like Little Snitch. Every sandboxed command connects through a proxy inside `blackwall`, so the firewall sees all that traffic as `node`, the same `node` behind every other Node script. One rule covers them all.

To give `blackwall` its own identity on macOS:

```bash
BLACKWALL_USE_SELF_SIGNED_NODE=1 # put this in ~/.blackwall/.env, or export it
```

Little Snitch then shows `blackwall_node` instead of `node`. It's an ad-hoc-signed copy of your `node` at `~/.blackwall/blackwall_node`, created on the first run and again whenever it's missing. Delete it after upgrading Node to get a fresh copy. Needs Node 22.15+.

</details>

## License

Released under the [MIT License](LICENSE).

## Author

- GitHub: [@vinta](https://github.com/vinta)
- Twitter: [@vinta](https://twitter.com/vinta)
- Website: [vinta.ws](https://vinta.ws/code/)
