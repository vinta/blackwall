import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

const HOME = homedir();
const PROFILE = `${HOME}/.claude-blackwall`;
// Copied into the profile on every launch rather than linked, so a sandboxed run can change only its copies, never ~/.claude
const SHARED = ["CLAUDE.md", "rules", "skills", "agents", "commands", "output-styles"];

export default {
  presets: ["claude"],

  // Right after the command name, so a trailing `--` or prompt argument can't swallow them
  args([command, ...rest], { addDirs }) {
    return [command, ...addDirs.flatMap((dir) => ["--add-dir", dir]), ...rest];
  },

  env() {
    return {
      CLAUDE_CONFIG_DIR: PROFILE,
      // Claude loads the host's plugins in place without writing there, and forces their auto-update off
      CLAUDE_CODE_PLUGIN_SEED_DIR: `${HOME}/.claude/plugins`,
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

    for (const name of SHARED) {
      const source = `${HOME}/.claude/${name}`;
      if (!existsSync(source)) continue;
      // Removes a dotfile-manager link itself, never its target
      rmSync(`${PROFILE}/${name}`, { recursive: true, force: true });
      // -L resolves nested links too (cpSync's dereference doesn't), since their targets are unreadable in the sandbox; cp reports a dangling one and copies the rest
      spawnSync("cp", ["-RL", source, `${PROFILE}/${name}`], { stdio: "inherit" });
    }
  },
};
