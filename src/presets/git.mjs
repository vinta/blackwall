export default {
  why: "git reads your config and global ignore files; gpg can't reach ~/.gnupg under denyRead, so commits go unsigned",
  env: {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "commit.gpgsign",
    GIT_CONFIG_VALUE_0: "false",
  },
  filesystem: {
    allowRead: ["~/.config/git/config", "~/.config/git/ignore", "~/.gitconfig", "~/.gitignore_global"],
  },
};
