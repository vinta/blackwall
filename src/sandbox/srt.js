import { SandboxManager, SandboxRuntimeConfigSchema } from "@anthropic-ai/sandbox-runtime";
import { parseAddressRange } from "@anthropic-ai/sandbox-runtime/dist/sandbox/address.js";
import { matchesDomainPatternWithPort } from "@anthropic-ai/sandbox-runtime/dist/sandbox/domain-pattern.js";
import { canonicalizeHost } from "@anthropic-ai/sandbox-runtime/dist/sandbox/parent-proxy.js";
import { createResolvedAddressGuard } from "@anthropic-ai/sandbox-runtime/dist/sandbox/resolved-address-guard.js";
import { spawn } from "node:child_process";
import { isIP } from "node:net";

export function createSandbox(config) {
  // srt rejects "*", so blackwall turns it into an ask callback that allows every host no rule matches
  // deniedHosts names and IP literals are the callback's job: srt's deniedDomains would beat allowedHosts, and its resolved-address guard skips literals
  const { allowedHosts, deniedHosts, ...network } = config.network;
  const allowAllDomains = allowedHosts.includes("*");
  // srt matches allowedHosts names and literals itself; denied ranges it checks at dial time, for names only
  const { ranges: deniedRanges = [], names: deniedNames = [] } = Object.groupBy(deniedHosts, (entry) => (parseAddressRange(entry) ? "ranges" : "names"));
  const { srt, ...lists } = config;
  const srtConfig = {
    ...lists,
    // srt takes these keys top-level
    ...srt,
    network: {
      ...network,
      allowedDomains: allowedHosts.filter((host) => host !== "*"),
      deniedDomains: [],
      deniedResolvedAddresses: deniedRanges,
      strictAllowlist: !allowAllDomains,
    },
  };
  SandboxRuntimeConfigSchema.parse(srtConfig);

  // Without "*", strictAllowlist makes srt deny every host no rule matches, and it never asks
  let askCallback;
  if (allowAllDomains) {
    const guard = createResolvedAddressGuard(srtConfig.network);
    askCallback = async ({ host, port }) => {
      // The spelling srt matches its own lists against, so 127.1 and 0 count as IPv4 literals
      const canonicalHost = canonicalizeHost(host) ?? host;
      // canonicalizeHost strips one trailing dot, so a dot left means the raw host had an empty label: no resolver accepts it, but srt dials the one-dot spelling, which does resolve
      if (/\.$|\.\./.test(canonicalHost)) return { allow: false, reason: "host has an empty label" };
      if (deniedNames.some((pattern) => matchesDomainPatternWithPort(canonicalHost, port, pattern))) return { allow: false, reason: "host is on the deny list" };
      // A dummy non-IP hostname makes the guard judge the address as a resolved answer, the way it would for a name resolving there
      if (isIP(canonicalHost) && !guard.permits("literal", canonicalHost, port)) return { allow: false, reason: "host is an IP address in a refused range" };
      return true;
    };
  }

  return {
    srtConfig,
    deniedNames,

    async run(args, commandEnv, launcherEnv) {
      await SandboxManager.initialize(srtConfig, askCallback);
      // The terminal sends Ctrl+C to the child too, so the launcher must outlive it, and so must srt's proxy, whose SIGINT cleanup initialize() installs; srt's exit handler still cleans up when the child ends
      process.removeAllListeners("SIGINT");
      process.on("SIGINT", () => {});
      // initialize prints these only under SRT_DEBUG, yet one says a sandboxed command can rewrite srt, which runs unsandboxed next launch
      for (const warning of SandboxManager.checkDependencies().warnings) console.warn(`blackwall: ${warning}`);

      const quote = (arg) => `'${arg.replaceAll("'", `'\\''`)}'`;
      // env applies the command's env inside the sandbox, so the launcher's shell never sees it
      // -- keeps a command whose name starts with - from parsing as an env option
      // srt encodes commandId instead of the wrapped command into its violation tag and proxy username, so the env values stay out of both
      const command = await SandboxManager.wrapWithSandbox(["env", "--", ...Object.entries(commandEnv).map(([key, value]) => `${key}=${value}`), ...args].map(quote).join(" "), undefined, undefined, undefined, { commandId: args.map(quote).join(" ") });
      const child = spawn(command, { shell: true, stdio: "inherit", env: launcherEnv });

      process.on("SIGTERM", () => child.kill("SIGTERM"));
      child.on("exit", (code) => process.exit(code ?? 1));
    },
  };
}
