import { getApiKey, getBaseUrl } from "./auth.js";
import { currentContext } from "./context.js";
import { apiError } from "./errors.js";
import { noteUsage } from "./usage.js";

/**
 * Resolve credentials for the current call.
 *
 * Prefers the request-scoped context (HTTP transport, where each request
 * carries its own key) and falls back to the process/on-disk configuration
 * (stdio). Every tool goes through here, so neither transport can accidentally
 * read the other's credentials.
 */
function resolve(): { key: string; base: string; source: string } {
  const ctx = currentContext();
  if (ctx) return { key: ctx.apiKey, base: ctx.baseUrl, source: ctx.source };
  return { key: getApiKey(), base: getBaseUrl(), source: "mcp_stdio" };
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { key, base, source } = resolve();
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "X-MCP-Source": source,
      ...options.headers,
    },
  });
  // Record remaining allowance before anything can throw, so a tool can append
  // the 80% warning to its successful output.
  noteUsage(res.headers);

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw apiError(res.status, body);
  return body as T;
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const { key, base, source } = resolve();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "X-MCP-Source": "mcp_claude" },
    body: form,
  });
  // Record remaining allowance before anything can throw, so a tool can append
  // the 80% warning to its successful output.
  noteUsage(res.headers);

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw apiError(res.status, body);
  return body as T;
}
