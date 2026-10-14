import { mkdirSync, writeFileSync } from "node:fs";

import { exitWithConfigError, parseConfig, readIfExists, trustMarker } from "../config/config.mjs";
import { PROJECT_CONFIG, TRUST_MARKERS } from "../constants/paths.mjs";

export function trustProjectConfig() {
  const text = readIfExists(PROJECT_CONFIG);
  if (text === undefined) exitWithConfigError(PROJECT_CONFIG, "not found");
  // A malformed file fails now rather than on the next launch
  parseConfig(PROJECT_CONFIG, text);
  mkdirSync(TRUST_MARKERS, { recursive: true });
  writeFileSync(trustMarker(text), "");
  console.log(`blackwall: trusted ${PROJECT_CONFIG}`);
}
