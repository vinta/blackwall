bats_require_minimum_version 1.5.0

setup_file() {
  load common

  prepare network
}

setup() {
  load common

  # fnm's PATH entry is a link under the real ~/.local/state, which the stub HOME doesn't grant
  node=$(realpath "$(command -v node)")
}

@test "preset host allowed" {
  run -0 blackwall curl -sS -o /dev/null --max-time 20 https://api.github.com
}

@test "other host blocked" {
  run ! blackwall curl -sSv -o /dev/null --max-time 20 https://example.com
  assert_output --partial "response 403"
  assert_output --partial "403 host is not on the allow list"
}

@test "--allow-internet allows other host" {
  run -0 blackwall --allow-internet curl -sS -o /dev/null --max-time 20 https://example.com
}

# srt's NO_PROXY sends loopback around the proxy, so curl clears it
@test "--allow-internet keeps localhost blocked" {
  run ! blackwall --allow-internet sh -c 'curl -sSv -o /dev/null --max-time 10 --noproxy "" --proxy "$HTTP_PROXY" https://localhost:8000/'
  assert_output --partial "403 host is on the deny list"
}

@test "--allow-internet keeps host resolving into RFC 1918 blocked" {
  run ! blackwall --allow-internet curl -sSv -o /dev/null --max-time 20 https://10.0.0.1.sslip.io
  assert_output --partial "403 resolved to a listed address"
}

@test "host resolving into RFC 1918 blocked" {
  run ! blackwall curl -sSv -o /dev/null --max-time 20 https://10.0.0.1.sslip.io
  assert_output --partial "response 403"
  assert_output --partial "403 resolved to a listed address"
}

@test "node fetch reaches preset host" {
  run -0 blackwall "$node" -e 'fetch("https://api.github.com")'
}

@test "node fetch to other host blocked" {
  run -0 blackwall "$node" -e 'fetch("https://example.com").catch((e) => console.log(e.cause.message))'
  assert_output --partial "Request was cancelled"
}

@test "gh runs" {
  run -0 blackwall gh --version
}

# A command that handles Ctrl+C itself keeps running, so srt's proxy must outlive the signal
@test "network survives SIGINT the command handles" {
  # exec makes node the subshell itself, so $! is blackwall's PID
  (cd "$proj" && HOME=$home XDG_CONFIG_HOME=$home/.config exec node "$repo/src/blackwall.js" sh -c '
    trap "" INT
    echo "$HTTPS_PROXY" >proxy
    touch ready
    i=0
    while [ ! -e go ] && [ $i -lt 200 ]; do sleep 0.1; i=$((i + 1)); done
    curl -sS -o /dev/null --max-time 20 https://api.github.com
    echo $? >result
  ') &
  pid=$!

  for _ in $(seq 200); do
    if [ -e "$proj/ready" ]; then break; fi
    sleep 0.1
  done
  kill -INT "$pid"
  sleep 0.5
  touch "$proj/go"
  wait "$pid"

  run -0 cat "$proj/result"
  assert_output 0

  # On Linux the child's proxy port belongs to the relay inside its network namespace, so this probe checks the proxy is gone on macOS only
  proxy=$(cat "$proj/proxy")
  port=${proxy##*:}
  run ! nc -z -w 1 127.0.0.1 "${port%/}"
}
