#!/usr/bin/env bash
# Runs real commands through blackwall against a stub HOME and checks each allow/deny on the real filesystem
# Run it from a plain shell: Seatbelt can't nest, so it fails inside a sandboxed session
set -uo pipefail

repo=$(cd "$(dirname "$0")/.." && pwd)
root=${E2E_ROOT:-$repo/tests/.e2e}
# /tmp is writable inside the sandbox, so a stub HOME there would pass the deny checks for the wrong reason
case $(mkdir -p "$root" && cd "$root" && pwd -P) in
  /tmp* | /private/tmp* | /var/folders* | /private/var/folders*) echo "e2e: E2E_ROOT must be outside /tmp and /var/folders" >&2; exit 2 ;;
esac
rm -rf "$root/home" "$root/proj" "$root/added" "$root/elsewhere" "$root/open"
home=$root/home proj=$root/proj added=$root/added elsewhere=$root/elsewhere open=$root/open
mkdir -p "$home/.blackwall" "$home/.claude/skills" "$home/.codex" "$home/.agents/skills" "$proj" "$added" "$elsewhere/linked-skill" "$open/.blackwall"
git -C "$proj" init -q
git -C "$added" init -q

# setup-node and the claude and codex installers put them outside every default grant. Seatbelt checks a link and its target separately, so grant both the PATH entry's folder and the install folder
grants() { local path; path=$(command -v "$1"); printf '"%s","%s"' "$(dirname "$path")" "$(dirname "$(dirname "$(realpath "$path")")")"; }
# The codex adapter's ~/.codex/packages, where Codex's standalone installer links through a `current` folder, points into the stub HOME here
printf '{"filesystem":{"allowRead":[%s,%s,%s,"%s"]},"network":{"allowedHosts":["*.sslip.io"],"deniedHosts":["192.0.2.0/24"]},"srt":{"allowPty":false}}\n' "$(grants node)" "$(grants claude)" "$(grants codex)" "$HOME/.codex/packages" >"$home/.blackwall/config.json"
echo secret >"$home/secret.txt"
echo "# host instructions" >"$home/.claude/CLAUDE.md"
echo "# host instructions" >"$home/.codex/AGENTS.md"
printf -- '---\nname: linked-skill\ndescription: test\n---\nhi\n' >"$elsewhere/linked-skill/SKILL.md"
ln -s "$elsewhere/linked-skill" "$home/.claude/skills/linked-skill"
ln -s "$elsewhere/linked-skill" "$home/.agents/skills/linked-skill"
ln -s "$elsewhere/missing" "$home/.claude/skills/dangling"
# A stale host copy, as `npx skills add` leaves one, which the bundled skill must replace
mkdir -p "$home/.claude/skills/blackwall" "$home/.agents/skills/blackwall"
echo stale | tee "$home/.claude/skills/blackwall/SKILL.md" "$home/.agents/skills/blackwall/stale.md" >/dev/null
echo '{"enabledPlugins":{"x@y":true},"hooks":{"PreToolUse":[]}}' >"$home/.claude/settings.json"
mkdir -p "$home/.config/git" && printf '[user]\n\temail = e2e@example.com\n' >"$home/.config/git/config"

# Ubuntu runners set XDG_CONFIG_HOME to the real home, so git would read its config from outside the stub
blackwall() { (cd "$proj" && HOME=$home XDG_CONFIG_HOME=$home/.config node "$repo/src/blackwall.mjs" "$@"); }
pass=0 fail=0
check() {
  local name=$1 out; shift
  if out=$("$@" 2>&1); then
    echo "PASS  $name"; pass=$((pass + 1))
  else
    echo "FAIL  $name"; fail=$((fail + 1))
    tail -n 5 <<<"$out" | sed 's/^/      | /'
  fi
}

# Every deny check passes when the sandbox can't start at all, so stop here if it can't
if ! blackwall true; then echo "FAIL  sandbox starts"; exit 1; fi
echo "PASS  sandbox starts"

check "write in cwd" eval 'blackwall sh -c "echo x > f" && test -f "$proj/f"'
check "write in --add-dir" eval 'blackwall --add-dir "$added" sh -c "echo x > \"$added/f\"" && test -f "$added/f"'
check "write to ~ never reaches it" eval 'blackwall sh -c "echo x > \"\$HOME/outside\""; ! test -e "$home/outside"'
check "read ~ denied" eval '! blackwall cat "$home/secret.txt" | grep -q secret'
# The skill's Linux row: a denied dir is an empty writable tmpfs, so reads say ENOENT and writes land there and vanish with the run
if [ "$(uname)" = Linux ]; then
  check "denied read reads as missing" eval 'grep -q "No such file" <<<"$(blackwall cat "$home/secret.txt" 2>&1)"'
  check "denied write succeeds inside and vanishes" eval 'blackwall sh -c "echo x > \"\$HOME/outside\" && test -f \"\$HOME/outside\"" && ! test -e "$home/outside"'
fi

check "write cwd .git/hooks denied" eval 'blackwall sh -c "echo x > .git/hooks/pre-commit"; ! test -e "$proj/.git/hooks/pre-commit"'
check "write cwd .git/config denied" eval 'blackwall sh -c "echo x >> .git/config"; ! grep -q "^x" "$proj/.git/config"'
mkdir -p "$proj/.claude"
check "write cwd .claude/settings.local.json denied" eval 'blackwall sh -c "echo x > .claude/settings.local.json"; ! test -e "$proj/.claude/settings.local.json"'
check "write cwd .claude/hooks denied" eval 'blackwall sh -c "mkdir -p .claude/hooks"; ! test -e "$proj/.claude/hooks"'
check "write cwd .claude/other allowed" eval 'blackwall sh -c "echo x > .claude/other" && test -f "$proj/.claude/other"'
check "write --add-dir .git/hooks denied" eval 'blackwall --add-dir "$added" sh -c "echo x > \"$added/.git/hooks/pre-commit\""; ! test -e "$added/.git/hooks/pre-commit"'
check "write --add-dir .git/config denied" eval 'blackwall --add-dir "$added" sh -c "echo x >> \"$added/.git/config\""; ! grep -q "^x" "$added/.git/config"'
mkdir -p "$added/.claude"
check "write --add-dir .claude/settings.json denied" eval 'blackwall --add-dir "$added" sh -c "echo x > \"$added/.claude/settings.json\""; ! test -e "$added/.claude/settings.json"'
check "write --add-dir .mcp.json denied" eval 'blackwall --add-dir "$added" sh -c "echo x > \"$added/.mcp.json\""; ! test -e "$added/.mcp.json"'
check "write --add-dir .claude/commands denied" eval 'blackwall --add-dir "$added" sh -c "mkdir -p \"$added/.claude/commands\" && echo x > \"$added/.claude/commands/x.md\""; ! test -e "$added/.claude/commands/x.md"'
check "write --add-dir .claude/agents denied" eval 'blackwall --add-dir "$added" sh -c "mkdir -p \"$added/.claude/agents\" && echo x > \"$added/.claude/agents/x.md\""; ! test -e "$added/.claude/agents/x.md"'
check "create --add-dir .blackwall denied" eval 'blackwall --add-dir "$added" mkdir "$added/.blackwall"; ! test -e "$added/.blackwall"'

check "git reads ~/.config/git/config" eval 'test "$(blackwall git config --get user.email)" = e2e@example.com'
mkdir -p "$elsewhere/xdg/git" && printf '[user]\n\temail = xdg@example.com\n' >"$elsewhere/xdg/git/config"
check "git reads \$XDG_CONFIG_HOME/git/config" eval 'test "$(cd "$proj" && HOME=$home XDG_CONFIG_HOME=$elsewhere/xdg node "$repo/src/blackwall.mjs" git config --get user.email)" = xdg@example.com'
git -C "$proj" -c user.name=e2e -c user.email=e2e@example.com commit -q --allow-empty -m init && git -C "$proj" branch gone
check "git branch -d deletes despite config error" eval 'out=$(blackwall git branch -d gone 2>&1) && grep -q "could not write config file" <<<"$out" && ! git -C "$proj" rev-parse -q --verify refs/heads/gone'

check "write ~/.blackwall under --add-dir ~ denied" eval 'blackwall --add-dir "$home" sh -c "echo x > \"\$HOME/.blackwall/probe\""; ! test -e "$home/.blackwall/probe"'
check "write ~/.claude denied" eval 'blackwall sh -c "echo x >> \"\$HOME/.claude/CLAUDE.md\""; test "$(cat "$home/.claude/CLAUDE.md")" = "# host instructions"'

check "preset host allowed" blackwall curl -sS -o /dev/null --max-time 20 https://api.github.com
check "other host blocked" eval 'grep -q "response 403" <<<"$(blackwall curl -sS -o /dev/null --max-time 20 https://example.com 2>&1)"'
check "host resolving into RFC 1918 blocked" eval 'grep -q "response 403" <<<"$(blackwall curl -sS -o /dev/null --max-time 20 https://10.0.0.1.sslip.io 2>&1)"'
check "user config adds deniedHosts" eval 'blackwall --print-config true | grep -q "\"192.0.2.0/24\""'
check "local-network preset denies localhost" eval 'blackwall --print-config true | grep -q "\"localhost\""'
check "agent-files preset in --print-config" eval 'blackwall --print-config true | grep -q "/.claude/hooks\""'
check "user config srt replaces per key" eval 'out=$(blackwall --print-config true) && grep -q "\"allowPty\": false" <<<"$out" && grep -q "\"enableWeakerNetworkIsolation\": true" <<<"$out"'

# fnm's PATH entry is a link under the real ~/.local/state, which the stub HOME doesn't grant
node=$(realpath "$(command -v node)")
check "nested blackwall refused" eval 'out=$(blackwall --add-dir "$repo" "$node" "$repo/src/blackwall.mjs" --version 2>&1); test $? -eq 2 && grep -q "can.t run inside a sandbox" <<<"$out"'
check "node fetch reaches preset host" blackwall "$node" -e 'fetch("https://api.github.com")'
check "node fetch to other host blocked" eval 'blackwall "$node" -e "fetch(\"https://example.com\").catch((e) => console.log(e.cause.message))" | grep -q "Request was cancelled"'

# "*" gets its own folder, so $proj keeps its closed network. srt's NO_PROXY sends loopback around the proxy, so curl clears it
blackwall_open() { (cd "$open" && HOME=$home XDG_CONFIG_HOME=$home/.config node "$repo/src/blackwall.mjs" "$@"); }
http_code() { blackwall_open sh -c 'curl -sS -o /dev/null --max-time 10 --noproxy "" --proxy "$HTTP_PROXY" -w "%{http_code}" "$1"' sh "$1"; }
read -r port listener < <(node -e 'const server = require("http").createServer((q, s) => s.end("ok")).listen(0, "127.0.0.1", () => console.log(server.address().port, process.pid))')
echo '{"network":{"allowedHosts":["*"]}}' >"$open/.blackwall/config.json" && blackwall_open --trust >/dev/null
check '127.0.0.1 blocked under "*"' eval 'test "$(http_code "http://127.0.0.1:$port/")" = 403'
check 'localhost blocked under "*"' eval 'test "$(http_code "http://localhost:$port/")" = 403'
check 'foo.localhost blocked under "*"' eval 'test "$(http_code "http://foo.localhost:$port/")" = 403'
check 'localhost.. blocked under "*"' eval 'test "$(http_code "http://localhost..:$port/")" = 403'
check 'foo.localhost.. blocked under "*"' eval 'test "$(http_code "http://foo.localhost..:$port/")" = 403'
check '[::1] blocked under "*"' eval 'test "$(http_code "http://[::1]:$port/")" = 403'
check 'public host allowed under "*"' eval 'test "$(http_code https://example.com/)" = 200'
# 1.1.1.1 may answer 200 or 301; only the proxy's 403 matters
check 'public IP literal allowed under "*"' eval 'test "$(http_code https://1.1.1.1/)" != 403'
check '169.254.169.254 blocked under "*"' eval 'test "$(http_code http://169.254.169.254/)" = 403'
check '0.0.0.0 blocked under "*"' eval 'test "$(http_code "http://0.0.0.0:$port/")" = 403'
printf '{"network":{"allowedHosts":["*","127.0.0.1:%s","localhost:%s"]}}\n' "$port" "$port" >"$open/.blackwall/config.json" && blackwall_open --trust >/dev/null
check 'listed IP literal allowed under "*"' eval 'test "$(http_code "http://127.0.0.1:$port/")" = 200'
check 'listed localhost port allowed under "*"' eval 'test "$(http_code "http://localhost:$port/")" = 200'
# INT, since bash prints a Terminated line for a child killed by TERM
kill -INT "$listener"

check "write cache" eval 'blackwall sh -c "mkdir -p \"\$GH_CONFIG_DIR\" && echo x > \"\$GH_CONFIG_DIR/probe\"" && test -f "$home/.cache-blackwall/gh/probe"'
check "gh runs" blackwall gh --version

cp "$home/.blackwall/config.json" "$root/config.json"
echo '{"filesystem":{"allowRead":"/"}}' >"$home/.blackwall/config.json"
check "config error exits 2" eval 'blackwall true; test $? -eq 2'
echo '{"network":{"deniedHosts":["*"]}}' >"$home/.blackwall/config.json"
check '"*" in deniedHosts exits 2' eval 'blackwall true; test $? -eq 2'
echo '{"network":{"deniedHosts":["1.2.3.4:443"]}}' >"$home/.blackwall/config.json"
check "IP literal with port in deniedHosts exits 2" eval 'blackwall true; test $? -eq 2'
echo '{"network":{"allowLocalBinding":true}}' >"$home/.blackwall/config.json"
check "unexposed srt key exits 2" eval 'blackwall true; test $? -eq 2'
check "unexposed srt key named as unknown key" eval 'grep -q "unknown key network.allowLocalBinding" <<<"$(blackwall true 2>&1)"'
echo '{"network":{"allowedDomains":["x.com"]}}' >"$home/.blackwall/config.json"
check "old allowedDomains key exits 2" eval 'blackwall true; test $? -eq 2'
echo '{"filesystem":{"denyRead":["secrets"]}}' >"$home/.blackwall/config.json"
mkdir -p "$added/secrets" && echo secret >"$added/secrets/key"
check "read --add-dir relative denyRead denied" eval '! blackwall --add-dir "$added" cat "$added/secrets/key" | grep -q secret'
mv "$root/config.json" "$home/.blackwall/config.json"

skill=$elsewhere/linked-skill/SKILL.md
check "read outside grants denied" eval '! blackwall cat "$skill"'
mkdir -p "$proj/.blackwall"
printf '{"filesystem":{"allowRead":["%s"]}}\n' "$elsewhere" >"$proj/.blackwall/config.json"
check "untrusted project config refused" eval 'grep -q "not trusted" <<<"$(blackwall true 2>&1)"'
check "--trust" blackwall --trust
check "trusted project config grants read" blackwall cat "$skill"
check "write cwd .blackwall denied" eval 'blackwall sh -c "echo x >> .blackwall/config.json"; ! grep -q "^x" "$proj/.blackwall/config.json"'

echo "E2E_TOKEN=user" >"$home/.blackwall/.env"
printf 'E2E_TOKEN=project\nGH_CONFIG_DIR=elsewhere\n' >"$proj/.blackwall/.env"
check "project .env overrides user .env" eval 'test "$(blackwall sh -c "echo \$E2E_TOKEN")" = project'
check "BLACKWALL_SANDBOX marks the sandbox" eval 'test "$(blackwall sh -c "echo \$BLACKWALL_SANDBOX")" = 1'
check "project .env can't override blackwall vars" eval 'test "$(blackwall sh -c "echo \$GH_CONFIG_DIR")" = "$home/.cache-blackwall/gh"'
rm "$home/.blackwall/.env"

check "edited project config refused" eval 'echo "{}" >"$proj/.blackwall/config.json"; grep -q "not trusted" <<<"$(blackwall true 2>&1)"'
rm "$proj/.blackwall/config.json"
check "project .env without config refused" eval 'grep -q "loads only with a trusted" <<<"$(blackwall true 2>&1)"'
rm -r "$proj/.blackwall"
check "create cwd .blackwall denied" eval 'blackwall mkdir .blackwall; ! test -e "$proj/.blackwall"'

first=$(blackwall claude --version 2>&1)
check "claude runs" eval 'grep -q "Claude Code" <<<"$first"'
check "first run prints the notice" eval 'grep -q "blackwall: created" <<<"$first"'
check "CLAUDE.md copied" test -f "$home/.claude-blackwall/CLAUDE.md"
check "linked skill copied as a folder" eval 'test -f "$home/.claude-blackwall/skills/linked-skill/SKILL.md" && ! test -L "$home/.claude-blackwall/skills/linked-skill"'
check "bundled skill replaces the host copy" cmp "$repo/skills/blackwall/SKILL.md" "$home/.claude-blackwall/skills/blackwall/SKILL.md"
check "settings seeded without hooks" eval 'grep -q enabledPlugins "$home/.claude-blackwall/settings.json" && ! grep -q hooks "$home/.claude-blackwall/settings.json"'
check "second run prints no notice" eval '! blackwall claude --version 2>&1 | grep -q "blackwall: created"'

check "--print-file-access" eval 'blackwall --print-file-access claude | grep -q "write denied:"'
check "--print-network-access" eval 'blackwall --print-network-access claude | grep -q "denied ranges:"'
check "--print-network-access shows ranges and this machine" eval 'out=$(blackwall --print-network-access claude) && grep -qx "  10.0.0.0/8" <<<"$out" && grep -q "^  this machine: " <<<"$out"'
echo "E2E_TOKEN=leak" >"$home/.blackwall/.env"
check "--print-env shows presets, not .env keys" eval 'out=$(blackwall --print-env claude) && grep -q "^# preset git:" <<<"$out" && ! grep -q E2E_TOKEN <<<"$out"'
rm "$home/.blackwall/.env"

check "package ships the skill" eval '(cd "$repo" && npm pack --dry-run --json) | grep -q "\"skills/blackwall/SKILL.md\""'
check "--version" eval 'grep -q "\"version\": \"$(blackwall --version)\"" "$repo/package.json"'

# Named claude so the claude adapter's grants and env apply, without needing a login
printf '#!/bin/sh\necho x > "$CLAUDE_CONFIG_DIR/probe"\n' >"$proj/claude" && chmod +x "$proj/claude"
check "write claude profile" eval 'blackwall ./claude && test -f "$home/.claude-blackwall/probe"'

first=$(blackwall codex --version 2>&1)
check "codex runs" eval 'grep -q "codex-cli" <<<"$first"'
check "codex first run prints the notice" eval 'grep -q "blackwall: created" <<<"$first"'
check "AGENTS.md copied" test -f "$home/.codex-blackwall/AGENTS.md"
check "codex user skill copied as a folder" eval 'test -f "$home/.codex-blackwall/skills/linked-skill/SKILL.md" && ! test -L "$home/.codex-blackwall/skills/linked-skill"'
check "codex bundled skill replaces the host copy" eval 'cmp "$repo/skills/blackwall/SKILL.md" "$home/.codex-blackwall/skills/blackwall/SKILL.md" && ! test -e "$home/.codex-blackwall/skills/blackwall/stale.md"'
check "write ~/.codex denied" eval 'blackwall sh -c "echo x >> \"\$HOME/.codex/AGENTS.md\""; test "$(cat "$home/.codex/AGENTS.md")" = "# host instructions"'
printf '#!/bin/sh\nset -e\ncat "$CODEX_HOME/skills/linked-skill/SKILL.md"\necho x > "$CODEX_HOME/probe"\n' >"$proj/codex" && chmod +x "$proj/codex"
check "codex reads user skill and writes profile" eval 'blackwall ./codex && test -f "$home/.codex-blackwall/probe"'
check "codex hosts" eval 'blackwall --print-config codex | grep -q "\"chatgpt.com\""'

chmod 000 "$home/.codex/AGENTS.md"
check "unreadable codex instructions block launch" eval 'grep -q EACCES <<<"$(blackwall codex --version 2>&1)"'
chmod 600 "$home/.codex/AGENTS.md"

echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
