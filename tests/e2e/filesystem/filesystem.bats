bats_require_minimum_version 1.5.0

setup_file() {
  load ../common

  prepare filesystem
  # Nested folders a run could plant in, which can't be committed as fixtures under .git
  mkdir -p "$proj/sub/.claude" "$added/sub/.git/hooks" "$added/sub/.claude"
}

# Git GUIs that scan nested repos flag this one as untrusted while a nested .git has no config
teardown_file() {
  rm -rf "$added/sub" "$added/sub2"
}

setup() {
  load ../common
}

@test "write in cwd" {
  run -0 blackwall sh -c 'echo x > f'
  assert [ -f "$proj/f" ]
}

@test "write in --add-dir" {
  run -0 blackwall --add-dir "$added" sh -c 'echo x > "$1/f"' sh "$added"
  assert [ -f "$added/f" ]
}

@test "write to ~ never reaches it" {
  run blackwall sh -c 'echo x > "$HOME/outside"'
  refute [ -e "$home/outside" ]
}

@test "read ~ denied" {
  run ! blackwall cat "$home/secret.txt"
  refute_output --partial hunter2
}

@test "read outside grants denied" {
  run ! blackwall cat "$elsewhere/secret.txt"
  refute_output --partial hunter2
}

@test "read ~/Desktop denied" {
  run ! blackwall cat "$home/Desktop/Screenshot.png"
  refute_output --partial hunter2
}

@test "pasteboard denied (macOS)" {
  [ "$(uname)" = Darwin ] || skip "macOS only"

  run ! blackwall sh -c 'pbpaste >/dev/null'
}

# The skill's Linux row: a denied dir is an empty writable tmpfs, so reads say ENOENT and writes land there and vanish with the run
@test "denied read reads as missing (Linux)" {
  [ "$(uname)" = Linux ] || skip "Linux only"

  run ! blackwall cat "$home/secret.txt"
  assert_output --partial "No such file"
}

@test "denied write succeeds inside and vanishes (Linux)" {
  [ "$(uname)" = Linux ] || skip "Linux only"

  run -0 blackwall sh -c 'echo x > "$HOME/outside" && test -f "$HOME/outside"'
  refute [ -e "$home/outside" ]
}

@test "write cwd .git/hooks denied" {
  run blackwall sh -c 'echo x > .git/hooks/pre-commit'
  refute [ -e "$proj/.git/hooks/pre-commit" ]
}

@test "write cwd .git/config denied" {
  run blackwall sh -c 'echo x >> .git/config'
  refute grep -q '^x' "$proj/.git/config"
}

@test "write cwd .claude/settings.local.json denied" {
  run blackwall sh -c 'echo x > .claude/settings.local.json'
  refute [ -e "$proj/.claude/settings.local.json" ]
}

@test "write cwd .claude/hooks denied" {
  run blackwall mkdir .claude/hooks
  refute [ -e "$proj/.claude/hooks" ]
}

@test "write cwd .claude/other allowed" {
  run -0 blackwall sh -c 'echo x > .claude/other'
  assert [ -f "$proj/.claude/other" ]
}

@test "write cwd nested .claude/settings.json denied" {
  run blackwall sh -c 'echo x > sub/.claude/settings.json'
  refute [ -e "$proj/sub/.claude/settings.json" ]
}

@test "create cwd .blackwall denied" {
  run blackwall mkdir .blackwall
  refute [ -e "$proj/.blackwall" ]
}

@test "write --add-dir .git/hooks denied" {
  run blackwall --add-dir "$added" sh -c 'echo x > "$1/.git/hooks/pre-commit"' sh "$added"
  refute [ -e "$added/.git/hooks/pre-commit" ]
}

@test "write --add-dir .git/config denied" {
  run blackwall --add-dir "$added" sh -c 'echo x >> "$1/.git/config"' sh "$added"
  refute grep -q '^x' "$added/.git/config"
}

@test "write --add-dir .claude/settings.json denied" {
  run blackwall --add-dir "$added" sh -c 'echo x > "$1/.claude/settings.json"' sh "$added"
  refute [ -e "$added/.claude/settings.json" ]
}

@test "write --add-dir .mcp.json denied" {
  run blackwall --add-dir "$added" sh -c 'echo x > "$1/.mcp.json"' sh "$added"
  refute [ -e "$added/.mcp.json" ]
}

@test "write --add-dir .claude/commands denied" {
  run blackwall --add-dir "$added" sh -c 'mkdir -p "$1/.claude/commands" && echo x > "$1/.claude/commands/x.md"' sh "$added"
  refute [ -e "$added/.claude/commands/x.md" ]
}

@test "write --add-dir .claude/agents denied" {
  run blackwall --add-dir "$added" sh -c 'mkdir -p "$1/.claude/agents" && echo x > "$1/.claude/agents/x.md"' sh "$added"
  refute [ -e "$added/.claude/agents/x.md" ]
}

@test "write --add-dir nested .git/hooks denied" {
  run ! blackwall --add-dir "$added" sh -c 'echo x > "$1/sub/.git/hooks/pre-commit"' sh "$added"
  refute [ -e "$added/sub/.git/hooks/pre-commit" ]
}

@test "write --add-dir .git/hooks created during run denied (macOS)" {
  [ "$(uname)" = Darwin ] || skip "macOS only: Linux denies only what exists at launch"

  run ! blackwall --add-dir "$added" sh -c 'mkdir -p "$1/sub2/.git/hooks" && echo x > "$1/sub2/.git/hooks/pre-commit"' sh "$added"
  refute [ -e "$added/sub2/.git/hooks/pre-commit" ]
}

@test "write --add-dir nested .claude/other allowed" {
  run -0 blackwall --add-dir "$added" sh -c 'echo x > "$1/sub/.claude/other"' sh "$added"
  assert [ -f "$added/sub/.claude/other" ]
}

@test "create --add-dir .blackwall denied" {
  run blackwall --add-dir "$added" mkdir "$added/.blackwall"
  refute [ -e "$added/.blackwall" ]
}

@test "write ~/.blackwall under --add-dir ~ denied" {
  run blackwall --add-dir "$home" sh -c 'echo x > "$HOME/.blackwall/probe"'
  refute [ -e "$home/.blackwall/probe" ]
}

@test "write ~/.claude denied" {
  run blackwall sh -c 'echo x >> "$HOME/.claude/CLAUDE.md"'
  assert_equal "$(cat "$home/.claude/CLAUDE.md")" "# host instructions"
}

@test "write ~/.codex denied" {
  run blackwall sh -c 'echo x >> "$HOME/.codex/AGENTS.md"'
  assert_equal "$(cat "$home/.codex/AGENTS.md")" "# host instructions"
}

@test "write cache" {
  run -0 blackwall sh -c 'mkdir -p "$GH_CONFIG_DIR" && echo x > "$GH_CONFIG_DIR/probe"'
  assert [ -f "$home/.cache-blackwall/gh/probe" ]
}

@test "write pre-commit cache" {
  run -0 blackwall sh -c 'mkdir -p "$PRE_COMMIT_HOME" && echo x > "$PRE_COMMIT_HOME/probe"'
  assert [ -f "$home/.cache-blackwall/pre-commit/probe" ]
}

# zsh writes heredocs under $TMPPREFIX, /tmp/zsh by default, not $TMPDIR
@test "zsh heredoc" {
  command -v zsh >/dev/null || skip "no zsh"

  run -0 blackwall zsh -c 'cat <<END
hello
END'
  assert_output hello
}
