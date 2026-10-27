import { execFileSync } from "node:child_process";

import { HOME } from "../constants/paths.js";

// The plist, not `defaults read`, which ignores HOME; no plist or no location key means screencapture's default
function screenshotFolder() {
  try {
    return execFileSync("plutil", ["-extract", "location", "raw", "-o", "-", `${HOME}/Library/Preferences/com.apple.screencapture.plist`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return `${HOME}/Desktop`;
  }
}

export default {
  why: "a pasted screenshot reaches claude as its file path, and macOS saves screenshots to ~/Desktop unless `defaults write com.apple.screencapture location` moved them",
  // A getter, so only a launch that enables the preset runs plutil
  get filesystem() {
    return { allowRead: [screenshotFolder()] };
  },
};
