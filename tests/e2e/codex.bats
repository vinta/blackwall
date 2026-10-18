bats_require_minimum_version 1.5.0

setup_file() {
  load common

  prepare codex
  # A pipe, not a file: npm's codex is a node script, and node 24.20 aborts at startup when stdout is a file the sandbox can't read
  local out
  out=$(blackwall codex --version 2>&1) || { echo "$out" >&2; return 1; }
  echo "$out" >"$work/first-run.out"
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

@test "codex preserves sandbox rules without copying host rules" {
  mkdir -p "$home/.codex/rules" "$home/.codex-blackwall/rules"
  printf 'host rules\n' >"$home/.codex/rules/host.rules"
  printf 'sandbox rules\n' >"$proj/sandbox.rules"
  ln -s "$proj/sandbox.rules" "$home/.codex-blackwall/rules/default.rules"
  printf '#!/bin/sh\ncat "$CODEX_HOME/rules/default.rules"\n' >"$proj/codex" && chmod +x "$proj/codex"

  run -0 blackwall ./codex
  assert_output "sandbox rules"
  assert [ -L "$home/.codex-blackwall/rules/default.rules" ]
  refute [ -e "$home/.codex-blackwall/rules/host.rules" ]
}

# A sandboxed run can write its profile folder itself, so it can swap it for a link to the host's folder
@test "symlinked profile blocks launch and spares the host folder" {
  mv "$home/.codex-blackwall" "$work/profile"
  ln -s "$home/.codex" "$home/.codex-blackwall"

  run -2 blackwall codex --version
  assert_output --partial "is a symlink"
  assert [ -f "$home/.codex/AGENTS.md" ]
  rm "$home/.codex-blackwall" && mv "$work/profile" "$home/.codex-blackwall"
}

@test "unreadable codex instructions block launch" {
  chmod 000 "$home/.codex/AGENTS.md"

  run ! blackwall codex --version
  assert_output --partial EACCES
}
