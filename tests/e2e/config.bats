bats_require_minimum_version 1.5.0

setup_file() {
  load common
  prepare config
}

setup() {
  load common
}

@test "user config adds deniedHosts" {
  run -0 blackwall --print-config true
  assert_output --partial '"192.0.2.0/24"'
}

@test "local-network preset denies localhost" {
  run -0 blackwall --print-config true
  assert_output --partial '"localhost"'
}

@test "agent-files preset in --print-config" {
  run -0 blackwall --print-config true
  assert_output --partial '/.claude/hooks"'
}

@test "user config srt replaces per key" {
  run -0 blackwall --print-config true
  assert_output --partial '"allowPty": false'
  assert_output --partial '"enableWeakerNetworkIsolation": true'
}

@test "codex hosts" {
  run -0 blackwall --print-config codex
  assert_output --partial '"chatgpt.com"'
}
