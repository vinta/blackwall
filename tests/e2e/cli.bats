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
    # A spec is --flag[...], or {-f,--flag}[...] for a flag with a short form
    assert_output --regexp -- "${flag}[[,}]"
  done
}

@test "--completion refuses other shells" {
  run -2 blackwall --completion bash
  assert_output "blackwall: --completion supports zsh only"
}

@test "--completion without a shell refused" {
  run -2 blackwall --completion
  assert_output "blackwall: --completion supports zsh only"
}

@test "--help and -h show the usage" {
  run -0 blackwall --help
  assert_output --partial "usage: blackwall"
  run -0 blackwall -h
  assert_output --partial "usage: blackwall"
}

@test "no command shows the usage" {
  run -2 blackwall
  assert_output --partial "usage: blackwall"
  run -2 blackwall --
  assert_output --partial "usage: blackwall"
}

@test "unknown option refused" {
  run -2 blackwall --verison
  assert_line --index 0 "blackwall: unknown option --verison"
  assert_line --index 1 --partial "usage: blackwall"
  run -2 blackwall --add-dir "$added" -v true
  assert_line --index 0 "blackwall: unknown option -v"
}

@test "-- runs a command whose name starts with -" {
  run -127 blackwall -- -v
  refute_output --partial "unknown option"
}

@test "--add-dir without a folder refused" {
  run -2 blackwall --add-dir
  assert_output "blackwall: --add-dir needs a folder"
}

@test "--add-dir refuses a path that isn't a folder" {
  run -2 blackwall --add-dir "$work/missing" true
  assert_output "blackwall: --add-dir $work/missing: not a folder"
  touch "$added/file"
  run -2 blackwall --add-dir "$added/file" true
  assert_output "blackwall: --add-dir $added/file: not a folder"
}

@test "--trust without a project config refused" {
  run -2 blackwall --trust
  assert_output --partial ".blackwall/config.json: not found"
}

@test "missing command fails" {
  run -127 blackwall nosuchcmd
}

@test "--allow-internet adds * to allowedHosts" {
  run -0 blackwall --print-config
  refute_output --partial '"*"'
  run -0 blackwall --allow-internet --print-config
  assert_output --partial '"*"'
}

@test "--print-network-access puts * on the denied side without it" {
  run -0 blackwall --print-network-access
  assert_line "  github.com"
  assert_output --partial $'denied hosts:\n  *\nrefused addresses, unless allowed by IP:\n  deniedHosts:\n    10.0.0.0/8\n'
  run -0 blackwall --allow-internet --print-network-access
  assert_output --partial $'allowed hosts:\n  *\ndenied hosts:\n  localhost\n'
  refute_line "  github.com"
}
