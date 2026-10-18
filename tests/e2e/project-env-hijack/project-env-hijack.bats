bats_require_minimum_version 1.5.0

setup_file() {
  load ../common

  prepare project-env-hijack
  blackwall --trust >/dev/null
}

setup() {
  load ../common
}

@test "project .env PATH never reaches the launcher's shell" {
  run -0 blackwall /usr/bin/true
  refute [ -e "$home/outside-marker" ]
}

@test "command runs sandboxed under project .env PATH" {
  run blackwall sh -c 'echo x > f; echo x > "$HOME/denied.txt"'
  assert [ -f "$proj/f" ]
  refute [ -e "$home/denied.txt" ]
}

@test "project .env PATH reaches the command" {
  run -0 blackwall sh -c 'echo $PATH'
  assert_output --partial "$proj/bin"
}
