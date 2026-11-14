export default {
  why: "brew answers `--prefix <formula>` and `--cellar <formula>` from its API cache's formula list without Ruby; when it can't read the list, it falls back to Ruby, which writes outside every grant and fails",
  // A getter, so a HOMEBREW_CACHE set in ~/.blackwall/.env counts: it loads after this module
  get filesystem() {
    return { allowRead: [`${process.env.HOMEBREW_CACHE || "~/Library/Caches/Homebrew"}/api`] };
  },
};
