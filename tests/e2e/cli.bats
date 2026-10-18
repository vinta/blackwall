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

  run -2 blackwall --add-dir "$repo" "$(realpath "$(command -v node)")" "$repo/src/blackwall.js" --version
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

@test "--completion zsh prints a script zsh parses" {
  run -0 blackwall --completion zsh
  run -0 zsh -n -c "$output"
}

@test "--completion zsh covers every flag in the usage" {
  run -0 blackwall --completion zsh
  local flag
  for flag in $(sed -n 's/^const USAGE = //p' "$repo/src/cli/index.js" | grep -o -- '--[a-z][a-z-]*'); do
    assert_output --partial -- "$flag["
  done
}

@test "--completion refuses other shells" {
  run -2 blackwall --completion bash
  assert_output "blackwall: --completion supports zsh only"
}
