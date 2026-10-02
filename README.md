# blackwall

Opinionated lightweight sandbox for daily dev tasks, with **full network access**.

## Usage

```bash
npm install -g blackwall-sandbox

blackwall claude
blackwall --add-dir ../another-repo claude # also let it write to another folder
blackwall npm test # any command works, not only claude
```

A sandboxed command can only write to the current folder, `--add-dir` folders, `/private/tmp`, and `~/.cache/blackwall`. Reads are blocked by default, except those folders and the `allowRead` paths in the [default config](#default-config). Every host is allowed by default.

`claude` uses `~/.claude-blackwall` as its config folder instead of `~/.claude`. On every launch, `blackwall` copies your `CLAUDE.md`, `rules`, `skills`, `agents`, `commands`, and `output-styles` from `~/.claude` into it, replacing what was there, so edits to those copies don't last. Your plugins load from `~/.claude/plugins` read-only, without auto-update. Sessions, settings, and login stay separate: enable plugins with `enabledPlugins` in `~/.claude-blackwall/settings.json`, and log in with `CLAUDE_CODE_OAUTH_TOKEN` below or `/login`.

Put your env vars in `~/.blackwall/.env` if you need them. Every key goes to every command, and `BLACKWALL_*` keys also configure `blackwall` itself:

```bash
GH_TOKEN=xxx # generate a readonly PAT from https://github.com/settings/personal-access-tokens
CLAUDE_CODE_OAUTH_TOKEN=xxx # run `claude setup-token` to get one
```

## Signed Node

For firewall apps like Little Snitch. Every sandboxed command connects through a proxy inside `blackwall`, so the firewall sees all that traffic as `node`. It's the same `node` behind every other Node script, so you can't tell them apart, and one rule covers them all.

To give `blackwall` its own identity on macOS, so you can control its connections separately:

```bash
export BLACKWALL_USE_SELF_SIGNED_NODE=1 # or put BLACKWALL_USE_SELF_SIGNED_NODE=1 in ~/.blackwall/.env
```

Little Snitch then shows `blackwall_node` instead of `node`. `blackwall` runs itself with `~/.blackwall/blackwall_node`, an ad-hoc-signed copy of your `node`. It's created on the first run, and again whenever it's missing. Delete it after upgrading Node to get a fresh copy. Needs Node 22.15+.

## Configurations

### Default Config

[`configs/default-config.json`](configs/default-config.json) is the default layer of `blackwall`'s config, and your `~/.blackwall/config.json` goes on top of it.

Every key is an [srt setting](https://github.com/anthropics/sandbox-runtime), passed to srt after `blackwall` adds the launch-time grants. srt settings missing from this file can't be set.

- `network.allowedDomains: ["*"]`: Every host is allowed. srt itself rejects `"*"`, so `blackwall` handles it. Without `"*"`, `allowedDomains` becomes a strict allowlist

To see the shipped default config:

```bash
blackwall --print-default-config
```

### Custom Config

Put your customizations in `~/.blackwall/config.json`. Top-level lists are added to the defaults. To replace a default value, set it under `overrideDefaults`:

```json
{
  "filesystem": { "allowRead": ["~/.npmrc"] },
  "overrideDefaults": {
    "network": { "allowedDomains": ["api.anthropic.com", "pypi.org"] },
    "allowPty": false
  }
}
```

- Top-level `filesystem` and `network` keys take lists only, and they're added to the defaults
- `overrideDefaults` takes any key in `default-config.json` and replaces its default value. It's applied first, then the top-level lists are added
- An overridden list stops getting new defaults when `blackwall` updates, so override only what you want to own
- To allow only a few hosts, override `allowedDomains` without `"*"`. Claude needs `api.anthropic.com` at least

To see what you actually get after your config and the launch-time grants:

```bash
blackwall --print-config claude
```

To see which files and folders the sandbox can read and write, including the paths the sandbox runtime adds on its own:

```bash
blackwall --print-path-access claude
```
