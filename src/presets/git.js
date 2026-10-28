import { XDG_CONFIG } from "../constants/paths.js";

export default {
  why: "git reads your config and global ignore files; gpg can't reach ~/.gnupg under denyRead, so commits go unsigned; srt denies .git/hooks and .git/config only beneath the current folder, at any depth, so they are listed here for --add-dir folders; git saves srt's proxy login through every credential helper after each transfer, so the proxy URL gets an empty helper list",
  env: {
    GIT_CONFIG_COUNT: "2",
    GIT_CONFIG_KEY_0: "commit.gpgsign",
    GIT_CONFIG_VALUE_0: "false",
    GIT_CONFIG_VALUE_1: "",
  },
  // srt picks the proxy port at launch, so only the sandboxed shell knows it
  shell: ['export GIT_CONFIG_KEY_1="credential.http://localhost:${HTTPS_PROXY##*:}.helper"'],
  filesystem: {
    allowRead: [`${XDG_CONFIG}/git/config`, `${XDG_CONFIG}/git/ignore`, "~/.gitconfig", "~/.gitignore_global"],
    // relative, so they apply to the current folder and every --add-dir folder
    denyWrite: [".git/hooks", ".git/config"],
  },
};
