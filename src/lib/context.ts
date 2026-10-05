import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-call credentials for a MisarReach MCP tool.
 *
 * stdio resolves these once from the environment or ~/.misarreach/config.json.
 * A hosted HTTP transport cannot: one process serves many users, so a
 * module-level credential would leak across requests.
 */
export interface ReachContext {
  apiKey: string;
  /** Versioned API base, e.g. `https://api.misar.io/reach/v1`. */
  baseUrl: string;
  source: "mcp_stdio" | "mcp_http";
}

/**
 * Request-scoped credential storage.
 *
 * AsyncLocalStorage rather than threading a parameter through every tool: the
 * 27 tool definitions were written against a zero-argument `apiFetch`, and the
 * goal is to make that SAME code safe per-request, not to rewrite it and risk
 * changing behaviour. `apiFetch` prefers the ambient store and falls back to
 * the on-disk config, so stdio is unchanged.
 */
const storage = new AsyncLocalStorage<ReachContext>();

/** Run `fn` with `ctx` visible to every apiFetch beneath it. */
export function runWithContext<T>(ctx: ReachContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

/** The ambient context, or null on stdio where credentials come from disk. */
export function currentContext(): ReachContext | null {
  return storage.getStore() ?? null;
}

/** Build a per-request context carrying the caller's key and API base. */
export function httpContext(apiKey: string, baseUrl: string): ReachContext {
  return { apiKey, baseUrl: baseUrl.replace(/\/$/, ""), source: "mcp_http" };
}
