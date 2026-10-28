bats_require_minimum_version 1.5.0

# srt reads *, ?, [ and ] in a grant as a glob, so a folder named [ab] or ** could grant its siblings. Under ~, so the siblings are read-denied unless the grant leaks
setup_file() {
  load ../common

  prepare glob-dir
  export code=$home/code
  export ab="$code/[ab]" stars="$code/**"
  mkdir -p "$ab" "$stars" "$code/b" "$code/c"
  git init -q "$ab"
  echo own >"$ab/own"
  echo sentinel-a >"$code/a"
  echo sentinel-b >"$code/b/sentinel"
  echo sentinel-c >"$code/c/sentinel"
  echo sentinel-secret >"$code/secret"
}

setup() {
  load ../common
}

@test "[ab]: read in cwd" {
  proj=$ab run -0 blackwall cat own
  assert_output own
}

@test "[ab]: write in cwd" {
  proj=$ab run -0 blackwall sh -c 'echo x > f'
  assert [ -f "$ab/f" ]
}

@test "[ab]: write .git/hooks denied" {
  proj=$ab run ! blackwall sh -c 'echo x > .git/hooks/pre-commit'
  refute [ -e "$ab/.git/hooks/pre-commit" ]
}

@test "[ab]: read sibling a denied" {
  proj=$ab run ! blackwall cat ../a
  refute_output --partial sentinel-a
}

# On Linux a denied write lands in a tmpfs and vanishes with the run, so the host file is the check, not the exit code
@test "[ab]: write sibling a denied" {
  proj=$ab run blackwall sh -c 'echo x >> ../a'
  run -0 cat "$code/a"
  assert_output sentinel-a
}

@test "[ab]: list sibling b denied" {
  proj=$ab run ! blackwall ls ../b
  refute_output --partial sentinel
}

@test "[ab]: read sibling c denied" {
  proj=$ab run ! blackwall cat ../c/sentinel
  refute_output --partial sentinel-c
}

@test "**: read sibling secret denied" {
  proj=$stars run ! blackwall cat ../secret
  refute_output --partial sentinel-secret
}

@test "**: list parent denied" {
  proj=$stars run blackwall ls ..
  refute_output --partial secret
}

@test "**: write sibling secret denied" {
  proj=$stars run blackwall sh -c 'echo x >> ../secret'
  run -0 cat "$code/secret"
  assert_output sentinel-secret
}

@test "--add-dir [ab]: write in it" {
  run -0 blackwall --add-dir "$ab" sh -c 'echo x > "$1/g"' sh "$ab"
  assert [ -f "$ab/g" ]
}

@test "--add-dir [ab]: read sibling a denied" {
  run ! blackwall --add-dir "$ab" cat "$code/a"
  refute_output --partial sentinel-a
}

@test "--add-dir [ab]: write sibling a denied" {
  run blackwall --add-dir "$ab" sh -c 'echo x >> "$1"' sh "$code/a"
  run -0 cat "$code/a"
  assert_output sentinel-a
}

@test "--add-dir [ab]: list sibling b denied" {
  run ! blackwall --add-dir "$ab" ls "$code/b"
  refute_output --partial sentinel
}
