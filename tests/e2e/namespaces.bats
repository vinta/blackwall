bats_require_minimum_version 1.5.0

setup_file() {
  load common

  prepare namespaces
}

setup() {
  load common
}

@test "user namespace refused (Linux)" {
  [ "$(uname)" = Linux ] || skip "Linux only"

  run ! blackwall unshare -r true
  assert_output --partial "Operation not permitted"
}

# Chromium, Electron, and Playwright register a name like this at launch and die on the refusal
@test "Mach bootstrap name registration refused (macOS)" {
  [ "$(uname)" = Darwin ] || skip "macOS only"

  cc -x c -o "$proj/checkin" - <<'C'
#include <servers/bootstrap.h>
#include <stdio.h>
#include <unistd.h>

int main(void) {
  char name[128];
  mach_port_t port;
  snprintf(name, sizeof name, "org.chromium.Chromium.MachPortRendezvousServer.%d", getpid());
  kern_return_t kr = bootstrap_check_in(bootstrap_port, name, &port);
  if (kr != KERN_SUCCESS) {
    printf("bootstrap_check_in %s: %s (%d)\n", name, bootstrap_strerror(kr), kr);
    return 1;
  }
  return 0;
}
C

  run -0 "$proj/checkin"
  run ! blackwall ./checkin
  assert_output --partial "Permission denied (1100)"
}
