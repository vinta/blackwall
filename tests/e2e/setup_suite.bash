setup_suite() {
  source "$(dirname "${BASH_SOURCE[0]}")/common.bash"
  # /tmp is writable inside the sandbox, so a stub HOME there would pass the deny checks for the wrong reason
  case $(mkdir -p "$E2E_ROOT" && cd "$E2E_ROOT" && pwd -P) in
    /tmp* | /private/tmp* | /var/folders* | /private/var/folders*) echo "e2e: E2E_ROOT must be outside /tmp and /var/folders" >&2; return 1 ;;
  esac
  # setup-node and the claude and codex installers put them outside every default grant. Seatbelt checks a link and its target separately, so grant both the PATH entry's folder and the install folder
  grants() { local path; path=$(command -v "$1"); printf '"%s","%s"' "$(dirname "$path")" "$(dirname "$(dirname "$(realpath "$path")")")"; }
  # The codex adapter's ~/.codex/packages, where Codex's standalone installer links through a `current` folder, points into the stub HOME here
  TOOL_GRANTS="$(grants node),$(grants claude),$(grants codex),\"$HOME/.codex/packages\""
  export TOOL_GRANTS
  # Every deny check passes when the sandbox can't start at all, so stop here if it can't
  prepare suite
  blackwall true || { echo "e2e: the sandbox doesn't start" >&2; return 1; }
}
