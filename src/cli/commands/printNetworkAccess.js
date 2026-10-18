import { addRange, addressInSet, LOOPBACK_RANGES } from "@anthropic-ai/sandbox-runtime/dist/sandbox/address.js";
import { matchesDomainPatternWithPort, splitDomainPatternPort } from "@anthropic-ai/sandbox-runtime/dist/sandbox/domain-pattern.js";
import { localInterfaceAddresses } from "@anthropic-ai/sandbox-runtime/dist/sandbox/resolved-address-guard.js";
import { BlockList, isIP } from "node:net";

// srt doesn't export its refused classes, so the rest are copied from its resolved-address-guard.js; tests/config.js checks srt still refuses each
export const SRT_REFUSED_CLASSES = {
  loopback: LOOPBACK_RANGES,
  unspecified: ["0.0.0.0/8", "::"],
  "link-local": ["169.254.0.0/16", "fe80::/10"],
  multicast: ["224.0.0.0/4", "ff00::/8"],
  broadcast: ["255.255.255.255"],
  "cloud metadata": ["100.100.100.200", "168.63.129.16", "192.0.0.192", "fd00:ec2::/32", "fd20:ce::254", "fd00:c1::a9fe:a9fe", "fd00:42::42", "fd00:a9fe:a9fe::1", "fd00:100::100:200"],
};

// So this machine's addresses that a class already covers, like 127.0.0.1, aren't listed twice
const IN_REFUSED_CLASS = new BlockList();
for (const range of Object.values(SRT_REFUSED_CLASSES).flat()) addRange(IN_REFUSED_CLASS, range);

export function printNetworkAccess(srtConfig, deniedNames) {
  const allowAll = !srtConfig.network.strictAllowlist;
  const ownAddresses = [...new Set(localInterfaceAddresses())].filter((address) => !addressInSet(IN_REFUSED_CLASS, address));
  const refused = [...Object.entries(SRT_REFUSED_CLASSES), ["this machine", ownAddresses]].flatMap(([name, ranges]) => [`${name}:`, ...ranges.map((range) => `  ${range}`)]);
  for (const [title, items] of [
    // Under "*", a listed host shows only where it reaches what "*" alone can't
    ["allowed hosts", allowAll ? ["*", ...srtConfig.network.allowedDomains.filter((entry) => beatsDeny(entry, deniedNames))] : srtConfig.network.allowedDomains],
    ["denied names", deniedNames],
    ["denied ranges", srtConfig.network.deniedResolvedAddresses],
    ["srt refuses", refused],
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
