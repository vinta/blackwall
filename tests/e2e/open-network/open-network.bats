bats_require_minimum_version 1.5.0

setup_file() {
  load ../common

  prepare open-network
  blackwall --trust >/dev/null

  read -r port listener < <(node -e 'const server = require("http").createServer((q, s) => s.end("ok")).listen(0, "127.0.0.1", () => console.log(server.address().port, process.pid))')
  export port listener
}

# The listener holds bats' fd 3, so the run hangs until it exits
teardown_file() {
  kill "$listener"
}

setup() {
  load ../common
}

# srt's NO_PROXY sends loopback around the proxy, so curl clears it
http_code() { blackwall sh -c 'curl -sS -o /dev/null --max-time 10 --noproxy "" --proxy "$HTTP_PROXY" -w "%{http_code}" "$1"' sh "$1"; }

allow_listener() {
  printf '{"network":{"allowedHosts":["*","127.0.0.1:%s","localhost:%s"]}}\n' "$port" "$port" >"$proj/.blackwall/config.json"
  blackwall --trust >/dev/null
}

@test "127.0.0.1 blocked under *" {
  assert_equal "$(http_code "http://127.0.0.1:$port/")" 403
}

@test "localhost blocked under *" {
  assert_equal "$(http_code "http://localhost:$port/")" 403
}

@test "foo.localhost blocked under *" {
  assert_equal "$(http_code "http://foo.localhost:$port/")" 403
}

@test "localhost.. blocked under *" {
  assert_equal "$(http_code "http://localhost..:$port/")" 403
}

@test "foo.localhost.. blocked under *" {
  assert_equal "$(http_code "http://foo.localhost..:$port/")" 403
}

@test "[::1] blocked under *" {
  assert_equal "$(http_code "http://[::1]:$port/")" 403
}

@test "169.254.169.254 blocked under *" {
  assert_equal "$(http_code http://169.254.169.254/)" 403
}

@test "0.0.0.0 blocked under *" {
  assert_equal "$(http_code "http://0.0.0.0:$port/")" 403
}

@test "localhost refusal says why under *" {
  run ! blackwall sh -c 'curl -sSv -o /dev/null --max-time 10 --noproxy "" --proxy "$HTTP_PROXY" "$1"' sh "https://localhost:$port/"
  assert_output --partial "403 host is on the deny list"
}

@test "127.0.0.1 refusal says why under *" {
  run ! blackwall sh -c 'curl -sSv -o /dev/null --max-time 10 --noproxy "" --proxy "$HTTP_PROXY" "$1"' sh "https://127.0.0.1:$port/"
  assert_output --partial "403 host is an IP address in a refused range"
}

@test "localhost.. refusal says why under *" {
  run ! blackwall sh -c 'curl -sSv -o /dev/null --max-time 10 --noproxy "" --proxy "$HTTP_PROXY" "$1"' sh "https://localhost..:$port/"
  assert_output --partial "403 host has an empty label"
}

@test "public host allowed under *" {
  assert_equal "$(http_code https://example.com/)" 200
}

# 1.1.1.1 may answer 200 or 301; only the proxy's 403 matters
@test "public IP literal allowed under *" {
  assert_not_equal "$(http_code https://1.1.1.1/)" 403
}

@test "--print-network-access shows * without the hosts it covers" {
  run -0 blackwall --print-network-access
  assert_line --index 1 "  *"
  refute_line "  github.com"
}

@test "listed IP literal allowed under *" {
  allow_listener

  assert_equal "$(http_code "http://127.0.0.1:$port/")" 200
}

@test "listed localhost port allowed under *" {
  allow_listener

  assert_equal "$(http_code "http://localhost:$port/")" 200
}

@test "--print-network-access keeps listed hosts that beat a deny under *" {
  allow_listener

  run -0 blackwall --print-network-access
  assert_line "  127.0.0.1:$port"
  assert_line "  localhost:$port"
}
