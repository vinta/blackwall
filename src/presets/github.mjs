import { SANDBOX_CACHE, XDG_DATA } from "../constants/paths.mjs";

export default {
  why: "gh can't read or write its default ~/.config/gh; git, gh, and raw file downloads reach GitHub, and gh loads its extensions from ~/.local",
  env: {
    GH_CONFIG_DIR: `${SANDBOX_CACHE}/gh`,
  },
  network: {
    allowedHosts: ["github.com", "*.github.com", "*.githubusercontent.com"],
  },
  filesystem: {
    allowRead: [`${XDG_DATA}/gh/extensions`],
  },
};
