import { SandboxManager } from "@anthropic-ai/sandbox-runtime";

import { CWD, HOME } from "../../constants/paths.js";

export async function printFileAccess(srtConfig) {
  // srt's view, not the config's: it adds its own write paths, and denies writes to these names in the cwd at any depth
  SandboxManager.updateConfig(srtConfig);

  const read = SandboxManager.getFsReadConfig();
  const write = SandboxManager.getFsWriteConfig();

  // Not in the package's index, but srt builds its mandatory write denies from these. tests/config.js checks the dist imports on the launch path; this one stays lazy since only --print-file-access needs it
  const { DANGEROUS_FILES, getDangerousDirectories } = await import("@anthropic-ai/sandbox-runtime/dist/sandbox/sandbox-utils.js");
  const mandatory = [...DANGEROUS_FILES, ...getDangerousDirectories(), ".git/hooks", ".git/config"].map((name) => `${CWD}/**/${name}`);

  for (const [title, paths] of [
    ["read allowed", [...read.allowWithinDeny, ...(read.literalAllowWithinDeny ?? [])]],
    ["read denied", read.denyOnly],
    ["write allowed", [...write.allowOnly, ...(write.literalAllowOnly ?? [])]],
    ["write denied", [...write.denyWithinAllow, ...mandatory]],
  ]) {
    console.log(`${title}:`);
    // srt expands ~ itself, so expanding it here sorts each path beside its siblings
    const expanded = paths.map((path) => path.replace(/^~(?=\/|$)/, HOME));
    for (const path of [...new Set(expanded)].sort((a, b) => a.localeCompare(b))) console.log(`  ${path}`);
  }
}
