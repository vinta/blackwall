bats_require_minimum_version 1.5.0

setup_file() {
  load ../common

  prepare project-untrusted
}

setup() {
  load ../common
}

@test "untrusted project config refused" {
  run -2 blackwall cat "$elsewhere/secret.txt"
  assert_output --partial "not trusted"
}

@test "--trust" {
  run -0 blackwall --trust
}

@test "edited project config refused" {
  blackwall --trust >/dev/null
  echo '{}' >"$proj/.blackwall/config.json"

  run -2 blackwall true
  assert_output --partial "not trusted"
}
