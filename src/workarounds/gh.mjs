import { CACHE } from "../config.mjs";

export default {
  why: "gh exits on the unreadable ~/.config/gh instead of falling back to defaults",

  env() {
    return { GH_CONFIG_DIR: `${CACHE}/gh` };
  },
};
