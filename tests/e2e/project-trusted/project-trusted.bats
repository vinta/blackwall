bats_require_minimum_version 1.5.0

setup_file() {
  load ../common

  prepare project-trusted
  blackwall --trust >/dev/null
}

setup() {
  load ../common
}

@test "trusted project config grants read" {
  run -0 blackwall cat "$elsewhere/secret.txt"
  assert_output hunter2
}

@test "write cwd .blackwall denied" {
  run blackwall sh -c 'echo x >> .blackwall/config.json'
  refute grep -q '^x' "$proj/.blackwall/config.json"
}

@test "project .env overrides user .env" {
  run -0 blackwall sh -c 'echo $E2E_TOKEN'
  assert_output project
}

@test "--no-config skips the project config and both .env files" {
  run -1 blackwall --add-dir "$added" --no-config sh -c 'echo "[$E2E_TOKEN]"; cat "$1"' sh "$elsewhere/secret.txt"
  assert_line --index 0 "[]"
  refute_output --partial hunter2
}

@test "BLACKWALL_SANDBOX marks the sandbox" {
  run -0 blackwall sh -c 'echo $BLACKWALL_SANDBOX'
  assert_output 1
}

@test "project .env can't override blackwall vars" {
  run -0 blackwall sh -c 'echo $GH_CONFIG_DIR'
  assert_output "$home/.cache-blackwall/gh"
}
