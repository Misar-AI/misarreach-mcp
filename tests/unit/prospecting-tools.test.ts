/**
 * Prospecting tools: they call the right API paths, and every answer is shaped
 * so that it names no data source or vendor — the raw rows carry provenance
 * (`source`, the search plan, the per-source log), and none of it may reach an
 * agent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispatch, listTools } from "../../src/registry.js";
import { normaliseDomain, timing } from "../../src/tools/prospecting.js";

const VENDOR = /hunter|apollo|people ?data ?labs|\bpdl\b|reacher|snov|coresignal|searx|yc_founders|sec_form_d|global_db|source_log|search_plan/i;

type Route = (url: URL, init: RequestInit) => { status?: number; body: unknown };
let calls: Array<{ method: string; path: string; body: unknown }> = [];

function serve(route: Route) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = new URL(input);
      calls.push({ method: init.method ?? "GET", path: url.pathname + url.search, body: init.body ? JSON.parse(String(init.body)) : undefined });
      const { status = 200, body } = route(url, init);
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    }),
  );
}

const row = (over: Record<string, unknown> = {}) => ({
  id: "r1", name: "Jane Doe", role: "CTO", company: "Acme", location: "Berlin", email: "jane@acme.com",
  verify_status: "valid", phone: null, linkedin_url: "https://linkedin.com/in/janedoe", website: "https://acme.com",
  source: "hunter", merged_sources: ["apollo", "pdl"], field_sources: { email: "hunter" }, ai_message: "Hi Jane", ...over,
});

beforeEach(() => {
  calls = [];
  process.env.MISARREACH_API_KEY = "mrk_test";
  process.env.MISARREACH_BASE_URL = "https://api.test/reach/api";
  timing.sleep = async (ms) => { clock += ms; };
  timing.now = () => clock;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MISARREACH_BASE_URL;
});
let clock = 0;

describe("catalogue", () => {
  it("registers the four tools with annotations", () => {
    const names = listTools().map((t) => t.name);
    for (const n of ["search_verified_leads", "reveal_company_contacts", "company_email_format", "verify_email"]) {
      const t = listTools().find((x) => x.name === n)!;
      expect(names).toContain(n);
      expect(t.annotations?.title).toBeTruthy();
      expect(`${t.description} ${JSON.stringify(t.inputSchema)}`).not.toMatch(VENDOR);
    }
  });
});

describe("search_verified_leads", () => {
  it("starts a search, waits for it, and returns shaped reachable leads only", async () => {
    let polls = 0;
    serve((url) => {
      if (url.pathname.endsWith("/lead-finder/search")) return { status: 202, body: { jobId: "job-1" } };
      if (url.pathname.endsWith("/lead-finder/jobs/job-1")) {
        polls++;
        return { body: { status: polls < 3 ? "running" : "done", source_log: ["hunter: 3"], search_plan: { sources: ["apollo"] }, explanation: "Searched hunter, apollo" } };
      }
      if (url.pathname.endsWith("/lead-finder/leads")) {
        return { body: { leads: [row(), row({ id: "r2", name: "No Way", email: null, linkedin_url: null, phone: null, source: "apollo" })], total: 2 } };
      }
      return { status: 404, body: { error: "nope" } };
    });
    const out = await dispatch("search_verified_leads", { query: "CTOs in Berlin", filters: { location: "Berlin" }, limit: 10 });
    const parsed = JSON.parse(out);
    expect(calls[0]).toMatchObject({ method: "POST", path: "/reach/api/lead-finder/search", body: { query: "CTOs in Berlin", useAI: false, filters: { location: "Berlin" } } });
    expect(calls.at(-1)!.path).toBe("/reach/api/lead-finder/leads?job_id=job-1&limit=10");
    expect(parsed.status).toBe("done");
    expect(parsed.leads).toEqual([
      { name: "Jane Doe", role: "CTO", company: "Acme", location: "Berlin", email: "jane@acme.com", email_status: "valid", phone: null, linkedin_url: "https://linkedin.com/in/janedoe", website: "https://acme.com" },
    ]);
    expect(out).not.toMatch(VENDOR);
  });

  it("resumes an earlier search by job_id without starting (or paying for) a new one", async () => {
    serve((url) => (url.pathname.includes("/jobs/") ? { body: { status: "done" } } : { body: { leads: [row()], total: 1 } }));
    await dispatch("search_verified_leads", { job_id: "job-9" });
    expect(calls.some((c) => c.path.endsWith("/lead-finder/search"))).toBe(false);
  });

  it("hands back the job_id and partial leads when the search outlives wait_seconds", async () => {
    serve(() => ({ body: { status: "running", results: [row({ source: "apollo" })], explanation: "apollo" } }));
    const parsed = JSON.parse(await dispatch("search_verified_leads", { job_id: "job-2", wait_seconds: 6 }));
    expect(parsed).toMatchObject({ job_id: "job-2", status: "running" });
    expect(parsed.leads).toHaveLength(1);
    expect(parsed.message).toMatch(/job_id/);
    expect(JSON.stringify(parsed)).not.toMatch(VENDOR);
  });

  it("reports a failed search without relaying the server's internals", async () => {
    serve(() => ({ body: { status: "failed", error: "hunter quota exhausted" } }));
    const out = await dispatch("search_verified_leads", { job_id: "job-3" });
    expect(JSON.parse(out).status).toBe("failed");
    expect(out).not.toMatch(VENDOR);
  });

  it("refuses an empty query", async () => {
    serve(() => ({ body: {} }));
    await expect(dispatch("search_verified_leads", { query: " " })).rejects.toThrow(/query/);
    expect(calls).toHaveLength(0);
  });
});

describe("reveal_company_contacts", () => {
  it("normalises the domain and returns only the published contacts", async () => {
    serve(() => ({
      body: {
        domain: "acme.com", pages_checked: 4, emails: ["hello@acme.com"], phone: { published: "+1 312 555 0100", e164: "+13125550100" },
        published_name: "Acme Inc", profiles: { linkedin: "https://linkedin.com/company/acme" }, technologies: ["Next.js"],
        technology_categories: { framework: ["Next.js"] }, has_contact: true, charged: true, debug_source: "hunter",
      },
    }));
    const out = JSON.parse(await dispatch("reveal_company_contacts", { domain: "https://www.Acme.com/about" }));
    expect(calls[0]!.path).toBe("/reach/api/lead-finder/companies/acme.com/site");
    expect(out).toMatchObject({ domain: "acme.com", company_name: "Acme Inc", emails: ["hello@acme.com"], charged: true, has_contact: true });
    expect(out).not.toHaveProperty("debug_source");
  });

  it("rejects something that is not a domain before calling the API", async () => {
    serve(() => ({ body: {} }));
    await expect(dispatch("reveal_company_contacts", { domain: "not a domain" })).rejects.toThrow(/domain/);
    expect(calls).toHaveLength(0);
  });
});

describe("company_email_format", () => {
  it("returns the published format", async () => {
    serve(() => ({ body: { domain: "acme.com", verifiedAddresses: 9, top: { pattern: "first.last", template: "{first}.{last}@acme.com", example: "jane.doe@acme.com", share: 0.78, count: 7 }, confidence: "high", patterns: [], computedAt: "2026-10-05T04:00:00.000Z" } }));
    const out = JSON.parse(await dispatch("company_email_format", { domain: "acme.com" }));
    expect(calls[0]!.path).toBe("/reach/api/public/email-formats/acme.com");
    expect(out.top.pattern).toBe("first.last");
  });

  it("turns 'not enough evidence' into an answer, not an error", async () => {
    serve(() => ({ status: 404, body: { error: "Not enough verified addresses", domain: "tiny.io" } }));
    const out = JSON.parse(await dispatch("company_email_format", { domain: "tiny.io" }));
    expect(out).toMatchObject({ domain: "tiny.io", published: false });
  });
});

describe("verify_email", () => {
  it("checks exactly one address and reports a catch-all honestly", async () => {
    serve(() => ({ body: { results: [{ email: "x@acme.com", status: "accept_all", score: null, catch_all: true, pending: false }], verified: 1 } }));
    const out = JSON.parse(await dispatch("verify_email", { email: "x@acme.com" }));
    expect(calls[0]).toMatchObject({ method: "POST", path: "/reach/api/lead-finder/verify", body: { email: "x@acme.com" } });
    expect(out).toEqual({ email: "x@acme.com", status: "accept_all", catch_all: true, pending: false });
  });
});

describe("normaliseDomain", () => {
  it("reduces URLs to a bare domain and rejects non-domains", () => {
    expect(normaliseDomain("HTTPS://www.Acme.co.uk:443/x?y")).toBe("acme.co.uk");
    expect(normaliseDomain("acme")).toBeNull();
    expect(normaliseDomain(42)).toBeNull();
  });
});
