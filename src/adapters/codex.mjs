import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { copyShared } from "./shared.mjs";

const HOME = homedir();
const PROFILE = `${HOME}/.codex-blackwall`;
// Copied into the profile on every launch
const SHARED = ["AGENTS.md", "agents", "rules"];

export default {
  config() {
    return {
      network: { allowedDomains: ["api.openai.com", "auth.openai.com", "chatgpt.com"] },
      filesystem: { allowRead: [PROFILE, `${HOME}/.codex/packages`], allowWrite: [PROFILE] },
    };
  },

  // Codex's own Seatbelt can't start inside srt's (sandbox_apply: Operation not permitted), so blackwall is the only sandbox
  args([command, ...rest]) {
    return [command, "-c", 'sandbox_mode="danger-full-access"', ...rest];
  },

  env() {
    return { CODEX_HOME: PROFILE };
  },

  prepare() {
    const firstRun = !existsSync(PROFILE);
    mkdirSync(PROFILE, { recursive: true });

    if (firstRun) {
      console.warn(`blackwall: created ${PROFILE} as codex's config folder. Every launch copies ${SHARED.join(", ")} from ~/.codex and skills from ~/.agents into it`);
      console.warn(`blackwall: sessions, config.toml, and login stay apart from ~/.codex. Log in with \`blackwall codex login --device-auth\``);
    }

    copyShared(`${HOME}/.codex`, PROFILE, SHARED);
    copyShared(`${HOME}/.agents`, PROFILE, ["skills"]);
  },
};
