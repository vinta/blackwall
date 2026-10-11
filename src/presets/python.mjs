import { CACHE } from "../constants/paths.mjs";

export default {
  why: "uv can't write its default ~/.cache/uv; pip and uv fetch from PyPI, and uv reads its config, Python installs, and tools",
  env: {
    UV_CACHE_DIR: `${CACHE}/uv`,
  },
  network: {
    allowedDomains: ["pypi.org", "files.pythonhosted.org"],
  },
  filesystem: {
    allowRead: ["~/.config/uv/uv.toml", "~/.local/share/uv"],
  },
};
