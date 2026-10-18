bats_require_minimum_version 1.5.0

setup_file() {
  load common

  prepare project-env-key
  blackwall --trust >/dev/null
}

setup() {
  load common
}

# The shell joins INJ""ECTED, so INJECTED shows only if the key runs
@test "project .env key that isn't a variable name refused" {
  run -2 blackwall true
  assert_output --partial 'A;printf INJ""ECTED;#: not a valid variable name'
  refute_output --partial INJECTED
}
