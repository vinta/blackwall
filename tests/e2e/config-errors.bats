bats_require_minimum_version 1.5.0

setup_file() {
  load common

  prepare config-errors
}

setup() {
  load common
}

user_config() { echo "$1" >"$home/.blackwall/config.json"; }

@test "config error exits 2" {
  user_config '{"filesystem":{"allowRead":"/"}}'

  run -2 blackwall true
}

@test "* in deniedHosts exits 2" {
  user_config '{"network":{"deniedHosts":["*"]}}'

  run -2 blackwall true
}

@test "IP literal with port in deniedHosts exits 2" {
  user_config '{"network":{"deniedHosts":["1.2.3.4:443"]}}'

  run -2 blackwall true
}

@test "unexposed srt key named as unknown key" {
  user_config '{"network":{"allowLocalBinding":true}}'

  run -2 blackwall true
  assert_output --partial "unknown key network.allowLocalBinding"
}

@test "old allowedDomains key exits 2" {
  user_config '{"network":{"allowedDomains":["x.com"]}}'

  run -2 blackwall true
}

@test "read --add-dir relative denyRead denied" {
  user_config '{"filesystem":{"denyRead":["secrets"]}}'

  run ! blackwall --add-dir "$added" cat "$added/secrets/key"
  refute_output --partial hunter2
}

@test "read --add-dir ./ relative denyRead denied" {
  user_config '{"filesystem":{"denyRead":["./secrets"]}}'

  run ! blackwall --add-dir "$added" cat "$added/secrets/key"
  refute_output --partial hunter2
}
