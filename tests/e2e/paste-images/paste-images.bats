bats_require_minimum_version 1.5.0

setup_file() {
  load ../common

  prepare paste-images
  blackwall --trust >/dev/null
}

setup() {
  load ../common
}

@test "screenshots preset reads ~/Desktop" {
  run -0 blackwall cat "$home/Desktop/Screenshot.png"
  assert_output hunter2
}

@test "screenshots preset follows a moved screenshot folder" {
  mkdir -p "$home/Library/Preferences" "$home/Shots"
  plutil -create xml1 "$home/Library/Preferences/com.apple.screencapture.plist" || skip "needs plutil"
  plutil -insert location -string "$home/Shots" "$home/Library/Preferences/com.apple.screencapture.plist"
  echo hunter2 >"$home/Shots/Screenshot.png"

  run -0 blackwall cat "$home/Shots/Screenshot.png"
  assert_output hunter2
  run ! blackwall cat "$home/Desktop/Screenshot.png"
}
