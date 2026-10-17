import { SANDBOX_CACHE, XDG_DATA, XDG_RUNTIME, XDG_STATE } from "../constants/paths.js";

export default {
  why: "npm can't write its default ~/.npm; npm fetches from the npm registry, and fnm keeps Node.js under ~/.local; Node's fetch and http ignore HTTPS_PROXY unless NODE_USE_ENV_PROXY is set, so they fail with ENOTFOUND for every host",
  env: {
    NPM_CONFIG_CACHE: `${SANDBOX_CACHE}/npm`,
    NODE_USE_ENV_PROXY: "1",
  },
  network: {
    allowedHosts: ["registry.npmjs.org"],
  },
  filesystem: {
    // fnm keeps its per-shell links in the runtime folder when there is one
    allowRead: [`${XDG_DATA}/fnm`, `${XDG_RUNTIME ?? XDG_STATE}/fnm_multishells`],
  },
};
