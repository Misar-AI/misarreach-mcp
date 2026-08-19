import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiFetch } from "../lib/api-client.js";

/** Deals and the sales pipeline board. */
export const dealTools: Tool[] = [
  {
    name: "list_deals",
    description:
      "List deals as a flat, paged array, optionally filtered by status, with revenue " +
      "totals alongside. " +
      "\n\n" +
      "Use this when you want deals as data — to count them, filter one status, or page " +
      "through many. For the board view with deals grouped into stages, use get_pipeline " +
      "instead; the two return the same deals in different shapes. " +
      "\n\n" +
      "Reads only. Requires an API key. Returns the deals plus a summary of total, closed " +
      "and open pipeline revenue. Money is in minor currency units (cents), so divide by " +
      "100 before showing it. ",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter by deal status (e.g. new, contacted, interested, meeting, proposal, closed, lost)",
        },
        limit:  { type: "number", description: "Max results (default 50, max 100)" },
        offset: { type: "number", description: "Pagination offset (default 0)" },
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
    name: "create_deal",
    description:
      "Open a new deal against a lead's email address. " +
      "\n\n" +
      "Use it when a conversation turns into a real opportunity worth tracking. Each call " +
      "creates a NEW deal — it does not check for an existing one on the same email, so " +
      "list_deals first if you might be duplicating. To change a deal that exists, use " +
      "update_deal. " +
      "\n\n" +
      "Requires an API key. `value` is in MINOR CURRENCY UNITS — 2500 means $25.00, not " +
      "$2500 — and defaults to 0 with currency USD. Returns the created deal, which enters " +
      "the pipeline at the first stage. ",
    inputSchema: {
      type: "object",
      properties: {
        leadEmail:      { type: "string", description: "Lead's email address" },
        leadName:       { type: "string", description: "Lead's display name" },
        value:          { type: "number", description: "Deal value in minor currency units (default 0)" },
        currency:       { type: "string", description: "ISO 4217 currency code (default USD)" },
        notes:          { type: "string", description: "Deal notes (max 5000 chars)" },
        conversationId: { type: "string", description: "UUID of associated conversation" },
        campaignId:     { type: "string", description: "UUID of associated campaign" },
        contactId:      { type: "string", description: "UUID of associated contact" },
      },
      required: ["leadEmail"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "update_deal",
    description:
      "Change a deal's status, value, or notes. " +
      "\n\n" +
      "Only the fields you pass are altered. For moving a deal along the pipeline board " +
      "prefer move_deal_stage, which is the same operation expressed in stage terms; use " +
      "this one for value and notes. Setting status to 'closed' or 'lost' marks the deal " +
      "resolved and takes it out of open pipeline revenue. " +
      "\n\n" +
      "Safe to repeat — the same call twice leaves the same deal. Requires an API key, and " +
      "the account must own the deal. `value` is in MINOR CURRENCY UNITS (2500 = $25.00). " +
      "Notes REPLACE the existing note rather than appending. ",
    inputSchema: {
      type: "object",
      properties: {
        dealId: { type: "string", description: "Deal UUID" },
        status: {
          type: "string",
          enum: ["interested", "meeting", "proposal", "closed", "lost"],
          description: "New deal status",
        },
        value: { type: "number", description: "Updated deal value in minor currency units" },
        notes: { type: "string", description: "Updated deal notes (max 5000 chars)" },
      },
      required: ["dealId"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_pipeline",
    description:
      "Get the sales pipeline as a board: deals grouped by stage, with revenue totals. " +
      "\n\n" +
      "Use this for 'how does the pipeline look' questions and stage-by-stage review. It is " +
      "the board view of the same deals list_deals returns flat — reach for that one when " +
      "you need filtering or paging, since this returns the whole board. " +
      "\n\n" +
      "Reads only. Requires an API key. Stages are new, contacted, interested, meeting, " +
      "proposal, closed and lost. Money is in minor currency units (cents), so divide by " +
      "100 before showing it. ",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string", description: "Optional workspace UUID to filter pipeline" },
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
    name: "move_deal_stage",
    description:
      "Move one deal to a different pipeline stage — the equivalent of dragging its card on " +
      "the board. " +
      "\n\n" +
      "This is the tool for pipeline progression; update_deal is for value and notes. " +
      "Moving to 'closed' or 'lost' resolves the deal and removes it from open pipeline " +
      "revenue, which changes reported figures — only do it when the user says the outcome " +
      "is settled. " +
      "\n\n" +
      "Safe to repeat: moving a deal to the stage it is already in changes nothing. Stages " +
      "are not ordered by this call, so it can move a deal backwards as easily as forwards. " +
      "Requires an API key. ",
    inputSchema: {
      type: "object",
      properties: {
        dealId: { type: "string", description: "Deal UUID" },
        newStage: {
          type: "string",
          enum: ["new", "contacted", "interested", "meeting", "proposal", "closed", "lost"],
          description: "Target stage",
        },
      },
      required: ["dealId", "newStage"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
];

/** Dispatch one deal tool call. */
export async function handleDealTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "list_deals": {
      const params = new URLSearchParams();
      if (args.status) params.set("status", String(args.status));
      if (args.limit)  params.set("limit", String(args.limit));
      if (args.offset) params.set("offset", String(args.offset));
      const data = await apiFetch(`/deals?${params}`);
      return JSON.stringify(data, null, 2);
    }
    case "create_deal": {
      const data = await apiFetch("/deals", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return JSON.stringify(data, null, 2);
    }
    case "update_deal": {
      const { dealId, ...body } = args;
      const data = await apiFetch(`/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      return JSON.stringify(data, null, 2);
    }
    case "get_pipeline": {
      const params = new URLSearchParams();
      if (args.workspaceId) params.set("workspaceId", String(args.workspaceId));
      const data = await apiFetch(`/pipeline?${params}`);
      return JSON.stringify(data, null, 2);
    }
    case "move_deal_stage": {
      const data = await apiFetch("/pipeline", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return JSON.stringify(data, null, 2);
    }
    default:
      throw new Error(`Unknown deal tool: ${name}`);
  }
}
