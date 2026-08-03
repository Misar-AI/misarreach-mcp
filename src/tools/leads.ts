import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiFetch } from "../lib/api-client.js";

export const leadTools: Tool[] = [
  {
    name: "list_leads",
    description:
      "List saved leads for the authenticated user. Supports pagination and search by name, email, or company.",
    inputSchema: {
      type: "object",
      properties: {
        page:   { type: "number", description: "Page number (default 1)" },
        limit:  { type: "number", description: "Results per page (default 20, max 100)" },
        search: { type: "string", description: "Search term to filter by name, email, or company" },
        job_id: { type: "string", description: "Filter leads by a specific search job UUID" },
      },
    },
  },
  {
    name: "search_leads",
    description:
      "Start an AI-powered lead search job. Returns a jobId immediately — poll get_search_job_status for results. Consumes search credits.",
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
  },
  {
    name: "get_search_job_status",
    description: "Poll the status and results of a lead search job.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "Lead search job UUID" },
      },
      required: ["jobId"],
    },
  },
  {
    name: "submit_lead_feedback",
    description:
      "Submit positive or negative feedback on an AI-generated lead message to improve future output quality.",
    inputSchema: {
      type: "object",
      properties: {
        jobId:     { type: "string", description: "Lead search job UUID" },
        leadEmail: { type: "string", description: "Email address of the lead" },
        feedback:  { type: "string", enum: ["positive", "negative"], description: "Feedback sentiment" },
      },
      required: ["jobId", "leadEmail", "feedback"],
    },
  },
  {
    name: "discover_companies",
    description:
      "Discover companies matching criteria via Hunter.io. Optionally fetch contact emails for each company.",
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
  },
  {
    name: "enrich_lead",
    description:
      "Enrich a lead with person and company data (seniority, department, LinkedIn, phone, company size, industry). Consumes enrichment credits.",
    inputSchema: {
      type: "object",
      properties: {
        leadId: { type: "string", description: "Lead UUID from list_leads" },
      },
      required: ["leadId"],
    },
  },
  {
    name: "verify_emails",
    description:
      "Verify email deliverability for one or more email addresses. Consumes verification credits.",
    inputSchema: {
      type: "object",
      properties: {
        email:  { type: "string", description: "Single email to verify (use this OR emails array)" },
        emails: { type: "array", items: { type: "string" }, description: "Batch of emails to verify (max 20)" },
      },
    },
  },
  {
    name: "score_leads",
    description:
      "Trigger on-demand AI scoring for all unscored leads in a job, or a specific set of lead IDs. Runs in background — returns immediately with count. Consumes AI credits.",
    inputSchema: {
      type: "object",
      properties: {
        jobId:   { type: "string", description: "Score all unscored leads for this job UUID (use this OR leadIds)" },
        leadIds: { type: "array", items: { type: "string" }, description: "Specific lead UUIDs to (re)score (max 200, use this OR jobId)" },
      },
    },
  },
  {
    name: "list_lead_lists",
    description: "List Hunter.io lead lists associated with the account.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_lead_list",
    description: "Create a new Hunter.io lead list.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "List name (1-200 chars)" },
      },
      required: ["name"],
    },
  },
  {
    name: "sync_lead_list",
    description: "Sync a Hunter.io lead list into local lead records.",
    inputSchema: {
      type: "object",
      properties: {
        listId: { type: "string", description: "Hunter.io list ID (integer as string)" },
      },
      required: ["listId"],
    },
  },
  {
    name: "preview_message",
    description:
      "Generate a sample AI-personalised outreach message for a person. Public endpoint — no auth required.",
    inputSchema: {
      type: "object",
      properties: {
        name:    { type: "string", description: "Person's full name (1-100 chars)" },
        role:    { type: "string", description: "Job title or role (optional, max 100 chars)" },
        company: { type: "string", description: "Company name (optional, max 100 chars)" },
      },
      required: ["name"],
    },
  },
  {
    name: "send_to_campaign",
    description:
      "Bulk-import selected lead IDs into a campaign's contact list. Leads must belong to the authenticated user.",
    inputSchema: {
      type: "object",
      properties: {
        leadIds:    { type: "array", items: { type: "string" }, description: "Lead UUIDs to import (1-500)" },
        campaignId: { type: "string", description: "Target campaign UUID" },
        listId:     { type: "string", description: "Target contact list UUID (defaults to campaign's own list)" },
      },
      required: ["leadIds", "campaignId"],
    },
  },
];

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
