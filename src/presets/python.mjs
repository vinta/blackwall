import { SANDBOX_CACHE, XDG_CONFIG, XDG_DATA } from "../constants/paths.mjs";

export default {
  why: "uv can't write its default ~/.cache/uv; pip and uv fetch from PyPI, and uv reads its config, Python installs, and tools",
  env: {
    UV_CACHE_DIR: `${SANDBOX_CACHE}/uv`,
  },
  network: {
    allowedHosts: ["pypi.org", "files.pythonhosted.org"],
  },
  filesystem: {
    allowRead: [`${XDG_CONFIG}/uv/uv.toml`, `${XDG_DATA}/uv`],
  },
};
