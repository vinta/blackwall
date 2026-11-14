export default {
  why: "brew answers `--prefix <formula>` and `--cellar <formula>` from its API cache's formula list without Ruby; when it can't read the list, it falls back to Ruby, which writes outside every grant and fails",
  filesystem: {
    allowRead: [`${process.env.HOMEBREW_CACHE || "~/Library/Caches/Homebrew"}/api`],
  },
};
