# Each <scenario>/ folder holds <scenario>.bats beside the files it starts with, which prepare overlays on a copy of base/
# Run it from a plain shell: Seatbelt can't nest, so it fails inside a sandboxed session

# Sourced from setup_suite too, where no test file sets BATS_TEST_DIRNAME
e2e=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo=$(cd "$e2e/../.." && pwd)

export BATS_LIB_PATH=$repo/node_modules
bats_load_library bats-support
bats_load_library bats-assert

export E2E_ROOT=${E2E_ROOT:-$repo/tests/.e2e}

# Copies the fixtures to $E2E_ROOT/<scenario> and fills {{TOOL_GRANTS}} and {{WORK}}, which differ per machine
prepare() {
  export work=$E2E_ROOT/$1
  export home=$work/home proj=$work/proj added=$work/added elsewhere=$work/elsewhere

  rm -rf "$work" && mkdir -p "$proj" "$added" "$elsewhere"
  cp -R "$e2e/base/." "$work/"
  if [ -d "$e2e/$1" ]; then cp -R "$e2e/$1/." "$work/" && rm -f "$work/$1.bats"; fi

  local file
  grep -rlF '{{' "$work" | while read -r file; do
    sed -e "s#{{TOOL_GRANTS}}#$TOOL_GRANTS#g" -e "s#{{WORK}}#$work#g" "$file" >"$file.tmp" && mv "$file.tmp" "$file"
  done

  git -C "$proj" init -q
  git -C "$added" init -q
}

# Ubuntu runners set XDG_CONFIG_HOME to the real home, so git would read its config from outside the stub
blackwall() { (cd "$proj" && HOME=$home XDG_CONFIG_HOME=$home/.config node "$repo/src/blackwall.js" "$@"); }
