bats_require_minimum_version 1.5.0

setup_file() {
  load ../common

  prepare symlink-escape
  # Links a sandboxed run could plant in ~/.cache-blackwall, reached through links the user made
  mkdir -p "$home/.cache-blackwall/sub" "$home/real-dotfiles"
  ln -s "$home" "$home/.cache-blackwall/leak"
  ln -s "$home/.cache-blackwall/leak" "$home/.safe-link"
  ln -s "$home/.cache-blackwall/sub" "$home/dotfiles"
  ln -s dotfiles/.. "$home/.dotdot-link"
  ln -s "$home/.blackwall/config.json/.." "$home/.file-link"
  ln -s "$home/real-dotfiles" "$home/.dotfile-link"

  blackwall --print-file-access >"$work/file-access"
  sed -n '/^read allowed:$/,/^read denied:$/p' "$work/file-access" >"$work/read-allowed"
}

setup() {
  load ../common
}

@test "read grant link outside writable grants expands to its target" {
  run -0 cat "$work/read-allowed"
  assert_line "  $home/real-dotfiles"
}

@test "read grant link through a writable link or .. doesn't reach ~" {
  run -0 cat "$work/read-allowed"
  refute_line "  $home"
}

@test "read grant link through a file doesn't expand" {
  run -0 cat "$work/read-allowed"
  refute_line "  $home/.blackwall"
}

@test "symlinked cache folder blocks launch" {
  rm -rf "$home/.cache-blackwall"
  ln -s "$home" "$home/.cache-blackwall"

  run -2 blackwall true
  assert_output --partial "is a symlink"
}
