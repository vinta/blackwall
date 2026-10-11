import { XDG_CONFIG } from "../constants/paths.mjs";

export default {
  why: "git reads your config and global ignore files; gpg can't reach ~/.gnupg under denyRead, so commits go unsigned",
  env: {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "commit.gpgsign",
    GIT_CONFIG_VALUE_0: "false",
  },
  filesystem: {
    allowRead: [`${XDG_CONFIG}/git/config`, `${XDG_CONFIG}/git/ignore`, "~/.gitconfig", "~/.gitignore_global"],
  },
};
