bats_require_minimum_version 1.5.0

setup_file() {
  load common

  prepare cli
}

setup() {
  load common
}

@test "nested blackwall refused" {
  # fnm's PATH entry is a link under the real ~/.local/state, which the stub HOME doesn't grant

  run -2 blackwall --add-dir "$repo" "$(realpath "$(command -v node)")" "$repo/src/blackwall.mjs" --version
  assert_output --partial "run inside a sandbox"
}

@test "package ships the skill" {
  run -0 bash -c 'cd "$1" && npm pack --dry-run --json' bash "$repo"
  assert_output --partial '"skills/blackwall/SKILL.md"'
}

@test "--version" {
  run -0 blackwall --version
  run -0 grep -q "\"version\": \"$output\"" "$repo/package.json"
}
