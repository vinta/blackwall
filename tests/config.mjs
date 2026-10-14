import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseAddressRange } from "@anthropic-ai/sandbox-runtime/dist/sandbox/address.js";
import { matchesDomainPatternWithPort, splitDomainPatternPort } from "@anthropic-ai/sandbox-runtime/dist/sandbox/domain-pattern.js";
import { canonicalizeHost } from "@anthropic-ai/sandbox-runtime/dist/sandbox/parent-proxy.js";
import { createResolvedAddressGuard, localInterfaceAddresses } from "@anthropic-ai/sandbox-runtime/dist/sandbox/resolved-address-guard.js";
import { PRESETS } from "../src/config/config.mjs";
import { CONFIG_SCHEMA, configErrorMap } from "../src/config/schema.mjs";

// Guards srt's zod internals (innerType, shape, element) that the schema reaches into, on each srt bump
const parse = (config) => CONFIG_SCHEMA.safeParse(config, { errorMap: configErrorMap });
const accepts = (config) => assert.ok(parse(config).success, JSON.stringify(config));
const rejects = (config, message) => {
  const result = parse(config);
  assert.ok(!result.success, JSON.stringify(config));
  if (message) assert.match(result.error.issues[0].message, message);
};

// Guards the srt dist/ internals that src/ imports at launch, outside srt's public index
for (const fn of [parseAddressRange, matchesDomainPatternWithPort, splitDomainPatternPort, canonicalizeHost, createResolvedAddressGuard, localInterfaceAddresses]) {
  assert.equal(typeof fn, "function");
}

const defaults = JSON.parse(readFileSync(new URL("../src/config/default-config.json", import.meta.url), "utf8"));
const { srt, ...lists } = defaults;
accepts({ srt, overrideDefaults: lists });

accepts({ network: { allowedHosts: ["*", "github.com"] } });
rejects({ network: { allowedHosts: ["*:22"] } });

for (const host of ["*", "*:22", "1.2.3.4:443", "[::1]"]) rejects({ network: { deniedHosts: [host] } });
accepts({ network: { deniedHosts: ["10.0.0.0/8", "1.2.3.4", "localhost", "*.corp.internal"] } });
rejects({ network: { deniedHosts: ["10.0.0.0/33"] } }, /CIDR/);
accepts({ network: { deniedHosts: ["*.localhost", "*.test", "LOCALHOST", "example.com:8080", "_dmarc.example.com"] } });
for (const host of ["example.com:0", "example.com:99999", "exa mple.com", "*.localhost:", ".com", "localhost."]) {
  rejects({ network: { deniedHosts: [host] } }, /must be a name like/);
}

for (const [host, canonical] of [
  ["127.1", "127.0.0.1"],
  ["0x7f000001", "127.0.0.1"],
  ["2130706433", "127.0.0.1"],
  ["0177.0.0.1", "127.0.0.1"],
  ["192.168.1", "192.168.0.1"],
  ["0", "0.0.0.0"],
  ["127.1:80", "127.0.0.1"],
]) {
  rejects({ network: { deniedHosts: [host] } }, new RegExp(`write it as ${canonical.replaceAll(".", "\\.")}$`));
}

for (const key of ["denyRead", "allowRead", "allowWrite", "denyWrite"]) {
  const [issue] = parse({ filesystem: { [key]: [{ path: "x", literal: true }] } }).error.issues;
  assert.equal(issue.path.join("."), `filesystem.${key}.0`);
}

rejects({ allowPty: false }, /^allowPty can only be set under srt$/);
rejects({ overrideDefaults: { allowPty: false } }, /^overrideDefaults\.allowPty can only be set under srt$/);
rejects({ overrideDefaults: { srt: {} } }, /^srt can only be set at the top level$/);
accepts({ srt: { allowPty: false } });
rejects({ srt: { allowAppleEvents: true } }, /^unknown key srt\.allowAppleEvents$/);
rejects({ network: { allowLocalBinding: true } }, /^unknown key network\.allowLocalBinding$/);
rejects({ network: { allowedHots: [] } }, /^unknown key network\.allowedHots$/);

// Presets are merged without passing the file schema, so a preset-only entry like *.localhost or a typo would otherwise go unchecked
for (const { network, filesystem } of Object.values(PRESETS)) accepts({ network, filesystem });

console.log("config: ok");
