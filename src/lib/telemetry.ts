import { createHash } from "node:crypto";

/**
 * Usage reporting for this MCP server.
 *
 * Feeds the analytics module at cms.misar.io, which answers "who is using the
 * MCP servers, which tools, and how often do they fail".
 *
 * SELF-CONTAINED ON PURPOSE. This package is published to PUBLIC npm, so it
 * cannot depend on @misar/lib (which lives on the private Forgejo registry) —
 * that would break `npm install` for every external user. Everything here uses
 * only node builtins and `fetch`.
 *
 * INERT UNLESS CONFIGURED. Reporting requires ANALYTICS_SERVICE_KEY, which is
 * set only on Misar's own hosted HTTP endpoint. On a user's machine — the stdio
 * transport, which is how this package is normally run — the variable is absent,
 * `report()` returns immediately, and nothing is ever sent anywhere. A locally
 * run MCP server does not phone home.
 *
 * NEVER THROWS, NEVER BLOCKS. A tool call must not fail, or even slow down,
 * because a metrics collector is unreachable.
 */

const ENDPOINT = process.env.ANALYTICS_API_URL || "https://api.misar.io/io/analytics";
const TIMEOUT_MS = Number(process.env.ANALYTICS_TIMEOUT_MS ?? 1500);

/**
 * Pseudonymous, stable identifier for the caller.
 *
 * An MCP call authenticates with an API key, not a browser session, so there is
 * no user uuid to record. Hashing the key gives a value that is stable per user
 * — so "distinct users" is countable — while never storing the credential
 * itself. Truncated because a full digest is more entropy than a counter needs.
 */
function callerId(apiKey: string | undefined): string | null {
  if (!apiKey) return null;
  return `mcp_${createHash("sha256").update(apiKey).digest("hex").slice(0, 24)}`;
}

export type McpUsage = {
  /** MCP server name, e.g. "misarmail". */
  server: string;
  /** products.slug this server belongs to, e.g. "mail". */
  product: string;
  tool: string;
  ok: boolean;
  durationMs: number;
  apiKey?: string;
  /** "mcp_stdio" | "mcp_http" — where the call arrived from. */
  source?: string;
  errorCode?: string;
};

export function reportToolCall(usage: McpUsage): void {
  const key = process.env.ANALYTICS_SERVICE_KEY;
  if (!key) return; // not configured → not a hosted deployment → do nothing

  const body = JSON.stringify({
    events: [
      {
        event_name: "mcp_tool_called",
        category: "mcp",
        product: usage.product,
        anon_id: callerId(usage.apiKey),
        properties: {
          server: usage.server,
          tool: usage.tool,
          ok: usage.ok,
          duration_ms: usage.durationMs,
          source: usage.source ?? "mcp_http",
          ...(usage.errorCode ? { error_code: usage.errorCode } : {}),
        },
      },
    ],
  });

  // Detached: the caller is waiting on their tool result, not on us.
  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-analytics-service-key": key },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => {
    // Deliberately silent. An unreachable collector is not the user's problem,
    // and an MCP server writing network noise to stderr corrupts the stdio
    // protocol stream it shares with the client.
  });
}
