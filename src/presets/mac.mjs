export default {
  why: "macOS tools read system paths, Homebrew, and the Command Line Tools",
  filesystem: {
    allowRead: [
      "/System",
      "/tmp",
      "/private/etc",
      "/private/var/run",
      "/private/var/select",
      "/private/var/db/timezone",
      "/opt/homebrew",
      "/Library/Developer/CommandLineTools",
    ],
  },
};
