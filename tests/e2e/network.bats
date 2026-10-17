bats_require_minimum_version 1.5.0

setup_file() {
  load common

  prepare network
}

setup() {
  load common

  # fnm's PATH entry is a link under the real ~/.local/state, which the stub HOME doesn't grant
  node=$(realpath "$(command -v node)")
}

@test "preset host allowed" {
  run -0 blackwall curl -sS -o /dev/null --max-time 20 https://api.github.com
}

@test "other host blocked" {
  run ! blackwall curl -sSv -o /dev/null --max-time 20 https://example.com
  assert_output --partial "response 403"
  assert_output --partial "403 host is not on the allow list"
}

@test "host resolving into RFC 1918 blocked" {
  run ! blackwall curl -sSv -o /dev/null --max-time 20 https://10.0.0.1.sslip.io
  assert_output --partial "response 403"
  assert_output --partial "403 resolved to a listed address"
}

@test "node fetch reaches preset host" {
  run -0 blackwall "$node" -e 'fetch("https://api.github.com")'
}

@test "node fetch to other host blocked" {
  run -0 blackwall "$node" -e 'fetch("https://example.com").catch((e) => console.log(e.cause.message))'
  assert_output --partial "Request was cancelled"
}

@test "gh runs" {
  run -0 blackwall gh --version
}
