import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiFetch } from "../lib/api-client.js";

/** Lead discovery, enrichment, verification and scoring. */
export const leadTools: Tool[] = [
  {
    name: "list_leads",
    description:
      "List leads already saved to the account, newest first, with paging and search. " +
      "\n\n" +
      "Use this to work with leads you already have. It does NOT find new ones — that is " +
      "search_leads, which starts a job and costs credits. Narrow to one search job with " +
      "job_id when you want just that job's results. " +
      "\n\n" +
      "Reads only and costs no credits. Requires an API key. Returns saved lead records " +
      "with contact and company fields plus enrichment and score where present. An empty " +
      "page is a normal answer, not an error. ",
    inputSchema: {
      type: "object",
      properties: {
        page:   { type: "number", description: "Page number (default 1)" },
        limit:  { type: "number", description: "Results per page (default 20, max 100)" },
        search: { type: "string", description: "Search term to filter by name, email, or company" },
        job_id: { type: "string", description: "Filter leads by a specific search job UUID" },
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "search_leads",
    description:
      "Start an AI lead-search job and return its jobId immediately. " +
      "\n\n" +
      "This is ASYNCHRONOUS: results are not in the response. Poll get_search_job_status " +
      "with the jobId until it reports completion, then read the leads with list_leads " +
      "filtered by that job_id. Use it to find NEW leads; use list_leads for ones already " +
      "saved. " +
      "\n\n" +
      "CONSUMES SEARCH CREDITS on every call, and each call starts a separate job — do not " +
      "retry it as a way to check progress. Requires an API key. Setting useAI additionally " +
      "spends AI credits to enrich and score the results as they arrive. ",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query describing the ideal lead (2-200 chars)" },
        useAI: { type: "boolean", description: "Use AI to enrich and score results (default false)" },
        filters: {
          type: "object",
          description: "Optional filters",
          properties: {
            location:    { type: "string", description: "Geographic location" },
            role:        { type: "string", description: "Job title or role" },
            industry:    { type: "string", description: "Industry sector" },
            companySize: { type: "string", description: "Company size range (e.g. '10-50')" },
          },
        },
      },
      required: ["query"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "get_search_job_status",
    description:
      "Poll one lead-search job for its progress and results. " +
      "\n\n" +
      "This is the companion to search_leads: call it repeatedly with the jobId you were " +
      "given until the job reports it has finished. Leave a few seconds between polls — " +
      "searches take a while, and polling harder does not make them faster. " +
      "\n\n" +
      "Reads only and costs no credits, however many times you call it. Requires an API " +
      "key. Returns the run state, progress, and the leads found so far; a job still " +
      "running is a normal answer, not an error. ",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "Lead search job UUID" },
      },
      required: ["jobId"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "submit_lead_feedback",
    description:
      "Record whether an AI-generated outreach message for a lead was good or bad, as " +
      "training signal for future generations. " +
      "\n\n" +
      "Use it when the user judges a drafted message — it improves later output rather than " +
      "changing anything now. It does not edit, resend, or delete the message, and it sends " +
      "nothing to the lead. " +
      "\n\n" +
      "Writes a feedback record; sending the same verdict twice is harmless. Requires an " +
      "API key. Costs no credits. ",
    inputSchema: {
      type: "object",
      properties: {
        jobId:     { type: "string", description: "Lead search job UUID" },
        leadEmail: { type: "string", description: "Email address of the lead" },
        feedback:  { type: "string", enum: ["positive", "negative"], description: "Feedback sentiment" },
      },
      required: ["jobId", "leadEmail", "feedback"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "discover_companies",
    description:
      "Find COMPANIES matching firmographic criteria via Hunter.io, optionally pulling " +
      "contact emails for each. " +
      "\n\n" +
      "This is company-level discovery — reach for it when the user is targeting " +
      "organisations by industry, location, headcount or tech stack. When they want named " +
      "people, use search_leads. Filters combine with AND, so stacking many narrows results " +
      "sharply. " +
      "\n\n" +
      "Requires an API key. Setting fetch_emails=true performs email lookups and COSTS " +
      "CREDITS; leaving it false is a plain company search. Returns matching companies with " +
      "firmographics. No lead is saved to the account by this call. ",
    inputSchema: {
      type: "object",
      properties: {
        query:         { type: "string", description: "Free-text company search query" },
        industry:      { type: "array", items: { type: "string" }, description: "Industry filters (max 10)" },
        location:      { type: "array", items: { type: "string" }, description: "Location filters (max 10)" },
        headcount_min: { type: "number", description: "Minimum employee count" },
        headcount_max: { type: "number", description: "Maximum employee count" },
        technology:    { type: "array", items: { type: "string" }, description: "Technology stack filters (max 10)" },
        fetch_emails:  { type: "boolean", description: "Also fetch contact emails for discovered companies (default false)" },
        limit:         { type: "number", description: "Max companies to return (1-100, default 20)" },
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "enrich_lead",
    description:
      "Fill in a saved lead's missing person and company detail — seniority, department, " +
      "LinkedIn, phone, company size, industry. " +
      "\n\n" +
      "Use it on one lead at a time, after list_leads has given you its id, and typically " +
      "before writing outreach that needs context. Check the lead first: enriching one that " +
      "already has these fields spends credits for nothing. " +
      "\n\n" +
      "CONSUMES ENRICHMENT CREDITS per call. Requires an API key. Updates the stored lead " +
      "in place and returns it; it does not create a new record, and running it twice does " +
      "not duplicate the lead — but it does bill twice. ",
    inputSchema: {
      type: "object",
      properties: {
        leadId: { type: "string", description: "Lead UUID from list_leads" },
      },
      required: ["leadId"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "verify_emails",
    description:
      "Check whether email addresses are deliverable, one or up to 20 at a time. " +
      "\n\n" +
      "Run this before a send to protect sender reputation — bouncing a campaign off dead " +
      "addresses is what gets a domain blocked. Pass either `email` for one or `emails` for " +
      "a batch, not both. " +
      "\n\n" +
      "CONSUMES VERIFICATION CREDITS per address checked, so a 20-address batch costs 20. " +
      "Requires an API key. Returns a deliverability verdict per address; 'undeliverable' " +
      "is a successful result, not an error. Nothing is sent to the addresses. ",
    inputSchema: {
      type: "object",
      properties: {
        email:  { type: "string", description: "Single email to verify (use this OR emails array)" },
        emails: { type: "array", items: { type: "string" }, description: "Batch of emails to verify (max 20)" },
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "score_leads",
    description:
      "Queue AI qualification scoring for leads — either every unscored lead in a search " +
      "job, or a specific set of ids. " +
      "\n\n" +
      "Pass jobId OR leadIds, not both. This runs in the BACKGROUND: it returns a count " +
      "immediately and the scores appear on the leads afterwards, so re-read them with " +
      "list_leads rather than expecting scores in this response. " +
      "\n\n" +
      "CONSUMES AI CREDITS per lead scored. Requires an API key. Passing leadIds rescores " +
      "leads even if they already have a score, which bills again — pass jobId to score " +
      "only what is unscored. Caps at 200 ids per call. ",
    inputSchema: {
      type: "object",
      properties: {
        jobId:   { type: "string", description: "Score all unscored leads for this job UUID (use this OR leadIds)" },
        leadIds: { type: "array", items: { type: "string" }, description: "Specific lead UUIDs to (re)score (max 200, use this OR jobId)" },
      },
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "list_lead_lists",
    description:
      "List the Hunter.io lead lists connected to this account. " +
      "\n\n" +
      "Use it to find a listId before sync_lead_list, or to check whether a list already " +
      "exists before create_lead_list makes a duplicate. These are Hunter.io's lists, which " +
      "are separate from the leads stored locally — list_leads shows those. " +
      "\n\n" +
      "Reads only, costs no credits, takes no parameters. Requires an API key and a " +
      "connected Hunter.io account. An empty result means no lists exist yet. ",
    inputSchema: { type: "object", properties: {} },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "create_lead_list",
    description:
      "Create a new, empty lead list in Hunter.io. " +
      "\n\n" +
      "Creating the list does not put anything in it, and it does not import anything " +
      "locally — sync_lead_list does that. Call list_lead_lists first: each call creates a " +
      "NEW list and nothing deduplicates by name. " +
      "\n\n" +
      "Requires an API key and a connected Hunter.io account. Costs no credits. Returns the " +
      "created list with the id that sync_lead_list needs. ",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "List name (1-200 chars)" },
      },
      required: ["name"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "sync_lead_list",
    description:
      "Import a Hunter.io lead list into local lead records so the rest of these tools can " +
      "work with it. " +
      "\n\n" +
      "Run it after create_lead_list, or on any existing list from list_lead_lists, to pull " +
      "its contacts in. Until a list is synced its contacts are invisible to list_leads, " +
      "enrich_lead and send_to_campaign. " +
      "\n\n" +
      "Writes local lead records. Re-syncing the same list refreshes rather than " +
      "duplicating, so it is safe to repeat. Requires an API key and a connected Hunter.io " +
      "account. Costs no credits; enrichment and verification are billed separately. ",
    inputSchema: {
      type: "object",
      properties: {
        listId: { type: "string", description: "Hunter.io list ID (integer as string)" },
      },
      required: ["listId"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "preview_message",
    description:
      "Draft a sample AI-personalised outreach message for a named person, to show what the " +
      "agent would say. " +
      "\n\n" +
      "This is a PREVIEW: nothing is sent, saved, or attached to a lead or campaign. Use it " +
      "to check tone before committing to a sequence. The person does not need to exist as " +
      "a lead — pass their name and, if known, role and company. " +
      "\n\n" +
      "This is the one tool here that needs no API key. Generative, so the same input " +
      "yields different wording each time. Returns the drafted message text. ",
    inputSchema: {
      type: "object",
      properties: {
        name:    { type: "string", description: "Person's full name (1-100 chars)" },
        role:    { type: "string", description: "Job title or role (optional, max 100 chars)" },
        company: { type: "string", description: "Company name (optional, max 100 chars)" },
      },
      required: ["name"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "send_to_campaign",
    description:
      "Add saved leads to a campaign's contact list in bulk, up to 500 at a time. " +
      "\n\n" +
      "This is how leads enter an outreach sequence, so treat it as consequential: once " +
      "they are on a running campaign's list they can start receiving messages. It does NOT " +
      "send anything by itself and does not start the campaign — but it removes the last " +
      "step before the campaign does. " +
      "\n\n" +
      "Every lead must belong to the authenticated account, or the call fails. Adding a " +
      "lead already on the list does not duplicate it. Requires an API key. Verify " +
      "addresses with verify_emails first; importing dead ones damages sender reputation. ",
    inputSchema: {
      type: "object",
      properties: {
        leadIds:    { type: "array", items: { type: "string" }, description: "Lead UUIDs to import (1-500)" },
        campaignId: { type: "string", description: "Target campaign UUID" },
        listId:     { type: "string", description: "Target contact list UUID (defaults to campaign's own list)" },
      },
      required: ["leadIds", "campaignId"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
];

/** Dispatch one lead tool call. */
export async function handleLeadTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "list_leads": {
      const params = new URLSearchParams();
      if (args.page)   params.set("page", String(args.page));
      if (args.limit)  params.set("limit", String(args.limit));
      if (args.search) params.set("search", String(args.search));
      if (args.job_id) params.set("job_id", String(args.job_id));
      const data = await apiFetch(`/lead-finder/leads?${params}`);
      return JSON.stringify(data, null, 2);
    }
    case "search_leads": {
      const data = await apiFetch("/lead-finder/search", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return JSON.stringify(data, null, 2);
    }
    case "get_search_job_status": {
      const data = await apiFetch(`/lead-finder/jobs/${args.jobId}`);
      return JSON.stringify(data, null, 2);
    }
    case "submit_lead_feedback": {
      const { jobId, ...body } = args;
      const data = await apiFetch(`/lead-finder/jobs/${jobId}/feedback`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return JSON.stringify(data, null, 2);
    }
    case "discover_companies": {
      const data = await apiFetch("/lead-finder/discover", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return JSON.stringify(data, null, 2);
    }
    case "enrich_lead": {
      const data = await apiFetch("/lead-finder/enrich", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return JSON.stringify(data, null, 2);
    }
    case "verify_emails": {
      const data = await apiFetch("/lead-finder/verify", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return JSON.stringify(data, null, 2);
    }
    case "score_leads": {
      const data = await apiFetch("/lead-finder/score", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return JSON.stringify(data, null, 2);
    }
    case "list_lead_lists": {
      const data = await apiFetch("/lead-finder/lists");
      return JSON.stringify(data, null, 2);
    }
    case "create_lead_list": {
      const data = await apiFetch("/lead-finder/lists", {
        method: "POST",
        body: JSON.stringify({ name: args.name }),
      });
      return JSON.stringify(data, null, 2);
    }
    case "sync_lead_list": {
      const data = await apiFetch(`/lead-finder/lists/${args.listId}/sync`, {
        method: "POST",
      });
      return JSON.stringify(data, null, 2);
    }
    case "preview_message": {
      const data = await apiFetch("/lead-finder/preview-message", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return JSON.stringify(data, null, 2);
    }
    case "send_to_campaign": {
      const data = await apiFetch("/lead-finder/send-to-campaign", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return JSON.stringify(data, null, 2);
    }
    default:
      throw new Error(`Unknown lead tool: ${name}`);
  }
}
