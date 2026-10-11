export default {
  why: "gh can't read or write its default ~/.config/gh; git, gh, and raw file downloads reach GitHub, and gh loads its extensions from ~/.local",
  env: {
    GH_CONFIG_DIR: "~/.cache/blackwall/gh",
  },
  network: {
    allowedDomains: ["github.com", "*.github.com", "*.githubusercontent.com"],
  },
  filesystem: {
    allowRead: ["~/.local/share/gh/extensions"],
  },
};
