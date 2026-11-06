bats_require_minimum_version 1.5.0

setup() {
  load ../common

  # Each test edits the configs, so each gets a fresh copy
  prepare self-signed-node
  # A stub in place of the signed copy, so the tests skip codesign and run on Linux too
  printf '#!/bin/sh\necho "node-blackwall $*"\n' >"$home/.blackwall/node-blackwall"
  chmod +x "$home/.blackwall/node-blackwall"
}

user_config() { echo "$1" >"$home/.blackwall/config.json"; }

@test "plain node without the flag or the key" {
  run -0 blackwall --version
  refute_output --partial node-blackwall
}

@test "--self-signed-node runs blackwall in the signed copy" {
  run -0 blackwall --self-signed-node --version
  assert_output --regexp "^node-blackwall .*/src/blackwall.js --self-signed-node --version$"
  run -0 blackwall --no-config --self-signed-node --version
  assert_output --partial node-blackwall
  run -0 blackwall --add-dir "$added" --self-signed-node --version
  assert_output --partial node-blackwall
}

@test "--self-signed-node after the command goes to the command" {
  run -0 blackwall --no-config -- echo --self-signed-node
  assert_output -- --self-signed-node
}

@test "useSelfSignedNode in the user config runs blackwall in the signed copy" {
  user_config '{"useSelfSignedNode":true}'

  run -0 blackwall --version
  assert_output --partial node-blackwall
  run -0 blackwall --no-config --version
  refute_output --partial node-blackwall
}

@test "useSelfSignedNode in a project config refused" {
  mkdir -p "$proj/.blackwall"
  echo '{"useSelfSignedNode":true}' >"$proj/.blackwall/config.json"

  run -2 blackwall --trust
  assert_output --partial "useSelfSignedNode can only be set in ~/.blackwall/config.json"
}

@test "invalid user config JSON fails in main, not in the early read" {
  user_config '{bad'

  run -1 blackwall --print-config
  assert_output --partial SyntaxError
  assert_output --partial "at parseConfig"
}
