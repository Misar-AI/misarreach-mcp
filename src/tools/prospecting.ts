import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiFetch } from "../lib/api-client.js";

/**
 * Prospecting tools for AI agents: find people with a real way to reach them,
 * read a company's own published contacts, look up a company's email format,
 * and check one address.
 *
 * Every response is SHAPED here rather than relayed raw. The API rows carry
 * provenance fields (which source a lead came from, the search plan, the
 * per-source log); none of that is passed on. A tool answer names no data
 * source or vendor — only the lead, the company and the verdict.
 */

const DOMAIN_SCHEMA = {
  type: "string",
  description: "Company website domain, e.g. acme.com (a full URL is accepted and reduced to its domain)",
} as const;

export const prospectingTools: Tool[] = [
  {
    name: "search_verified_leads",
    description:
      "Find people or businesses matching a plain-language description and return only leads with a real way to reach them " +
      "(email, phone or LinkedIn), each read from a real record — never generated. Waits for the search to finish (up to " +
      "wait_seconds) and returns the leads with each email's verification status; if it is still running, call again with the " +
      "returned job_id. Consumes one search from the plan allowance or wallet.",
    annotations: {
      title: "Search verified leads",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Who to find, e.g. 'CTOs of developer tools startups in Berlin' (2-200 chars)" },
        filters: {
          type: "object",
          description: "Optional structured filters",
          properties: {
            location: { type: "string", description: "City, region or country" },
            role: { type: "string", description: "Job title or role" },
            industry: { type: "string", description: "Industry" },
            companySize: { type: "string", description: "Employee range, e.g. '11-50'" },
          },
        },
        limit: { type: "number", description: "Leads to return (1-100, default 25)" },
        wait_seconds: { type: "number", description: "How long to wait for the search to finish (0-120, default 60)" },
        job_id: { type: "string", description: "Resume an earlier search instead of starting a new one (no new search is charged)" },
      },
      required: [],
    },
  },
  {
    name: "reveal_company_contacts",
    description:
      "Read a company's own website now and return what it publishes: contact emails, a phone number, its social profiles " +
      "and its detected tech stack. robots.txt is obeyed. One enrichment credit, charged only when the site publishes a way to " +
      "reach the company, and at most once per company per day.",
    annotations: {
      title: "Reveal company contacts",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    inputSchema: {
      type: "object",
      properties: { domain: DOMAIN_SCHEMA },
      required: ["domain"],
    },
  },
  {
    name: "company_email_format",
    description:
      "The email address format a company uses (e.g. {first}.{last}@acme.com), learned only from addresses that were verified " +
      "deliverable, with each pattern's share and a confidence level. Free. Returns 'not published' when there is not yet " +
      "enough verified evidence for the domain.",
    annotations: {
      title: "Company email format",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: { domain: DOMAIN_SCHEMA },
      required: ["domain"],
    },
  },
  {
    name: "verify_email",
    description:
      "Check whether one email address can receive mail. Returns valid, invalid, accept_all (a catch-all domain: the server " +
      "accepts every address, so this one cannot be confirmed — do not treat it as valid), webmail, disposable or unknown. " +
      "Consumes one verification credit.",
    annotations: {
      title: "Verify one email",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    inputSchema: {
      type: "object",
      properties: { email: { type: "string", description: "The address to check" } },
      required: ["email"],
    },
  },
];

// ── Output shaping ────────────────────────────────────────────────────────────

/** The lead fields an agent gets. Anything else on the row (provenance included) is dropped. */
export interface ShapedLead {
  name: string | null;
  role: string | null;
  company: string | null;
  location: string | null;
  email: string | null;
  email_status: string | null;
  phone: string | null;
  linkedin_url: string | null;
  website: string | null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

export function shapeLead(row: Record<string, unknown>): ShapedLead {
  return {
    name: str(row.name),
    role: str(row.role),
    company: str(row.company),
    location: str(row.location),
    email: str(row.email),
    email_status: str(row.verify_status),
    phone: str(row.phone),
    linkedin_url: str(row.linkedin_url),
    website: str(row.website),
  };
}

const reachable = (l: ShapedLead) => Boolean(l.email || l.phone || l.linkedin_url);

/** "https://www.Acme.com/about" → "acme.com"; null when nothing domain-like is left. */
export function normaliseDomain(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const host = input.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0]!.replace(/^www\./, "").replace(/:\d+$/, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null;
}

const clamp = (v: unknown, min: number, max: number, dflt: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : dflt;
};

// ── Handlers ──────────────────────────────────────────────────────────────────

/** Injected so tests can run the polling loop without real time passing. */
export const timing = {
  sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  now: () => Date.now(),
  pollMs: 3000,
};

interface JobView {
  status?: string;
  progress?: unknown;
  total_found?: number | null;
  results?: Array<Record<string, unknown>>;
}

async function searchVerifiedLeads(args: Record<string, unknown>): Promise<string> {
  const limit = clamp(args.limit, 1, 100, 25);
  const waitMs = clamp(args.wait_seconds, 0, 120, 60) * 1000;

  let jobId = typeof args.job_id === "string" && args.job_id.trim() ? args.job_id.trim() : null;
  if (!jobId) {
    const query = typeof args.query === "string" ? args.query.trim() : "";
    if (query.length < 2) throw new Error("Give a query of at least 2 characters, or a job_id to resume.");
    const started = await apiFetch<{ jobId: string }>("/lead-finder/search", {
      method: "POST",
      body: JSON.stringify({ query, useAI: false, ...(args.filters && typeof args.filters === "object" ? { filters: args.filters } : {}) }),
    });
    jobId = started.jobId;
  }

  const deadline = timing.now() + waitMs;
  let job: JobView = await apiFetch<JobView>(`/lead-finder/jobs/${encodeURIComponent(jobId)}`);
  while ((job.status === "pending" || job.status === "running") && timing.now() < deadline) {
    await timing.sleep(Math.min(timing.pollMs, Math.max(0, deadline - timing.now())));
    job = await apiFetch<JobView>(`/lead-finder/jobs/${encodeURIComponent(jobId)}`);
  }

  if (job.status === "failed") {
    return JSON.stringify({ job_id: jobId, status: "failed", leads: [], message: "The search could not be completed. Try again, or rephrase the query." }, null, 2);
  }

  if (job.status !== "done") {
    const partial = (job.results ?? []).map(shapeLead).filter(reachable).slice(0, limit);
    return JSON.stringify(
      {
        job_id: jobId,
        status: job.status ?? "running",
        leads: partial,
        message: "Still searching. Call search_verified_leads again with this job_id to get the rest (no new search is charged).",
      },
      null,
      2,
    );
  }

  // Finished: read the delivered rows, which carry each email's verification status.
  const page = await apiFetch<{ leads?: Array<Record<string, unknown>>; total?: number }>(
    `/lead-finder/leads?${new URLSearchParams({ job_id: jobId, limit: String(limit) })}`,
  );
  const leads = (page.leads ?? []).map(shapeLead).filter(reachable);
  return JSON.stringify(
    {
      job_id: jobId,
      status: "done",
      total: typeof page.total === "number" ? page.total : leads.length,
      leads,
      ...(leads.length === 0 ? { message: "No reachable leads matched. Try a broader query or a different location." } : {}),
      note: "email_status: valid = deliverable; accept_all = catch-all domain, cannot be confirmed; null = not checked yet (use verify_email).",
    },
    null,
    2,
  );
}

interface SiteReveal {
  domain?: string;
  pages_checked?: number;
  emails?: string[];
  phone?: { published: string; e164: string | null } | null;
  published_name?: string | null;
  profiles?: Record<string, unknown>;
  technologies?: string[];
  has_contact?: boolean;
  charged?: boolean;
}

async function revealCompanyContacts(args: Record<string, unknown>): Promise<string> {
  const domain = normaliseDomain(args.domain);
  if (!domain) throw new Error("Give a company website domain, like acme.com.");
  const r = await apiFetch<SiteReveal>(`/lead-finder/companies/${encodeURIComponent(domain)}/site`);
  return JSON.stringify(
    {
      domain: r.domain ?? domain,
      company_name: r.published_name ?? null,
      emails: r.emails ?? [],
      phone: r.phone ?? null,
      profiles: r.profiles ?? {},
      technologies: r.technologies ?? [],
      pages_checked: r.pages_checked ?? 0,
      has_contact: r.has_contact ?? false,
      charged: r.charged ?? false,
    },
    null,
    2,
  );
}

async function companyEmailFormat(args: Record<string, unknown>): Promise<string> {
  const domain = normaliseDomain(args.domain);
  if (!domain) throw new Error("Give a company website domain, like acme.com.");
  try {
    const f = await apiFetch<Record<string, unknown>>(`/public/email-formats/${encodeURIComponent(domain)}`);
    return JSON.stringify(f, null, 2);
  } catch (err) {
    // 404 = not enough verified addresses to publish a format (not "unknown company").
    if (err instanceof Error && /not enough verified/i.test(err.message)) {
      return JSON.stringify({ domain, published: false, message: "No email format is published for this domain yet — not enough verified addresses." }, null, 2);
    }
    throw err;
  }
}

async function verifyEmail(args: Record<string, unknown>): Promise<string> {
  const email = typeof args.email === "string" ? args.email.trim() : "";
  if (!email.includes("@")) throw new Error("Give one email address to check.");
  const r = await apiFetch<{ results?: Array<{ email: string; status: string | null; catch_all: boolean | null; pending: boolean }> }>(
    "/lead-finder/verify",
    { method: "POST", body: JSON.stringify({ email }) },
  );
  const first = r.results?.[0];
  return JSON.stringify(
    {
      email,
      status: first?.status ?? null,
      catch_all: first?.catch_all ?? null,
      pending: first?.pending ?? true,
      ...(first?.pending ? { message: "The check could not finish yet; try again in a few minutes." } : {}),
    },
    null,
    2,
  );
}

export async function handleProspectingTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "search_verified_leads":
      return searchVerifiedLeads(args);
    case "reveal_company_contacts":
      return revealCompanyContacts(args);
    case "company_email_format":
      return companyEmailFormat(args);
    case "verify_email":
      return verifyEmail(args);
    default:
      throw new Error(`Unknown prospecting tool: ${name}`);
  }
}
