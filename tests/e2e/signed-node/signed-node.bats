bats_require_minimum_version 1.5.0

setup() {
  load ../common

  # Each test edits the home, so each gets a fresh copy
  prepare signed-node
}

# A stub in place of the signed copy, so the tests skip codesign
plant_stub() {
  printf '#!/bin/sh\necho "node-blackwall $*"\n' >"$home/.blackwall/node-blackwall"
  chmod +x "$home/.blackwall/node-blackwall"
}

@test "plain node without the signed copy" {
  run -0 blackwall --version
  refute_output --partial node-blackwall
}

@test "the signed copy runs blackwall" {
  plant_stub

  run -0 blackwall --version
  assert_output --regexp "^node-blackwall .*/src/blackwall.js --version$"
  run -0 blackwall --no-config --version
  assert_output --partial node-blackwall
  run -0 blackwall --add-dir "$added" --version
  assert_output --partial node-blackwall
}

@test "--generate-signed-node after the command goes to the command" {
  run -0 blackwall --no-config -- echo --generate-signed-node
  assert_output -- --generate-signed-node
}

@test "--generate-signed-node replaces the copy from plain node" {
  plant_stub

  run -0 blackwall --generate-signed-node
  assert_output "blackwall: generated $home/.blackwall/node-blackwall"
  run -0 codesign -dv "$home/.blackwall/node-blackwall"
  assert_output --partial "Signature=adhoc"
  run -0 "$home/.blackwall/node-blackwall" --version
  assert_output "$(node --version)"
}
