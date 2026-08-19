import { dispatch, listTools, resolveTool, UnknownToolError } from "./registry.js";
import { listPrompts, getPrompt } from "./prompts.js";
import { listResources, readResource } from "./resources.js";
import { httpContext, runWithContext } from "./lib/context.js";
import { authGuidance } from "./lib/auth-guidance.js";
import { formatError } from "./lib/errors.js";
import { SERVER_NAME, SERVER_VERSION } from "./version.js";

/**
 * Streamable HTTP (JSON-RPC 2.0) transport for the MisarReach MCP server.
 *
 * Serves the SAME registry as the stdio binary, so the hosted endpoint and the
 * npm package cannot drift. Auth is injected by the host because it depends on
 * the MisarReach database.
 *
 * Built on Web `Request`/`Response` so the package carries no framework
 * dependency, and every call runs inside `runWithContext` — that is what makes
 * one shared tool implementation safe in a multi-tenant process, since the
 * credential lives in AsyncLocalStorage for the duration of the call rather
 * than in module state.
 */

export interface ReachCaller {
  userId: string;
  /** The raw API key forwarded to the REST API on this caller's behalf. */
  apiKey: string;
}

export interface ReachHttpOptions {
  /** Resolve an Authorization header to a caller, or null when invalid. */
  authenticate: (authHeader: string | null) => Promise<ReachCaller | null>;
  /** Optional per-caller rate limit, applied after auth. Return false to reject. */
  rateLimit?: (caller: ReachCaller) => Promise<boolean>;
  /** API base the tools call, e.g. `https://api.misar.io/reach`. */
  baseUrl: string;
  serverName?: string;
  serverVersion?: string;
  onError?: (toolName: string, error: unknown) => void;
}

type Id = string | number | null;

const JSON_HEADERS = { "Content-Type": "application/json" };

function ok(id: Id, result: unknown, headers: Record<string, string>) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    headers: { ...JSON_HEADERS, ...headers },
  });
}

function fail(id: Id, code: number, message: string, init: ResponseInit = {}) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }), {
    status: init.status ?? 200,
    headers: { ...JSON_HEADERS, ...(init.headers as Record<string, string>) },
  });
}

function toolResult(data: unknown, isError = false) {
  return {
    content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
    isError,
  };
}

export function createReachHttpHandler(options: ReachHttpOptions) {
  const {
    authenticate,
    rateLimit,
    baseUrl,
    serverName = SERVER_NAME,
    // Was a hardcoded "2.0.0", independent of SERVER_VERSION — see version.ts.
    serverVersion = SERVER_VERSION,
    onError,
  } = options;

  return async function handle(request: Request): Promise<Response> {
    let body: { jsonrpc?: string; id?: Id; method?: string; params?: unknown };
    try {
      body = await request.json();
    } catch {
      return fail(null, -32700, "Parse error: invalid JSON");
    }

    const id: Id = body.id ?? null;
    const method = body.method;
    const headers = {
      "Mcp-Session-Id": request.headers.get("Mcp-Session-Id") ?? crypto.randomUUID(),
    };

    // ── Unauthenticated discovery ────────────────────────────────────────────
    // Registries scan with no credentials. Gating this is precisely what froze
    // MisarMail's published tool list at a stale snapshot, so discovery always
    // answers — see MCP_SERVER_PROTOCOL.md rule 1.
    switch (method) {
      case "initialize":
        return ok(
          id,
          {
            protocolVersion: "2025-06-18",
            capabilities: { tools: {}, prompts: {}, resources: {} },
            serverInfo: { name: serverName, version: serverVersion },
          },
          headers,
        );
      case "notifications/initialized":
        return new Response(null, { status: 202, headers });
      case "ping":
        return ok(id, {}, headers);
      case "tools/list":
        return ok(id, { tools: listTools() }, headers);
      case "prompts/list":
        return ok(id, { prompts: listPrompts() }, headers);
      case "prompts/get": {
        const p = (body.params ?? {}) as { name?: string; arguments?: Record<string, string> };
        const prompt = getPrompt(p.name ?? "", p.arguments ?? {});
        if (!prompt) return fail(id, -32602, `Prompt not found: ${p.name}`);
        return ok(id, prompt, headers);
      }
      case "resources/list":
        return ok(id, { resources: listResources() }, headers);
    }

    // ── Everything below requires a valid key ────────────────────────────────
    const url = new URL(request.url);
    const queryKey = url.searchParams.get("apiKey");
    const authHeader = queryKey ? `Bearer ${queryKey}` : request.headers.get("authorization");
    const caller = await authenticate(authHeader);

    if (!caller) {
      // The full guidance block, not a one-liner: clients relay this to the end
      // user, so it is the whole authentication UX. RFC 9728 challenge attached
      // so OAuth-capable clients can recover rather than hard-fail.
      return fail(null, -32001, authGuidance("missing"), {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Bearer realm="MisarReach"',
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Expose-Headers": "WWW-Authenticate",
        },
      });
    }

    if (rateLimit && !(await rateLimit(caller))) {
      return fail(id, -32029, "Rate limit exceeded. Try again shortly.", { status: 429 });
    }

    const ctx = httpContext(caller.apiKey, baseUrl);

    switch (method) {
      case "resources/read": {
        const p = (body.params ?? {}) as { uri?: string };
        try {
          const result = await runWithContext(ctx, () => readResource(p.uri ?? ""));
          if (!result) return fail(id, -32602, `Resource not found: ${p.uri}`);
          return ok(id, result, headers);
        } catch (err) {
          return fail(id, -32603, `Failed to read resource: ${formatError(err)}`);
        }
      }

      case "tools/call": {
        const p = (body.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
        if (!p.name) return fail(id, -32602, "Invalid params: missing tool name");

        // Resolve before running, so a mistyped name reports a name problem.
        if (!resolveTool(p.name)) return fail(id, -32602, `Unknown tool: ${p.name}`);

        try {
          const text = await runWithContext(ctx, () => dispatch(p.name!, p.arguments ?? {}));
          return ok(id, toolResult(text), headers);
        } catch (err) {
          if (err instanceof UnknownToolError) return fail(id, -32602, err.message);
          onError?.(p.name, err);
          // A failing API call is a tool-level error, not a protocol error: the
          // agent should see it and adapt rather than lose the session.
          return ok(id, toolResult(`Error: ${formatError(err)}`, true), headers);
        }
      }

      default:
        return fail(id, -32601, `Method not found: ${method}`);
    }
  };
}

/** CORS preflight for browser-based MCP clients. */
export function corsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
      "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
    },
  });
}
