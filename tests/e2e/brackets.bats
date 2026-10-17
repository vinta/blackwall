bats_require_minimum_version 1.5.0

# Brackets that spell a set ([wip]) and brackets that spell none ([user-id]) were two separate srt bugs
setup_file() {
  load common

  prepare brackets
  export wip="$work/[wip] app" user_id="$work/[user-id]"
  git init -q "$wip"
  git init -q "$user_id"
}

setup() {
  load common
}

@test "[wip] app: starts" {
  proj=$wip run -0 blackwall true
}

@test "[wip] app: write in cwd" {
  proj=$wip run -0 blackwall sh -c 'echo x > f'
  assert [ -f "$wip/f" ]
}

@test "[wip] app: write .git/hooks denied" {
  proj=$wip run ! blackwall sh -c 'echo x > .git/hooks/pre-commit'
  refute [ -e "$wip/.git/hooks/pre-commit" ]
}

@test "[user-id]: starts" {
  proj=$user_id run -0 blackwall true
}

@test "[user-id]: write in cwd" {
  proj=$user_id run -0 blackwall sh -c 'echo x > f'
  assert [ -f "$user_id/f" ]
}

@test "[user-id]: write .git/hooks denied" {
  proj=$user_id run ! blackwall sh -c 'echo x > .git/hooks/pre-commit'
  refute [ -e "$user_id/.git/hooks/pre-commit" ]
}
