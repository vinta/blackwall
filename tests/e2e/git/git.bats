bats_require_minimum_version 1.5.0

setup_file() {
  load ../common

  prepare git
}

setup() {
  load ../common
}

@test "git reads ~/.config/git/config" {
  run -0 blackwall git config --get user.email
  assert_output e2e@example.com
}

@test "git reads \$XDG_CONFIG_HOME/git/config" {
  run -0 bash -c 'cd "$proj" && HOME=$home XDG_CONFIG_HOME=$elsewhere/xdg node "$1/src/blackwall.js" git config --get user.email' bash "$repo"
  assert_output xdg@example.com
}

@test "git branch -d deletes despite config error" {
  git -C "$proj" -c user.name=e2e -c user.email=e2e@example.com commit -q --allow-empty -m init
  git -C "$proj" branch gone

  run -0 blackwall git branch -d gone
  assert_output --partial "could not write config file"
  run ! git -C "$proj" rev-parse -q --verify refs/heads/gone
}

# git saves srt's per-launch proxy login through every credential helper after a transfer
@test "git keeps srt's proxy login out of credential helpers" {
  git config --file "$home/.gitconfig" credential.helper "store --file=$proj/creds.txt"

  run -0 blackwall git ls-remote https://github.com/vinta/blackwall HEAD
  refute_output --partial "failed to store"
  assert [ ! -e "$proj/creds.txt" ]
}

@test "git still stores other hosts' credentials through helpers" {
  git config --file "$home/.gitconfig" credential.helper "store --file=$proj/creds.txt"

  run -0 blackwall sh -c "printf 'protocol=https\nhost=github.com\nusername=u\npassword=p\n' | git credential approve"
  run -0 cat "$proj/creds.txt"
  assert_output "https://u:p@github.com"
}
