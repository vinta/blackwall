# CLAUDE.md

## Presets

- A rule that applies through the config, a host, a path, or an env var, goes in a preset in `src/presets/`, never hardcoded in `buildConfig`, so the user can drop it with `overrideDefaults.presets` and see it in `--print-config`.
- The only exceptions are what the user must not turn off: what the sandbox itself needs to run, and what keeps a run from forging trust or replacing blackwall.
