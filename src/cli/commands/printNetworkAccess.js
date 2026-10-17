import { localInterfaceAddresses } from "@anthropic-ai/sandbox-runtime/dist/sandbox/resolved-address-guard.js";

export function printNetworkAccess(srtConfig, deniedNames) {
  for (const [title, items] of [
    ["allowed hosts", srtConfig.network.allowedDomains],
    ["denied names", deniedNames],
    ["denied ranges", srtConfig.network.deniedResolvedAddresses],
    // srt doesn't export its class ranges, so name them instead of copying ranges that could drift
    ["srt refuses", ["loopback, unspecified, link-local, multicast, broadcast, cloud metadata", `this machine: ${[...new Set(localInterfaceAddresses())].join(", ")}`]],
    ["other hosts", [srtConfig.network.strictAllowlist ? "refused" : "allowed"]],
  ]) {
    console.log(`${title}:`);
    for (const item of new Set(items)) console.log(`  ${item}`);
  }
}
