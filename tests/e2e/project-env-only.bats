bats_require_minimum_version 1.5.0

setup_file() {
  load common
  prepare project-env-only
}

setup() {
  load common
}

@test "project .env without config refused" {
  run -2 blackwall true
  assert_output --partial "loads only with a trusted"
}
