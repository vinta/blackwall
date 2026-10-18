import { matchesDomainPatternWithPort, splitDomainPatternPort } from "@anthropic-ai/sandbox-runtime/dist/sandbox/domain-pattern.js";
import { localInterfaceAddresses } from "@anthropic-ai/sandbox-runtime/dist/sandbox/resolved-address-guard.js";
import { isIP } from "node:net";

export function printNetworkAccess(srtConfig, deniedNames) {
  const allowAll = !srtConfig.network.strictAllowlist;
  for (const [title, items] of [
    // Under "*", a listed host shows only where it reaches what "*" alone can't
    ["allowed hosts", allowAll ? ["*", ...srtConfig.network.allowedDomains.filter((entry) => beatsDeny(entry, deniedNames))] : srtConfig.network.allowedDomains],
    ["denied names", deniedNames],
    ["denied ranges", srtConfig.network.deniedResolvedAddresses],
    // srt doesn't export its class ranges, so name them instead of copying ranges that could drift
    ["srt refuses", ["loopback, unspecified, link-local, multicast, broadcast, cloud metadata", `this machine: ${[...new Set(localInterfaceAddresses())].join(", ")}`]],
    ...(allowAll ? [] : [["other hosts", ["refused"]]]),
  ]) {
    console.log(`${title}:`);
    for (const item of new Set(items)) console.log(`  ${item}`);
  }
}

// srt matches listed hosts before blackwall's "*" callback, so a listed IP literal skips the refused ranges and a listed name skips the denied names
function beatsDeny(entry, deniedNames) {
  const { hostPattern, port } = splitDomainPatternPort(entry);
  if (isIP(hostPattern)) return true;
  return deniedNames.some((denied) => {
    const { hostPattern: deniedPattern, port: deniedPort } = splitDomainPatternPort(denied);
    const sharedPort = port ?? deniedPort;
    // A wildcard stands in as one of its subdomains, checked both ways since either side may be the broader one
    return matchesDomainPatternWithPort(hostPattern.replace(/^\*\./, "x."), sharedPort, denied) || matchesDomainPatternWithPort(deniedPattern.replace(/^\*\./, "x."), sharedPort, entry);
  });
}
