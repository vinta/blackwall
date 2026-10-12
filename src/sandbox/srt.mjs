import { SandboxManager, SandboxRuntimeConfigSchema } from "@anthropic-ai/sandbox-runtime";
import { spawn } from "node:child_process";
import { isIP } from "node:net";

import { CWD } from "../constants/paths.mjs";

export function createSandbox(config) {
  // srt rejects "*", so blackwall turns it into an ask callback that allows every DNS name no rule matches
  // IP literals and localhost stay denied: srt's resolved-address guard skips literals and lets localhost reach loopback
  const allowAllDomains = config.network.allowedDomains.includes("*");
  const srtConfig = {
    ...config,
    network: { ...config.network, allowedDomains: config.network.allowedDomains.filter((domain) => domain !== "*") },
  };
  SandboxRuntimeConfigSchema.parse(srtConfig);

  return {
    async printFileAccess() {
      // srt's view, not the config's: it adds its own write paths, and denies writes to these names in the cwd at any depth
      SandboxManager.updateConfig(srtConfig);
      const read = SandboxManager.getFsReadConfig();
      const write = SandboxManager.getFsWriteConfig();
      // Not in the package's index, but srt builds its mandatory write denies from these. Loaded only here, so an srt update that moves them breaks this flag, not every launch
      const { DANGEROUS_FILES, getDangerousDirectories } = await import("@anthropic-ai/sandbox-runtime/dist/sandbox/sandbox-utils.js");
      const mandatory = [...DANGEROUS_FILES, ...getDangerousDirectories(), ".git/hooks", ".git/config"].map((name) => `${CWD}/**/${name}`);
      for (const [title, paths] of [
        ["read allowed", read.allowWithinDeny],
        ["read denied", read.denyOnly],
        ["write allowed", write.allowOnly],
        ["write denied", [...write.denyWithinAllow, ...mandatory]],
      ]) {
        console.log(`${title}:`);
        for (const path of new Set(paths)) console.log(`  ${path}`);
      }
    },

    async run(args, env) {
      await SandboxManager.initialize(srtConfig, async ({ host }) => {
        const bare = host.replace(/^\[(.*)\]$/, "$1");
        // Spelled the way srt dials it, so 127.1 and 0 count as IPv4 literals and localhost.. as localhost
        const canonicalHost = (URL.parse(`http://${bare}`)?.hostname ?? bare).toLowerCase().replace(/\.+$/, "");
        return allowAllDomains && !isIP(canonicalHost) && canonicalHost !== "localhost" && !canonicalHost.endsWith(".localhost");
      });

      const quote = (arg) => `'${arg.replaceAll("'", `'\\''`)}'`;
      const command = await SandboxManager.wrapWithSandbox(args.map(quote).join(" "));
      const child = spawn(command, { shell: true, stdio: "inherit", env });

      // The terminal sends Ctrl+C to the child too; the launcher must outlive it to keep srt's proxy up
      process.on("SIGINT", () => {});
      process.on("SIGTERM", () => child.kill("SIGTERM"));
      child.on("exit", (code) => process.exit(code ?? 1));
    },
  };
}
