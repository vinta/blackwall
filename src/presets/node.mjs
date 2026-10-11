import { CACHE } from "../constants/paths.mjs";

export default {
  why: "npm can't write its default ~/.npm; npm fetches from the npm registry, and fnm keeps Node.js under ~/.local; Node's fetch and http ignore HTTPS_PROXY unless NODE_USE_ENV_PROXY is set, so they fail with ENOTFOUND for every host",
  env: {
    NPM_CONFIG_CACHE: `${CACHE}/npm`,
    NODE_USE_ENV_PROXY: "1",
  },
  network: {
    allowedDomains: ["registry.npmjs.org"],
  },
  filesystem: {
    allowRead: ["~/.local/share/fnm", "~/.local/state/fnm_multishells"],
  },
};
