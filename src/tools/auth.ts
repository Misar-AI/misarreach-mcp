import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { execFileSync } from "node:child_process";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { saveConfig, tryGetApiKey, getBaseUrl } from "../lib/auth.js";
import { apiFetch } from "../lib/api-client.js";
import { authGuidance } from "../lib/auth-guidance.js";

/**
 * Browser-based authentication for the stdio transport.
 *
 * Deliberately NOT part of the shared registry: these bind a loopback HTTP
 * listener and open a browser on the user's machine, which is meaningless (and
 * would be a vulnerability) on a hosted HTTP endpoint where the caller already
 * presents a key. `index.ts` merges them into the stdio catalogue only.
 *
 * Mirrors the mail and blog implementations — see
 * misar-io/docs/Guidelines/MCP_SERVER_PROTOCOL.md.
 */

const APP_URL = (process.env.MISARREACH_APP_URL ?? "https://reach.misar.io").replace(/\/$/, "");

/**
 * A port range distinct from mail (9101–9199) and blog (9001–9099), so a user
 * mid-login on two products at once cannot have one listener steal the other's
 * callback.
 */
const PORT_MIN = 9201;
const PORT_MAX = 9299;
const LOGIN_TIMEOUT_MS = 120_000;

/** Cheap, read-only endpoint used to check whether a stored key still works. */
const PROBE_PATH = "/channels/status";

/** Open a URL in the system browser. execFileSync with separate args — no shell, no injection. */
function openBrowser(url: string): void {
  try {
    if (process.platform === "darwin") execFileSync("open", [url], { stdio: "ignore" });
    else if (process.platform === "win32")
      execFileSync("cmd.exe", ["/c", "start", "", url], { stdio: "ignore" });
    else execFileSync("xdg-open", [url], { stdio: "ignore" });
  } catch {
    process.stderr.write(`Open this URL in your browser:\n  ${url}\n`);
  }
}

/** Best-effort name for the host application, shown on the consent screen. */
function detectClientName(): string {
  const explicit = process.env.MISARREACH_CLIENT_NAME?.trim();
  if (explicit) return explicit.slice(0, 60);
  if (process.env.CLAUDECODE || process.env.CLAUDE_CODE) return "Claude Code";
  if (process.env.CURSOR_TRACE_ID || process.env.CURSOR_SESSION_ID) return "Cursor";
  if (process.env.TERM_PROGRAM === "vscode") return "VS Code";
  if (process.env.WINDSURF_SESSION_ID) return "Windsurf";
  return "MCP Client";
}

function randomPort(): number {
  return PORT_MIN + Math.floor(Math.random() * (PORT_MAX - PORT_MIN + 1));
}

/**
 * Bind the loopback listener, retrying on a different port when the chosen one
 * is taken — otherwise a second editor holding a port surfaces to the user as
 * an unexplained authorization failure.
 */
function listenOnFreePort(
  srv: Server,
  preferred: number | undefined,
  attemptsLeft: number,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const port =
      preferred && preferred >= PORT_MIN && preferred <= PORT_MAX ? preferred : randomPort();

    const onError = (err: NodeJS.ErrnoException) => {
      srv.removeListener("error", onError);
      if (err.code === "EADDRINUSE" && attemptsLeft > 0) {
        listenOnFreePort(srv, undefined, attemptsLeft - 1).then(resolve, reject);
        return;
      }
      reject(err);
    };

    srv.once("error", onError);
    srv.listen(port, "127.0.0.1", () => {
      srv.removeListener("error", onError);
      resolve(port);
    });
  });
}

async function runLogin(args: Record<string, unknown>): Promise<string> {
  const preferredPort = typeof args.port === "number" ? args.port : undefined;
  const appUrl = (typeof args.app_url === "string" ? args.app_url : APP_URL).replace(/\/$/, "");
  const force = args.force === true;

  if (!force && tryGetApiKey()) {
    try {
      await apiFetch(PROBE_PATH);
      return "Already authenticated. Call `login` with force=true to connect a different account or issue a new key.";
    } catch {
      // Stored key rejected — fall through and re-authenticate.
    }
  }

  const clientName = detectClientName();

  return new Promise<string>((resolve) => {
    let resolved = false;
    let timer: NodeJS.Timeout | undefined;

    const finish = (text: string) => {
      if (resolved) return;
      resolved = true;
      if (timer) clearTimeout(timer);
      srv.close();
      resolve(text);
    };

    const srv = createServer((req: IncomingMessage, res: ServerResponse) => {
      // Loopback only — this listener holds a live credential handoff, so
      // anything arriving from off-host is rejected outright.
      const remote = req.socket.remoteAddress ?? "";
      if (remote !== "127.0.0.1" && remote !== "::1" && remote !== "::ffff:127.0.0.1") {
        res.writeHead(403).end();
        return;
      }
      if (req.method !== "POST" || req.url !== "/token") {
        res.writeHead(404).end();
        return;
      }

      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          const data = JSON.parse(body) as { api_key?: string; base_url?: string };
          const key = (data.api_key ?? "").trim();

          // MisarReach keys are mrk_ — verified against src/lib/api-key-auth.ts.
          if (!key.startsWith("mrk_")) {
            res
              .writeHead(400, { "Content-Type": "application/json" })
              .end(JSON.stringify({ error: "invalid key" }));
            return;
          }

          res
            .writeHead(200, { "Content-Type": "application/json" })
            .end(JSON.stringify({ ok: true }));
          saveConfig({ api_key: key, ...(data.base_url ? { base_url: data.base_url } : {}) });

          finish(
            "Connected to MisarReach. API key saved to ~/.misarreach/config.json.\n\n" +
              "All MisarReach tools are now available without setting MISARREACH_API_KEY.",
          );
        } catch {
          res.writeHead(400).end();
        }
      });
    });

    listenOnFreePort(srv, preferredPort, 8).then(
      (boundPort) => {
        const params = new URLSearchParams({
          mode: "key",
          mcp_port: String(boundPort),
          client: clientName,
          // Reach keys are not feature-scoped — every key is full access.
          scope: "*",
        });
        const authorizeUrl = `${appUrl}/authorize?${params.toString()}`;

        openBrowser(authorizeUrl);
        process.stderr.write(
          `Waiting for authorization at ${authorizeUrl}\n(listening on 127.0.0.1:${boundPort})\n`,
        );

        timer = setTimeout(() => {
          finish(
            `Login timed out after ${LOGIN_TIMEOUT_MS / 1000} seconds. Open this URL manually and click 'Authorize':\n\n${authorizeUrl}`,
          );
        }, LOGIN_TIMEOUT_MS);
      },
      (err: Error) => {
        finish(
          `Could not start the local callback listener: ${err.message}\n\n` +
            `Ports ${PORT_MIN}–${PORT_MAX} all appear to be in use. Pass an explicit free port, e.g. login with port ${PORT_MIN + 41}.`,
        );
      },
    );
  });
}

export const authTools: Tool[] = [
  {
    name: "login",
    description:
      "Authenticate with your MisarReach account via browser — no API key copy-paste needed. Opens the MisarReach authorization page where you review the request and click 'Authorize'. The API key is delivered straight back to this client and saved to ~/.misarreach/config.json.",
    inputSchema: {
      type: "object",
      properties: {
        port: {
          type: "number",
          description: `Local callback port (${PORT_MIN}–${PORT_MAX}). Random by default.`,
        },
        app_url: {
          type: "string",
          description: "MisarReach base URL. Only needed for self-hosted instances.",
        },
        force: {
          type: "boolean",
          description: "Re-authenticate even if a working key is stored (issues a new key).",
        },
      },
    },
  },
  {
    name: "logout",
    description:
      "Disconnect this client by deleting the stored MisarReach API key from ~/.misarreach/config.json. The key stays valid on the server — revoke it in Settings → API keys to retire it fully.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "auth_status",
    description:
      "Check whether this client is authenticated with MisarReach and which API base URL it is using. Returns actionable next steps when it is not.",
    inputSchema: { type: "object", properties: {} },
  },
];

export async function handleAuthTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "login":
      return runLogin(args);

    case "logout": {
      // `undefined` removes the field — see saveConfig's merge semantics.
      saveConfig({ api_key: undefined });
      return (
        "Disconnected. The stored API key was removed from ~/.misarreach/config.json.\n\n" +
        "It is still valid on the server — revoke it at https://reach.misar.io/settings if you no longer want it to work."
      );
    }

    case "auth_status": {
      const key = tryGetApiKey();
      const baseUrl = getBaseUrl();

      if (!key) {
        return JSON.stringify(
          { authenticated: false, base_url: baseUrl, next_step: authGuidance("missing") },
          null,
          2,
        );
      }

      try {
        await apiFetch(PROBE_PATH);
        return JSON.stringify({ authenticated: true, base_url: baseUrl }, null, 2);
      } catch (err) {
        return JSON.stringify(
          {
            authenticated: false,
            base_url: baseUrl,
            error: err instanceof Error ? err.message : String(err),
            // A rejected key needs a different remedy than a missing one.
            next_step: authGuidance("rejected"),
          },
          null,
          2,
        );
      }
    }

    default:
      throw new Error(`Unknown auth tool: ${name}`);
  }
}
