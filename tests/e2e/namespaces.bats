bats_require_minimum_version 1.5.0

setup_file() {
  load common

  prepare namespaces
}

setup() {
  load common
}

@test "user namespace refused (Linux)" {
  [ "$(uname)" = Linux ] || skip "Linux only"

  run ! blackwall unshare -r true
  assert_output --partial "Operation not permitted"
}
