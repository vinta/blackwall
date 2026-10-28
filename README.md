# Blackwall

[![npm Version](https://img.shields.io/npm/v/blackwall-sandbox?style=for-the-badge)](https://www.npmjs.com/package/blackwall-sandbox)

Opinionated lightweight sandbox for daily dev tasks with coding agents. Built on Anthropic's [sandbox-runtime](https://github.com/anthropics/sandbox-runtime) (srt).

> This project is named after the Blackwall in Cyberpunk 2077, a firewall NetWatch built to keep rogue AIs out of the Net.

## Why Blackwall

Blackwall is an out-of-the-box sandbox for long-running agent tasks, mainly `claude` and `codex`. You get nearly the same experience as your daily dev work outside a sandbox, but much safer. At least the blast radius stays under control. Unlike the built-in sandboxes, it runs the whole agent inside srt, hooks and MCP servers included.

<details>
<summary>Comparison: blackwall vs claude/codex built-in sandboxes vs srt</summary>

### Claude Code's Built-in Sandbox

|                   | Blackwall                                                                                                       | Claude Code's built-in sandbox                                                                                                                                                                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Covers            | The whole agent and every process it starts, MCP servers included                                               | Shell commands only. Read, Edit, Write, and WebFetch [run outside it](https://code.claude.com/docs/en/sandboxing#what-runs-outside-the-sandbox) and follow permission rules. Hooks, MCP servers, and `apiKeyHelper` run with your full access                                                                                  |
| Reads             | Denied everywhere, except the folders it writes, system paths, and what presets need                            | [Most of your machine](https://code.claude.com/docs/en/sandboxing#filesystem-isolation) by default, `~/.ssh` and `~/.aws/credentials` included                                                                                                                                                                                 |
| Hosts             | Only what presets and `claude` need, or every public host with `--allow-internet`, whatever the permission mode | Your allowed domains, but in `bypassPermissions` mode a host you never allowed [connects without a prompt](https://code.claude.com/docs/en/sandboxing#hosts-outside-your-allowed-domains), unless you set `strictAllowlist` or `allowManagedDomainsOnly`                                                                       |
| Localhost and LAN | Denied by the `private-network` preset, and `local-network` keeps `localhost` denied under `"*"`                | Loopback denied, but an allowed name that [resolves into your LAN](https://code.claude.com/docs/en/sandboxing#hostnames-that-resolve-to-local-addresses), like `10.0.0.0/8`, connects                                                                                                                                          |
| Way out           | No built-in escape hatch; [known limitations](#known-limitations) still apply                                   | Claude can [retry a blocked command unsandboxed](https://code.claude.com/docs/en/sandboxing#the-unsandboxed-retry-escape-hatch), unless you [set `allowUnsandboxedCommands` to `false`](https://code.claude.com/docs/en/sandboxing#turn-off-the-retry-with-strict-sandbox-mode). `excludedCommands` run unsandboxed either way |

### Codex's Built-in Sandbox

|        | Blackwall                                                                            | Codex's built-in sandbox                                                                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Covers | The whole agent and every process it starts, MCP servers included                    | MCP servers, web search, and connectors [run outside it](https://learn.chatgpt.com/docs/agent-approvals-security#traffic-outside-the-command-network-proxy)                                       |
| Reads  | Denied everywhere, except the folders it writes, system paths, and what presets need | Everything, unless you write a [permission profile](https://learn.chatgpt.com/docs/permissions)                                                                                                   |
| Hosts  | Only what presets and `codex` need, or every public host with `--allow-internet`     | Off by default. Once on, every host is reachable, unless you also enable [`features.network_proxy`](https://learn.chatgpt.com/docs/agent-approvals-security#network-access) and list your domains |
| `.git` | Writable, except `hooks` and `config`                                                | [Read-only](https://learn.chatgpt.com/docs/agent-approvals-security#protected-paths-in-writable-roots), so `git commit` needs an approval                                                         |

### srt Directly

Blackwall is srt underneath, with the setup done for you:

|                         | Blackwall                                                                                                    | srt directly                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Reads                   | Denied everywhere, except the folders it writes, system paths, and what presets need                         | Everything by default, `~/.ssh` included                                                      |
| Hosts                   | Only what presets and `claude` or `codex` need                                                               | None, until you list each one in `~/.srt-settings.json`                                       |
| Every public host       | `--allow-internet` for one run, or `"*"` in `network.allowedHosts`                                           | `"*"` is rejected                                                                             |
| Localhost and LAN       | Denied by the `private-network` preset, and `local-network` keeps `localhost` denied under `"*"`             | Loopback denied, but an allowed name can still resolve into your LAN                          |
| `~/.claude`             | `~/.claude-blackwall`, with your `CLAUDE.md`, rules, and skills copied in on every launch                    | Must be writable for `claude` to run, so the agent can edit your hooks and settings           |
| Agent files in the repo | Also `.claude/settings.json`, `.claude/settings.local.json`, and `.claude/hooks`, in `--add-dir` folders too | `.mcp.json`, `.claude/commands`, and `.claude/agents` denied, beneath the current folder only |
| Tool setup              | Presets for `python`, `node`, `github`, `git`, and `pre-commit`                                              | Yours to write: each tool's hosts, read paths, and cache folders                              |
| Project config          | `.blackwall/config.json`, loaded only after `--trust`                                                        | None, only `--settings` with a path                                                           |
| Inspection              | `--print-config`, `--print-file-access`, `--print-network-access`, and `--print-env`                         | `--debug` logs                                                                                |

srt's [security limitations](https://github.com/anthropics/sandbox-runtime#security-limitations) apply to blackwall too.

</details>

### What You Give Up

- Hosts and paths are fixed at launch. A new host means a config edit or `--allow-internet` and a relaunch, not a prompt mid-session
- No credential masking yet, while Claude Code's built-in sandbox can [mask secrets](https://code.claude.com/docs/en/sandboxing#mask-credentials)

## Installation

Needs Node.js 22.21 or later.

```bash
npm install -g blackwall-sandbox
```

Keep blackwall and srt outside every writable folder, including the current folder and any `--add-dir` folder. If a sandboxed command can rewrite either package, the next launch runs that code outside the sandbox.

<details>
<summary>Shell completion</summary>

To enable zsh completion with oh-my-zsh:

```bash
mkdir -p $ZSH_CUSTOM/completions
blackwall --completion zsh > $ZSH_CUSTOM/completions/_blackwall  # run it again after upgrading blackwall
```

Without oh-my-zsh, save it to `~/.zfunc/_blackwall` instead, and add `fpath=(~/.zfunc $fpath)` to `~/.zshrc`, before `compinit`.

</details>

## Usage

```bash
blackwall claude                              # run Claude Code in the sandbox
blackwall --add-dir ../another-repo claude    # also let it write to another folder
blackwall --allow-internet claude             # also let it reach every public host, but not localhost or your LAN
blackwall npm test                            # any command works, not only claude
blackwall --print-config claude               # show the merged config, after your config and the launch-time grants
blackwall --print-file-access claude          # show what it can read and write, as srt sees it
blackwall --print-network-access claude       # show which hosts it can reach, as srt sees it
blackwall --print-env claude                  # show the env vars blackwall adds, and why
blackwall --trust                             # trust .blackwall/config.json in the current folder
blackwall --version                           # show the blackwall version
blackwall --completion zsh                    # print the zsh completion script
blackwall --help                              # show the usage
```

By default, a sandboxed command:

- Writes only to the current folder, `--add-dir` folders, `/tmp/claude`, and `~/.cache-blackwall`
- Never writes `.git/config` or `.git/hooks`, in the current or `--add-dir` folders. `git remote add`, `git config`, and `git branch -m` fail; `git push -u`, `git branch -D`, and `git switch -c` lose their tracking update. Set remotes and upstreams on the host, or push with `git push origin HEAD`
- Never writes `.claude/settings.json`, `.claude/settings.local.json`, `.claude/hooks`, `.mcp.json`, `.claude/commands`, or `.claude/agents` in the current or `--add-dir` folders, since an unsandboxed `claude` there runs what they hold: the hooks, env, and apiKeyHelper in settings even before you trust the folder, and the MCP servers, commands, and subagents in the rest. srt denies the last three in the current folder only, so the preset adds them for `--add-dir` folders. The names come from the [`agent-files`](#presets) preset. A sandboxed `claude` can't save project permission rules either
- Reads only those folders, plus the `allowRead` paths in the [default config](#default-config) and [presets](#presets)
- Connects only to the hosts in [presets](#presets), and the ones [Claude Code](#claude-code) or [Codex](#codex) needs

### Claude Code

`blackwall claude` uses `~/.claude-blackwall` as its config folder instead of `~/.claude`. For security, a sandboxed run never writes to `~/.claude`, and reads only `~/.claude/plugins`.

- Every launch copies your `CLAUDE.md`, `rules`, `skills`, `agents`, `commands`, and `output-styles` from `~/.claude`, replacing what was there, so edits to those copies don't last
- Your plugins load from `~/.claude/plugins` read-only, without auto-update. Every launch refreshes the profile's plugin record, `plugins/installed_plugins.json`, from the host's, so sandboxed sessions follow the plugin versions installed outside
- Sessions, settings, and login stay separate
- `settings.json` starts with only your `enabledPlugins`, since your other settings, like hooks and permissions, assume no sandbox. After that it's yours to edit

Log in with `/login`, or put `CLAUDE_CODE_OAUTH_TOKEN` in `~/.blackwall/.env`.

### Codex

`blackwall codex` uses `~/.codex-blackwall` as its config folder instead of `~/.codex`. A sandboxed run never writes to `~/.codex`, and reads only `~/.codex/packages`, where the standalone installer puts the `codex` binary.

- Every launch copies your `AGENTS.md` and `agents` from `~/.codex`, plus `skills` from `~/.agents`. These copies replace what was there, so edits to them don't last
- Sessions, `config.toml`, `rules`, and login stay separate. Put sandbox-specific rules in `~/.codex-blackwall/rules/`
- Codex's own sandbox is off (`-c sandbox_mode="danger-full-access"`), since it can't start inside blackwall's. blackwall is the sandbox

Log in with `blackwall codex login --device-auth`.

## Agent Skill

[`skills/blackwall`](skills/blackwall/SKILL.md) teaches Claude Code and Codex to run, configure, and debug blackwall. Inside the sandbox, the agent can't run `blackwall` or edit its config, so the skill tells it how to read a denial and what to hand you.

`blackwall claude` and `blackwall codex` copy it into their config folders on every launch, replacing any older copy, so it always matches your blackwall. For agents you run outside the sandbox:

```bash
npx skills add vinta/blackwall -g
```

## Configuration

### Environment Variables

Put your env vars in `~/.blackwall/.env` if you need them.

```bash
GH_TOKEN=xxx                  # generate a read-only PAT from https://github.com/settings/personal-access-tokens
CLAUDE_CODE_OAUTH_TOKEN=xxx   # run `claude setup-token` to get one
```

Sandboxed commands get `BLACKWALL_SANDBOX=1`, so a script can tell it runs inside blackwall.

### Default

[`src/config/default-config.json`](src/config/default-config.json) is the default settings. Only keys in `default-config.json` can be set in your `~/.blackwall/config.json` or `.blackwall/config.json`.

- `presets: ["agent-files", "python", "node", "github", "git", "pre-commit", "local-network", "private-network"]`: The [presets](#presets) on by default
- `network.allowedHosts: []`: No hosts beyond presets. An entry is a name, like `example.com` or `*.example.com`, or an IP literal, and can take a port, e.g. `127.0.0.1:8000`. Add `"*"` to allow every public host and public IP literal; srt itself rejects `"*"`, so `blackwall` handles it. srt also refuses, for every name, loopback, unspecified, link-local, multicast, broadcast, cloud metadata, and your machine's own addresses. blackwall applies the same to IP literals under `"*"`. These aren't in `--print-config`
- `network.deniedHosts: []`: Hosts to refuse. A name is refused under `"*"`; without `"*"`, an unlisted host is refused anyway. An IP literal or a range, like `10.0.0.0/8`, is refused as a literal, and also when an allowed name resolves into it. An `allowedHosts` entry wins over a `deniedHosts` name, so `localhost:8000` in `allowedHosts` is reachable though the `local-network` preset denies `localhost`. A range is overridden only by that IP itself in `allowedHosts`. Both lists from presets, your user config, and the project config are added together
- `filesystem.denyRead: ["/"]`: Blocks every read, then `allowRead` opens what dev tools need
- `filesystem.allowRead` opens only `~/.local/bin` under `~/.local`, and presets add their tools' folders. Version managers like mise keep tools elsewhere in it, so add their folders to your [user config](#user-config)
- `srt.enableWeakerNetworkIsolation: true`: On macOS, lets Go tools like `gh` verify TLS certificates through `com.apple.trustd.agent`, which also opens a data exfiltration path through that service. On by default because the `github` preset is
- `srt.enableWeakerNestedSandbox: false`: On Linux, lets the sandbox run inside Docker without privileged namespaces, which considerably weakens isolation
- `srt.allowPty: true`: Lets sandboxed commands open pseudo-terminals, which TUIs need

`srt` holds [srt settings](https://github.com/anthropics/sandbox-runtime), passed to srt untouched, each replacing its default. The `filesystem` keys are srt settings too, but blackwall merges those lists, and translates `network.allowedHosts` and `network.deniedHosts` into srt's own lists. An srt setting not in `default-config.json`'s `srt` is a config error, `unknown key`. However, blackwall doesn't read `~/.srt-settings.json`, only the `srt` CLI does.

### Presets

A preset is what one tool needs to work in the sandbox: hosts, read paths, env vars like its cache folder, shell lines, macOS services, and a `why`, which `blackwall --print-env` prints above the preset's env vars and shell lines. Each is a module in [`src/presets`](src/presets):

- **Always on**
  - [mac](src/presets/mac.js): System paths macOS tools need. On macOS
  - [linux](src/presets/linux.js): System paths Linux tools need, and `/tmp`. On Linux
  - [tmpdir](src/presets/tmpdir.js): `/tmp/claude` as the temp folder
- **On by default**
  - [private-network](src/presets/private-network.js): Denies LAN hosts: RFC 1918, CGNAT, and IPv6 ULA ranges. To reach one, add its IP literal with the port to `network.allowedHosts`, e.g. `192.168.1.10:8080`
  - [local-network](src/presets/local-network.js): Denies `localhost` and `*.localhost`. To reach a local server, add it with the port to `network.allowedHosts`, e.g. `localhost:8000`
  - [git](src/presets/git.js): Your git config and global ignore files. Commit signing off, since gpg can't reach `~/.gnupg`. Keeps srt's proxy login out of your credential helpers. Denies writes to `.git/hooks` and `.git/config` in `--add-dir` folders. Drop it only if you won't run git: with a `~/.gitconfig` it can't read, git refuses to start
  - [github](src/presets/github.js): GitHub, for `git`, `gh`, and raw files, and gh's own config folder
  - [python](src/presets/python.js): PyPI, for `pip` and `uv`, and uv's config, Python installs, and tools
  - [node](src/presets/node.js): The npm registry, and Node.js installed by fnm
  - [pre-commit](src/presets/pre-commit.js): Its cache folder, and hook repos clone through srt's proxy
  - [agent-files](src/presets/agent-files.js): Denies writes to `.claude/settings.json`, `.claude/settings.local.json`, `.claude/hooks`, `.mcp.json`, `.claude/commands`, and `.claude/agents` in the current and `--add-dir` folders: an unsandboxed `claude` runs what they hold, even before you trust the folder. Drop it and a sandboxed command can plant commands that run on the host
- **Off by default**
  - [clipboard](src/presets/clipboard.js): On macOS, lets `claude` read an image you copied, e.g. a Cmd+Ctrl+Shift+4 screenshot, when you paste it. Every sandboxed command can then read what you copy, passwords included, and replace what you paste next
  - [screenshots](src/presets/screenshots.js): Reads your screenshot folder, so a screenshot you copy in Finder and paste as its path reaches `claude`. That's `~/Desktop`, unless you moved it with `defaults write com.apple.screencapture location ~/Screenshots`, which also keeps the rest of your Desktop unreadable

`tmpdir`, `mac`, and `linux` aren't in the `presets` list, so overriding it can't drop them.

Preset paths follow `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_STATE_HOME`, and `XDG_CACHE_HOME` when you set them.

### User Config

<details>
<summary>~/.blackwall/config.json: add to the defaults, or replace them with overrideDefaults</summary>

Put your customizations in `~/.blackwall/config.json`. Top-level lists are added to the defaults. `srt` keys and `overrideDefaults` replace their defaults:

```json
{
  "filesystem": { "allowRead": ["~/.npmrc"] },
  "srt": { "allowPty": false },
  "overrideDefaults": {
    "presets": ["github", "git"]
  }
}
```

- Top-level `presets`, `filesystem`, and `network` keys take lists only, and they're **added** to the defaults. A relative `filesystem.denyRead` or `filesystem.denyWrite` entry applies to the current folder and every `--add-dir` folder
- To allow every public host and public IP literal, add `"*"` to `network.allowedHosts`, or launch with `--allow-internet` for one run. Loopback, private ranges, and `localhost` stay denied, so add a local server as its IP literal or name with the port, e.g. `127.0.0.1:8000` or `localhost:8000`
- `overrideDefaults` takes `presets`, `network`, and `filesystem`, and **replaces** their default values. It's applied first, then the top-level lists are added
- If you set `overrideDefaults.presets`, add `local-network`, or `localhost` by name opens again under `"*"`. Add `private-network` too, or private ranges stay open. Add `agent-files` too, or sandboxed commands can write the settings and hooks an unsandboxed `claude` runs, and `.mcp.json`, `.claude/commands`, and `.claude/agents` in `--add-dir` folders

</details>

### Project Config

<details>
<summary>.blackwall/config.json and .blackwall/.env, loaded only after --trust</summary>

Put a project's own config in `.blackwall/config.json`. It takes the same keys as `~/.blackwall/config.json`, e.g. to read a file from another repo:

```json
{
  "filesystem": { "allowRead": ["/path/to/file"] }
}
```

- Its lists are added to yours, and its `srt` keys and `overrideDefaults` win over yours
- Only the current folder's config loads, not its parent folders'

Put a project's own env vars in `.blackwall/.env`:

- Its keys override `~/.blackwall/.env`, and go only to the sandboxed command, so `BLACKWALL_*` keys there don't configure `blackwall`
- It loads only when `.blackwall/config.json` exists and is trusted. `{}` is enough

A cloned repo can ship a `.blackwall/config.json` that widens the sandbox, so `blackwall` refuses to run until you review it and run `blackwall --trust`. Like direnv, trust covers that path with that exact content, so run it again after every edit to `config.json`. Edits to `.env` don't need a new `--trust`. Sandboxed commands can't write to `.blackwall` in the current folder.

</details>

### Signed Node

<details>
<summary>Give blackwall its own identity in Little Snitch</summary>

For firewall apps like Little Snitch. Every sandboxed command connects through a proxy inside `blackwall`, so the firewall sees all that traffic as `node`, the same `node` behind every other Node script. One rule covers them all.

To give `blackwall` its own identity on macOS:

```bash
BLACKWALL_USE_SELF_SIGNED_NODE=1 # put this in ~/.blackwall/.env, or export it
```

Little Snitch then shows `node-blackwall` instead of `node`. It's an ad-hoc-signed copy of your `node` at `~/.blackwall/node-blackwall`, created on the first run and again whenever it's missing. Delete it after upgrading Node to get a fresh copy.

</details>

## Threat Model

The question blackwall answers: you run `blackwall --allow-internet claude` in a repo you own or cloned, with the default config. If the agent goes rogue, is your host machine safe?

The attacker is the command inside the sandbox: a coding agent steered by a prompt injection in the repo, a malicious dependency, a tool it runs. It can run anything, for as long as the session lasts, and it can try again the next time you launch blackwall.

What blackwall defends:

- It reads and writes only what you granted, listed in [Usage](#usage)
- With internet access, it can only leak what it was allowed to read

Out of scope:

- You, running a hostile command on purpose. If you start `blackwall` with an evil command, that's on you
- What you grant: `allowRead`, `allowWrite`, `--add-dir`, and a trusted `.blackwall/config.json` with its `.env` count as your own setup. Review both before `--trust`
- What `--trust` leaves to you: it pins only `config.json`'s content. `~/.blackwall/.env` always loads, and a project's `.env` loads whenever its `config.json` is trusted, later edits included, with no new `--trust`. Review `.env` again after a pull that touches it
- Secrets in your shell environment, `~/.blackwall/.env`, and the sandbox's agent profile. They reach the command by design
- Files copied from your host agent profiles, including their symlink targets. The command can read the copies. Keep those sources outside sandbox-writable folders: later launches also follow links planted there
- Files it writes inside granted folders survive. Later sandboxed runs may read or execute them, and so does your shell when that folder is on its PATH, like an activated `.venv/bin`: a planted `node` there runs your next `blackwall` unsandboxed. Keep such folders off the PATH you launch from

A finding counts when the sandboxed command alone gets past this, with no help from you beyond launching blackwall again. Reading host files outranks writing them, and writing outranks breaking a session.

### Known Limitations

<details>
<summary>Nested agent files on Linux, HTTP proxy, and profile folder symlinks can still get past the sandbox</summary>

- On Linux, nested `agent-files` denies cover matching paths found at launch, up to 3 folders below the current or `--add-dir` folder. A run can still plant `.claude/settings.json` or `.claude/hooks` under deeper or newly created folders, for an unsandboxed `claude` to run later. Before running `claude` outside the sandbox from a subfolder an agent worked in, check its `.claude/` first. On macOS, these denies cover every depth, including folders created during the run
- With `HTTP_PROXY` or `HTTPS_PROXY` set, in your shell or `~/.blackwall/.env`, srt sends names through that proxy and lets it resolve them, so it can't check what they resolve to. The `private-network` preset, `deniedHosts` ranges, and srt's built-in refused classes then don't apply to names. IP literals under `"*"` are still judged. Unset the proxy when you need those denies
- On macOS, a sandboxed command can replace its own profile folder, like `~/.claude-blackwall`, or `~/.cache-blackwall` with a symlink. Blackwall refuses to launch when it finds one and never grants reads through it, but a session still running can swap the folder right after a second launch, say for another repo, has checked it, and that launch then deletes the files it copies in, like `~/.claude/CLAUDE.md`, where the link points. It can't regain reads of the host folder that way. Don't start a second blackwall launch while a session you don't trust is running. Closing this needs srt to forbid unlinking a granted folder itself

</details>

Also see: [TODO.md](TODO.md) for the known gaps not closed yet, and what's planned

## License

Released under the [MIT License](LICENSE).

## Author

- GitHub: [@vinta](https://github.com/vinta)
- Twitter: [@vinta](https://twitter.com/vinta)
- Website: [vinta.ws](https://vinta.ws/code/)
