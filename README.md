# blackwall

## Usage

```bash

```

## Default config

[`configs/default-config.json`](configs/default-config.json) is the default layer of `blackwall`'s config, and your `~/.blackwall/config.json` goes on top of it.

It looks like srt's settings today, but it's not `~/.srt-settings.json`: `blackwall` never reads that file, and `srt` never reads this one.

- `network.allowedDomains: ["*"]`: Every host is allowed. srt itself rejects `"*"`, so `blackwall` handles it. Without `"*"`, `allowedDomains` becomes a strict allowlist

## Custom config

Put your changes in `~/.blackwall/config.json`. Top-level lists are added to the defaults. To replace a default value, set it under `overrideDefaults`:

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

To see the shipped defaults, and what you actually get after your config and the launch-time grants:

```bash
blackwall --print-default-config
blackwall --print-config claude
```
