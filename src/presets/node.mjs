import { CACHE } from "../constants/paths.mjs";

export default {
  why: "npm can't write its default ~/.npm; npm fetches from the npm registry, and fnm keeps Node.js under ~/.local",
  env: {
    NPM_CONFIG_CACHE: `${CACHE}/npm`,
  },
  network: {
    allowedDomains: ["registry.npmjs.org"],
  },
  filesystem: {
    allowRead: ["~/.local/share/fnm", "~/.local/state/fnm_multishells"],
  },
};
