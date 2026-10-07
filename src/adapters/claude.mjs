import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { copyShared } from "./shared.mjs";

const HOME = homedir();
const PROFILE = `${HOME}/.claude-blackwall`;

// Claude plugins don't need copying; it's safe to read them directly
const PLUGINS = `${HOME}/.claude/plugins`;

// Copied into the profile on every launch
const SHARED = ["CLAUDE.md", "rules", "skills", "agents", "commands", "output-styles"];

export default {
  config() {
    return {
      network: {
        allowedDomains: [
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
        allowRead: [PROFILE, PLUGINS],
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
    };
  },

  prepare() {
    const firstRun = !existsSync(PROFILE);
    mkdirSync(PROFILE, { recursive: true });

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
      console.warn(`blackwall: created ${PROFILE} as claude's config folder. Every launch copies ${SHARED.join(", ")} from ~/.claude into it, and plugins load from ~/.claude/plugins read-only`);
      console.warn(`blackwall: sessions, settings, and login stay apart from ~/.claude. Settings go in ${PROFILE}/settings.json${seeded ? ", which starts with your enabledPlugins" : ""}`);
    }

    copyShared(`${HOME}/.claude`, PROFILE, SHARED);
  },
};
