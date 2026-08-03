/**
 * The authentication contract every Misar MCP server must satisfy.
 *
 * See docs/Guidelines/MCP_SERVER_PROTOCOL.md. Three rules, all of which have
 * been violated in production on a sibling product:
 *
 *  1. Discovery NEVER requires credentials — a server that refuses (or exits)
 *     without a key never gets catalogued by registry scanners, which is why
 *     MisarMail's Smithery listing froze at a stale 16-tool snapshot.
 *  2. Execution ALWAYS requires credentials.
 *  3. The refusal must be ACTIONABLE, because MCP clients relay it verbatim to
 *     the end user — it IS the authentication UX.
 *
 * Reach ships both paths: the browser handshake via /authorize plus the manual
 * API-key route.
 */
import { describe, it, expect } from "vitest";
import { listTools, dispatch, resolveTool, UnknownToolError } from "../../src/registry.js";
import { authTools } from "../../src/tools/auth.js";
import { listPrompts, getPrompt, PROMPTS } from "../../src/prompts.js";
import { listResources, RESOURCES } from "../../src/resources.js";
import {
  authGuidance,
  AUTH_URLS,
  ENV_KEY,
  KEY_PREFIX,
  CONFIG_PATH,
  HAS_BROWSER_LOGIN,
} from "../../src/lib/auth-guidance.js";

describe("rule 1 — discovery never requires credentials", () => {
  it("lists tools with no key present", () => {
    // Importing and enumerating must not read a credential or throw.
    delete process.env.MISARREACH_API_KEY;
    expect(listTools().length).toBeGreaterThan(20);
  });

  it("every tool carries a description and input schema", () => {
    for (const tool of listTools()) {
      expect(tool.description, `${tool.name} has no description`).toBeTruthy();
      expect(tool.inputSchema, `${tool.name} has no inputSchema`).toBeTruthy();
    }
  });

  it("every tool name is snake_case", () => {
    for (const tool of listTools()) expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it("lists prompts and resources with no key present", () => {
    expect(listPrompts()).toHaveLength(PROMPTS.length);
    expect(listResources()).toHaveLength(RESOURCES.length);
  });
});

describe("rule 2 — execution always requires credentials", () => {
  it("refuses a real tool call with no key", async () => {
    delete process.env.MISARREACH_API_KEY;
    // Any tool reaching the API must fail closed rather than call it anonymously.
    await expect(dispatch("list_leads", {})).rejects.toThrow(/Not authenticated/);
  });

  it("reports an unknown tool as unknown, not as an auth failure", async () => {
    delete process.env.MISARREACH_API_KEY;
    // Otherwise a typo sends the user to fix their API key instead of the name.
    expect(resolveTool("__typo__")).toBeUndefined();
    await expect(dispatch("__typo__", {})).rejects.toBeInstanceOf(UnknownToolError);
  });
});

describe("rule 3 — the refusal is actionable", () => {
  it("names the dashboard URL, key prefix and every place a key can live", () => {
    const text = authGuidance("missing");
    expect(text).toContain(AUTH_URLS.apiKeys);
    expect(text).toContain(KEY_PREFIX);
    expect(text).toContain(ENV_KEY);
    expect(text).toContain(CONFIG_PATH);
    expect(text).toContain(AUTH_URLS.docs);
  });

  it("offers the browser flow, and that flow really exists", () => {
    // The guidance may only promise a browser sign-in when the product actually
    // serves /authorize AND registers the login tool — otherwise it strands the
    // user on a 404 or a tool that is not there.
    expect(HAS_BROWSER_LOGIN).toBe(true);
    const text = authGuidance("missing");
    expect(text).toContain(AUTH_URLS.authorize);
    expect(text).toContain("login");
    expect(authTools.map((t) => t.name)).toContain("login");
  });

  it("registers logout and auth_status alongside login", () => {
    const names = authTools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["login", "logout", "auth_status"]));
  });

  it("distinguishes a missing key from a rejected one", () => {
    expect(authGuidance("missing")).toContain("Not authenticated");
    expect(authGuidance("rejected")).toContain("rejected");
  });

  it("never leaks a credential into the guidance", () => {
    for (const reason of ["missing", "rejected"] as const) {
      expect(authGuidance(reason)).not.toMatch(/mrk_[A-Za-z0-9]{12,}/);
    }
  });
});

describe("prompts reference real tools", () => {
  it("every tool named in a prompt exists", () => {
    const known = new Set(listTools().map((t) => t.name));
    for (const prompt of PROMPTS) {
      const body = prompt.build({});
      // Require an underscore: tool names are snake_case, and a bare word
      // matches ordinary prose like "never call it to test".
      for (const match of body.matchAll(/\bcall ([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b/g)) {
        expect(known.has(match[1]!), `prompt "${prompt.name}" names unknown tool ${match[1]}`).toBe(true);
      }
    }
  });

  it("builds a usable body with no arguments", () => {
    for (const prompt of PROMPTS) {
      expect(getPrompt(prompt.name)!.messages[0]!.content.text.length).toBeGreaterThan(80);
    }
  });
});
