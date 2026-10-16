bats_require_minimum_version 1.5.0

setup_file() {
  load common

  prepare codex
  blackwall codex --version >"$work/first-run.out" 2>&1
}

setup() {
  load common
}

@test "codex runs" {
  run -0 cat "$work/first-run.out"
  assert_output --partial codex-cli
}

@test "first run prints the notice" {
  run -0 cat "$work/first-run.out"
  assert_output --partial "blackwall: created"
}

@test "AGENTS.md copied" {
  assert [ -f "$home/.codex-blackwall/AGENTS.md" ]
}

@test "user skill copied as a folder" {
  assert [ -f "$home/.codex-blackwall/skills/linked-skill/SKILL.md" ]
  refute [ -L "$home/.codex-blackwall/skills/linked-skill" ]
}

@test "bundled skill replaces the host copy" {
  run -0 cmp "$repo/skills/blackwall/SKILL.md" "$home/.codex-blackwall/skills/blackwall/SKILL.md"
  refute [ -e "$home/.codex-blackwall/skills/blackwall/stale.md" ]
}

# Named codex so the codex adapter's grants and env apply, without needing a login
@test "codex reads user skill and writes profile" {
  printf '#!/bin/sh\nset -e\ncat "$CODEX_HOME/skills/linked-skill/SKILL.md"\necho x > "$CODEX_HOME/probe"\n' >"$proj/codex" && chmod +x "$proj/codex"

  run -0 blackwall ./codex
  assert [ -f "$home/.codex-blackwall/probe" ]
}

@test "unreadable codex instructions block launch" {
  chmod 000 "$home/.codex/AGENTS.md"

  run ! blackwall codex --version
  assert_output --partial EACCES
}
