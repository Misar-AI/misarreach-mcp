import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { authGuidance } from "./auth-guidance.js";

const CONFIG_PATH = join(homedir(), ".misarreach", "config.json");

interface MisarConfig {
  api_key?: string;
  base_url?: string;
}

function loadConfig(): MisarConfig {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Merge-write the config.
 *
 * Merging rather than replacing: `login` writes only api_key, and a plain
 * overwrite silently discarded a configured base_url, pointing self-hosted
 * installs back at the public API. Pass `undefined` for a field to drop it —
 * that is how `logout` clears the key.
 */
export function saveConfig(config: MisarConfig): void {
  mkdirSync(join(homedir(), ".misarreach"), { recursive: true });
  const merged: MisarConfig = { ...loadConfig(), ...config };
  for (const key of Object.keys(merged) as (keyof MisarConfig)[]) {
    if (merged[key] === undefined) delete merged[key];
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), { mode: 0o600 });
}

export function getApiKey(): string {
  const envKey = process.env.MISARREACH_API_KEY?.trim();
  if (envKey) return envKey;
  const cfg = loadConfig();
  if (cfg.api_key) return cfg.api_key;
  // The full guidance block, not a one-liner: an MCP client relays this text
  // verbatim to the end user and it is the only authentication UX they get.
  // The old message also pointed at a `login` tool this server never registered.
  throw new Error(authGuidance("missing"));
}

export function tryGetApiKey(): string | null {
  try {
    return getApiKey();
  } catch {
    return null;
  }
}

export function getBaseUrl(): string {
  const envUrl = (process.env.MISARREACH_BASE_URL ?? "").trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  const cfg = loadConfig();
  if (cfg.base_url) return cfg.base_url.replace(/\/$/, "");
  return "https://api.misar.io/reach";
}
