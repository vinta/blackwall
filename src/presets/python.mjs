export default {
  why: "pip and uv fetch from PyPI, and uv reads its config, Python installs, and tools under ~/.config and ~/.local",
  env: { UV_CACHE_DIR: "~/.cache/blackwall/uv" },
  network: { allowedDomains: ["pypi.org", "files.pythonhosted.org"] },
  filesystem: { allowRead: ["~/.config/uv/uv.toml", "~/.local/share/uv"] },
};
