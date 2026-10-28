import { SandboxManager, SandboxRuntimeConfigSchema } from "@anthropic-ai/sandbox-runtime";
import { parseAddressRange } from "@anthropic-ai/sandbox-runtime/dist/sandbox/address.js";
import { matchesDomainPatternWithPort } from "@anthropic-ai/sandbox-runtime/dist/sandbox/domain-pattern.js";
import { canonicalizeHost } from "@anthropic-ai/sandbox-runtime/dist/sandbox/parent-proxy.js";
import { createResolvedAddressGuard } from "@anthropic-ai/sandbox-runtime/dist/sandbox/resolved-address-guard.js";
import { spawn } from "node:child_process";
import { isIP } from "node:net";

// Single quotes, so the shell expands nothing inside: not $, not backticks, not newlines
const quote = (arg) => `'${arg.replaceAll("'", `'\\''`)}'`;

// The command's env rides a pipe the sandboxed shell reads as this fd: the launcher's own shell never sees it, and the values stay out of argv, ps, and srt's log tag
const ENV_FD = 3;

// What the sandboxed shell runs before the command, joined with && so a failed read stops the chain and the command never runs without its env
function applyEnvThenExec(quotedCommand) {
  return [
    // cat on the already open fd, not `. /dev/fd/3`: Linux can't open Node's socketpair through /dev/fd, and bash 3.2 cuts a sourced /dev/fd stream off near 64 KB
    `blackwall_env=$(cat <&${ENV_FD})`,
    `eval "$blackwall_env"`,
    // Its own step: bash 3.2 turns `cmd 3<&-` into a move to fd 10 instead of a close
    `exec ${ENV_FD}<&-`,
    `exec -- ${quotedCommand}`,
  ].join(" && ");
}

// One export per variable, in the shape eval applies
function exportLines(env) {
  return Object.entries(env)
    .map(([key, value]) => `export ${key}=${quote(value)}\n`)
    .join("");
}

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

    async run(args, commandEnv, launcherEnv, shellLines) {
      await SandboxManager.initialize(srtConfig, askCallback);
      // The terminal sends Ctrl+C to the child too, so the launcher must outlive it, and so must srt's proxy, whose SIGINT cleanup initialize() installs; srt's exit handler still cleans up when the child ends
      process.removeAllListeners("SIGINT");
      process.on("SIGINT", () => {});
      // initialize prints these only under SRT_DEBUG, yet one says a sandboxed command can rewrite srt, which runs unsandboxed next launch
      for (const warning of SandboxManager.checkDependencies().warnings) console.warn(`blackwall: ${warning}`);

      const command = await SandboxManager.wrapWithSandbox(applyEnvThenExec(args.map(quote).join(" ")));
      const stdio = ["inherit", "inherit", "inherit"];
      stdio[ENV_FD] = "pipe";
      const child = spawn(command, { shell: true, stdio, env: launcherEnv });

      const envPipe = child.stdio[ENV_FD];
      // EPIPE if the shell exits before reading
      envPipe.on("error", () => {});
      // After the exports, so a line can read srt's vars, like HTTPS_PROXY, which only the sandboxed shell has
      envPipe.end(exportLines(commandEnv) + shellLines.map((line) => `${line}\n`).join(""));

      process.on("SIGTERM", () => child.kill("SIGTERM"));
      child.on("exit", (code) => process.exit(code ?? 1));
    },
  };
}
