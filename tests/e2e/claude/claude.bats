bats_require_minimum_version 1.5.0

setup_file() {
  load ../common
  # A FIFO at the plugin record hangs the launch instead of failing it; bats reads the timeout before setup() runs, so it can't be set per test
  export BATS_TEST_TIMEOUT=30

  prepare claude
  blackwall claude --version >"$work/first-run.out" 2>&1 || { cat "$work/first-run.out" >&2; return 1; }
}

setup() {
  load ../common
}

@test "claude runs" {
  run -0 cat "$work/first-run.out"
  assert_output --partial "Claude Code"
}

@test "first run prints the notice" {
  run -0 cat "$work/first-run.out"
  assert_output --partial "blackwall: created"
}

@test "CLAUDE.md copied" {
  assert [ -f "$home/.claude-blackwall/CLAUDE.md" ]
}

@test "linked skill copied as a folder" {
  assert [ -f "$home/.claude-blackwall/skills/linked-skill/SKILL.md" ]
  refute [ -L "$home/.claude-blackwall/skills/linked-skill" ]
}

@test "bundled skill replaces the host copy" {
  run -0 cmp "$repo/skills/blackwall/SKILL.md" "$home/.claude-blackwall/skills/blackwall/SKILL.md"
}

@test "settings seeded without hooks" {
  run -0 cat "$home/.claude-blackwall/settings.json"
  assert_output --partial enabledPlugins
  refute_output --partial hooks
}

@test "second run prints no notice" {
  run -0 blackwall claude --version
  refute_output --partial "blackwall: created"
}

@test "--print-file-access" {
  run -0 blackwall --print-file-access claude
  assert_output --partial "write denied:"
}

@test "--print-file-access sorts each section and expands ~" {
  blackwall --print-file-access claude >"$work/file-access"
  run -0 cat "$work/file-access"
  refute_line --regexp "^  ~"
  # Each section's paths, compared with themselves sorted
  run -0 node -e '
    const sections = require("fs").readFileSync(process.argv[1], "utf8").split(/^\S.*:\n/m).slice(1);
    for (const section of sections) {
      const paths = section.trim().split("\n").map((line) => line.trim());
      if (paths.join() !== [...paths].sort((a, b) => a.localeCompare(b)).join()) { console.log(paths); process.exit(1); }
    }' "$work/file-access"
}

@test "--print-network-access shows ranges and this machine" {
  run -0 blackwall --print-network-access claude
  assert_line "denied hosts:"
  assert_line "  private network:"
  assert_line "    10.0.0.0/8"
  assert_line "  loopback:"
  assert_line "    127.0.0.0/8"
  assert_line "  this machine:"
  # This machine's loopback and link-local addresses are covered by those classes
  refute_line "    127.0.0.1"
  refute_line --regexp "^    fe80::[^/]*$"
}

@test "--print-env shows presets, not .env keys" {
  run -0 blackwall --print-env claude
  assert_line --regexp "^# preset git:"
  refute_output --partial E2E_TOKEN
}

# A sandboxed run can write its profile folder itself, so it can swap it for a link to the host's folder
@test "symlinked profile blocks launch and spares the host folder" {
  mv "$home/.claude-blackwall" "$work/profile"
  ln -s "$home/.claude" "$home/.claude-blackwall"

  run -2 blackwall claude --version
  assert_output --partial "is a symlink"
  assert [ -f "$home/.claude/CLAUDE.md" ]
  rm "$home/.claude-blackwall" && mv "$work/profile" "$home/.claude-blackwall"
}

# Named claude so the claude adapter's grants and env apply, without needing a login
@test "write claude profile" {
  printf '#!/bin/sh\necho x > "$CLAUDE_CONFIG_DIR/probe"\n' >"$proj/claude" && chmod +x "$proj/claude"

  run -0 blackwall ./claude
  assert [ -f "$home/.claude-blackwall/probe" ]
}

@test "plugin record refreshed from the host, keeping sandbox installs" {
  printf '#!/bin/sh\n' >"$proj/claude" && chmod +x "$proj/claude"
  mkdir -p "$home/.claude-blackwall/plugins"
  cat >"$home/.claude-blackwall/plugins/installed_plugins.json" <<EOF
{"version":2,"plugins":{"x@y":[{"scope":"user","installPath":"$home/.claude-blackwall/plugins/cache/y/x/1.0.0","version":"1.0.0"}],"local@z":[{"scope":"user","installPath":"$home/.claude-blackwall/plugins/cache/z/local/0.1.0","version":"0.1.0"}]}}
EOF

  run -0 blackwall ./claude
  run -0 cat "$home/.claude-blackwall/plugins/installed_plugins.json"
  assert_output --partial "\"installPath\": \"$home/.claude/plugins/cache/y/x/2.0.0\""
  assert_output --partial '"version": "2.0.0"'
  refute_output --partial "y/x/1.0.0"
  assert_output --partial '"local@z"'
}

@test "plugin record left alone without a host record" {
  printf '#!/bin/sh\n' >"$proj/claude" && chmod +x "$proj/claude"
  mv "$home/.claude/plugins/installed_plugins.json" "$work/host-record"
  rm -rf "$home/.claude-blackwall/plugins"

  run -0 blackwall ./claude
  refute [ -e "$home/.claude-blackwall/plugins/installed_plugins.json" ]
  mv "$work/host-record" "$home/.claude/plugins/installed_plugins.json"
}

@test "linked plugin record spares its target" {
  printf '#!/bin/sh\n' >"$proj/claude" && chmod +x "$proj/claude"
  mkdir -p "$home/.claude-blackwall/plugins"
  ln -sf "$home/.claude/settings.json" "$home/.claude-blackwall/plugins/installed_plugins.json"

  run -0 blackwall ./claude
  run -0 cmp "$e2e/claude/home/.claude/settings.json" "$home/.claude/settings.json"
  refute [ -L "$home/.claude-blackwall/plugins/installed_plugins.json" ]
}

@test "FIFO plugin record rebuilt from the host" {
  printf '#!/bin/sh\n' >"$proj/claude" && chmod +x "$proj/claude"
  mkdir -p "$home/.claude-blackwall/plugins"
  rm -f "$home/.claude-blackwall/plugins/installed_plugins.json"
  mkfifo "$home/.claude-blackwall/plugins/installed_plugins.json"

  run -0 blackwall ./claude
  refute [ -p "$home/.claude-blackwall/plugins/installed_plugins.json" ]
  run -0 cat "$home/.claude-blackwall/plugins/installed_plugins.json"
  assert_output --partial "\"installPath\": \"$home/.claude/plugins/cache/y/x/2.0.0\""
}

@test "directory plugin record rebuilt from the host" {
  printf '#!/bin/sh\n' >"$proj/claude" && chmod +x "$proj/claude"
  mkdir -p "$home/.claude-blackwall/plugins"
  rm -f "$home/.claude-blackwall/plugins/installed_plugins.json"
  mkdir -p "$home/.claude-blackwall/plugins/installed_plugins.json/nested"

  run -0 blackwall ./claude
  assert [ -f "$home/.claude-blackwall/plugins/installed_plugins.json" ]
  run -0 cat "$home/.claude-blackwall/plugins/installed_plugins.json"
  assert_output --partial "\"installPath\": \"$home/.claude/plugins/cache/y/x/2.0.0\""
}
