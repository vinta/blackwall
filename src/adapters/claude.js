import { existsSync, lstatSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { HOME, SKILLS, TMPDIR } from "../constants/paths.js";
import { copyShared, mkdirManaged } from "./shared.js";

const PROFILE = `${HOME}/.claude-blackwall`;

// Claude plugins don't need copying; it's safe to read them directly
const PLUGINS = `${HOME}/.claude/plugins`;

// The native installer links ~/.local/bin/claude into it
const VERSIONS = `${HOME}/.local/share/claude`;

// Copied into the profile on every launch
const SHARED = ["CLAUDE.md", "rules", "skills", "agents", "commands", "output-styles"];

export default {
  config() {
    return {
      network: {
        allowedHosts: [
          "api.anthropic.com",
          "bridge.claudeusercontent.com",
          "*.frame.claudeusercontent.com",
          "claude.ai",
          "claude.com",
          "code.claude.com",
          "downloads.claude.ai",
          "mcp-proxy.anthropic.com",
          "platform.claude.com",
        ],
      },
      filesystem: {
        allowRead: [PROFILE, PLUGINS, VERSIONS],
        allowWrite: [PROFILE],
      },
    };
  },

  // Right after the command name, so a trailing `--` or prompt argument can't swallow them
  args([command, ...rest], { addDirs }) {
    return [command, ...addDirs.flatMap((dir) => ["--add-dir", dir]), ...rest];
  },

  env() {
    return {
      CLAUDE_CONFIG_DIR: PROFILE,
      // Claude loads the host's plugins in place without writing there, and forces their auto-update off
      CLAUDE_CODE_PLUGIN_SEED_DIR: PLUGINS,
      // Claude Code's own temp folder, /tmp/claude-<uid> by default, isn't writable in the sandbox
      CLAUDE_CODE_TMPDIR: TMPDIR,
    };
  },

  prepare() {
    const firstRun = !existsSync(PROFILE);
    mkdirManaged(PROFILE);

    // Seeded once, then the user's: seed plugins load only when enabled, while the host's other settings (hooks, permissions) assume no sandbox
    let seeded = false;
    if (!existsSync(`${PROFILE}/settings.json`)) {
      try {
        const { enabledPlugins } = JSON.parse(readFileSync(`${HOME}/.claude/settings.json`, "utf8"));
        if (enabledPlugins) {
          // wx refuses a dangling dotfile-manager link instead of writing to its target
          writeFileSync(`${PROFILE}/settings.json`, `${JSON.stringify({ enabledPlugins }, null, 2)}\n`, { flag: "wx" });
          seeded = true;
        }
      } catch (error) {
        if (error.code !== "ENOENT" && error.code !== "EEXIST") throw error;
      }
    }

    if (firstRun) {
      console.warn(`blackwall: created ${PROFILE} as claude's config folder. Every launch copies ${SHARED.join(", ")} from ~/.claude and blackwall's own skill into it, and plugins load from ~/.claude/plugins read-only`);
      console.warn(`blackwall: sessions, settings, and login stay apart from ~/.claude. Settings go in ${PROFILE}/settings.json${seeded ? ", which starts with your enabledPlugins" : ""}`);
    }

    copyShared(`${HOME}/.claude`, PROFILE, SHARED);
    copyShared(SKILLS, `${PROFILE}/skills`, ["blackwall"]);

    // Claude records each enabled plugin once, pointing at the profile's own cache, which never exists, and never refreshes it, so re-apply the host's record every launch
    // Entries only in the profile are plugins installed inside the sandbox
    let host;
    try {
      host = JSON.parse(readFileSync(`${PLUGINS}/installed_plugins.json`, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    mkdirManaged(`${PROFILE}/plugins`);
    const record = `${PROFILE}/plugins/installed_plugins.json`;
    // A sandboxed run can link the record to a host file, to read it back or have it overwritten
    if (lstatSync(record, { throwIfNoEntry: false })?.isSymbolicLink()) rmSync(record);
    let profile;
    try {
      profile = JSON.parse(readFileSync(record, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      profile = { ...host, plugins: {} };
    }
    profile.plugins = { ...profile.plugins, ...host.plugins };
    writeFileSync(record, `${JSON.stringify(profile, null, 2)}\n`);
  },
};
