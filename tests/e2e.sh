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
rm -rf "$root/home" "$root/proj" "$root/added" "$root/elsewhere"
home=$root/home proj=$root/proj added=$root/added elsewhere=$root/elsewhere
mkdir -p "$home/.blackwall" "$home/.claude/skills" "$proj" "$added" "$elsewhere/linked-skill"
git -C "$proj" init -q

# setup-node and the claude installer put node and claude outside every default grant. Seatbelt checks a link and its target separately, so grant both the PATH entry's folder and the install folder
grants() { local path; path=$(command -v "$1"); printf '"%s","%s"' "$(dirname "$path")" "$(dirname "$(dirname "$(realpath "$path")")")"; }
printf '{"filesystem":{"allowRead":[%s,%s]}}\n' "$(grants node)" "$(grants claude)" >"$home/.blackwall/config.json"
echo secret >"$home/secret.txt"
echo "# host instructions" >"$home/.claude/CLAUDE.md"
printf -- '---\nname: linked-skill\ndescription: test\n---\nhi\n' >"$elsewhere/linked-skill/SKILL.md"
ln -s "$elsewhere/linked-skill" "$home/.claude/skills/linked-skill"
ln -s "$elsewhere/missing" "$home/.claude/skills/dangling"
echo '{"enabledPlugins":{"x@y":true},"hooks":{"PreToolUse":[]}}' >"$home/.claude/settings.json"

blackwall() { (cd "$proj" && HOME=$home node "$repo/src/blackwall.mjs" "$@"); }
pass=0 fail=0
check() {
  local name=$1; shift
  if "$@" >/dev/null 2>&1; then echo "PASS  $name"; pass=$((pass + 1)); else echo "FAIL  $name"; fail=$((fail + 1)); fi
}

# Every deny check passes when the sandbox can't start at all, so stop here if it can't
if ! blackwall true; then echo "FAIL  sandbox starts"; exit 1; fi
echo "PASS  sandbox starts"

check "write in cwd" eval 'blackwall sh -c "echo x > f" && test -f "$proj/f"'
check "write in --add-dir" eval 'blackwall --add-dir "$added" sh -c "echo x > \"$added/f\"" && test -f "$added/f"'
check "write to ~ never reaches it" eval 'blackwall sh -c "echo x > \"\$HOME/outside\""; ! test -e "$home/outside"'
check "read ~ denied" eval '! blackwall cat "$home/secret.txt" | grep -q secret'
check "write cwd .git/hooks denied" eval 'blackwall sh -c "echo x > .git/hooks/pre-commit"; ! test -e "$proj/.git/hooks/pre-commit"'
check "write ~/.claude denied" eval 'blackwall sh -c "echo x >> \"\$HOME/.claude/CLAUDE.md\""; test "$(cat "$home/.claude/CLAUDE.md")" = "# host instructions"'
check "preset host allowed" blackwall curl -sS -o /dev/null --max-time 20 https://api.github.com
check "other host blocked" eval '! blackwall curl -sS -o /dev/null --max-time 20 https://example.com'

skill=$elsewhere/linked-skill/SKILL.md
check "read outside grants denied" eval '! blackwall cat "$skill"'
mkdir -p "$proj/.blackwall"
printf '{"filesystem":{"allowRead":["%s"]}}\n' "$elsewhere" >"$proj/.blackwall/config.json"
check "untrusted project config refused" eval '! blackwall true'
check "--trust" blackwall --trust
check "trusted project config grants read" blackwall cat "$skill"
check "write cwd .blackwall denied" eval 'blackwall sh -c "echo x >> .blackwall/config.json"; ! grep -q "^x" "$proj/.blackwall/config.json"'
check "edited project config refused" eval 'echo "{}" >"$proj/.blackwall/config.json"; ! blackwall true'
rm -r "$proj/.blackwall"
check "create cwd .blackwall denied" eval 'blackwall mkdir .blackwall; ! test -e "$proj/.blackwall"'

first=$(blackwall claude --version 2>&1)
check "claude runs" eval 'grep -q "Claude Code" <<<"$first"'
check "first run prints the notice" eval 'grep -q "blackwall: created" <<<"$first"'
check "CLAUDE.md copied" test -f "$home/.claude-blackwall/CLAUDE.md"
check "linked skill copied as a folder" eval 'test -f "$home/.claude-blackwall/skills/linked-skill/SKILL.md" && ! test -L "$home/.claude-blackwall/skills/linked-skill"'
check "settings seeded without hooks" eval 'grep -q enabledPlugins "$home/.claude-blackwall/settings.json" && ! grep -q hooks "$home/.claude-blackwall/settings.json"'
check "second run prints no notice" eval '! blackwall claude --version 2>&1 | grep -q "blackwall: created"'
check "--print-file-access" eval 'blackwall --print-file-access claude | grep -q "write denied:"'

echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
