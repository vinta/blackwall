import { readFileSync } from "node:fs";
import { isIP } from "node:net";

import { NetworkConfigSchema, SandboxRuntimeConfigSchema } from "@anthropic-ai/sandbox-runtime";
import { splitDomainPatternPort } from "@anthropic-ai/sandbox-runtime/dist/sandbox/domain-pattern.js";
import { canonicalizeHost } from "@anthropic-ai/sandbox-runtime/dist/sandbox/parent-proxy.js";
import { z } from "zod/v3";

export const DEFAULTS = JSON.parse(readFileSync(new URL("./default-config.json", import.meta.url), "utf8"));

// srt's top-level schema is a zod 3 ZodEffects; innerType() reaches the object
const SRT = SandboxRuntimeConfigSchema.innerType();
const RANGE = NetworkConfigSchema.shape.deniedResolvedAddresses.unwrap().element;

// srt rejects "*", but blackwall handles it before srt sees the list
const allowedHost = z.union([z.literal("*"), NetworkConfigSchema.shape.allowedDomains.element]);

// No trailing dot: srt's canonicalizeHost strips it from the destination, so such a pattern would never match
const NAME = /^(\*\.)?[a-z0-9_-]+(\.[a-z0-9_-]+)*$/i;

// Not srt's deniedDomains element: its broadness rule (no *.localhost) guards lists srt matches, and blackwall matches deniedHosts names itself
// A zod 3 union reports the first branch that fails a refine, so the range check would hide the name message
const deniedHost = z.string().superRefine((value, ctx) => {
  const range = RANGE.safeParse(value);
  if (range.success) return;
  const { hostPattern } = splitDomainPatternPort(value);
  // srt matches the canonical spelling, so a name like 127.1 or 2130706433 would never match a request
  const canonical = canonicalizeHost(hostPattern) ?? "";
  // No domain pattern has a "/", so a value with one gets the range message; a pasted URL gets it too
  const message = value.includes("/")
    ? range.error.issues[0].message
    : hostPattern === "*"
      ? `"${value}" is not allowed, since every host not in allowedHosts is already denied`
      : isIP(hostPattern)
        ? `"${value}" must be a bare IP address or CIDR, without a port or brackets`
        : isIP(canonical)
          ? `"${value}" is the IP address ${canonical}; write it as ${canonical}`
          : NAME.test(hostPattern)
            ? undefined
            : `"${value}" must be a name like example.com or *.example.com, with an optional :port, an IP address, or a CIDR range`;
  if (message) ctx.addIssue({ code: "custom", message });
});

const paths = z.array(z.string().min(1));

const LISTS = z
  .object({
    network: z
      .object({ allowedHosts: z.array(allowedHost), deniedHosts: z.array(deniedHost) })
      .partial()
      .strict(),
    // Not srt's element, which also takes { path, literal } objects that buildConfig would treat as strings
    filesystem: z
      .object(Object.fromEntries(Object.keys(DEFAULTS.filesystem).map((key) => [key, paths])))
      .partial()
      .strict(),
    presets: z.array(z.string()),
  })
  .partial()
  .strict();

// pick drops a key srt lacks without an error; tests/config.mjs catches it by parsing default-config.json
const srtKeys = Object.keys(DEFAULTS).filter((key) => !Object.hasOwn(LISTS.shape, key));
const OVERRIDES = LISTS.extend(SRT.pick(Object.fromEntries(srtKeys.map((key) => [key, true]))).shape)
  .partial()
  .strict();

export const CONFIG_SCHEMA = LISTS.extend({ overrideDefaults: OVERRIDES }).partial().strict();

export function configErrorMap(issue, ctx) {
  if (issue.code !== "unrecognized_keys") return { message: ctx.defaultError };
  const messages = issue.keys.map((key) => {
    const name = [...issue.path, key].join(".");
    if (issue.path.length === 0 && Object.hasOwn(OVERRIDES.shape, key)) return `${name} can only be set under overrideDefaults`;
    return `unknown key ${name}`;
  });
  return { message: messages.join("; ") };
}
