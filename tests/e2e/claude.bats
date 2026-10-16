bats_require_minimum_version 1.5.0

setup_file() {
  load common

  prepare claude
  blackwall claude --version >"$work/first-run.out" 2>&1
}

setup() {
  load common
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

@test "--print-network-access shows ranges and this machine" {
  run -0 blackwall --print-network-access claude
  assert_line "denied ranges:"
  assert_line "  10.0.0.0/8"
  assert_line --regexp "^  this machine: "
}

@test "--print-env shows presets, not .env keys" {
  run -0 blackwall --print-env claude
  assert_line --regexp "^# preset git:"
  refute_output --partial E2E_TOKEN
}

# Named claude so the claude adapter's grants and env apply, without needing a login
@test "write claude profile" {
  printf '#!/bin/sh\necho x > "$CLAUDE_CONFIG_DIR/probe"\n' >"$proj/claude" && chmod +x "$proj/claude"

  run -0 blackwall ./claude
  assert [ -f "$home/.claude-blackwall/probe" ]
}
