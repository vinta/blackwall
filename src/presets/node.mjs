export default {
  why: "npm fetches from the npm registry, and fnm keeps Node.js under ~/.local",
  env: {
    NPM_CONFIG_CACHE: "~/.cache/blackwall/npm",
  },
  network: {
    allowedDomains: ["registry.npmjs.org"],
  },
  filesystem: {
    allowRead: ["~/.local/share/fnm", "~/.local/state/fnm_multishells"],
  },
};
