import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiFetch } from "../lib/api-client.js";

export const dealTools: Tool[] = [
  {
    name: "list_deals",
    description:
      "List deals with optional status filter. Returns deals array plus revenue summary (total, closed, pipeline).",
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
  },
  {
    name: "create_deal",
    description: "Create a new deal linked to a lead email.",
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
  },
  {
    name: "update_deal",
    description: "Update a deal's status, value, or notes.",
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
  },
  {
    name: "get_pipeline",
    description:
      "Get the full sales pipeline board with deals grouped by stage (new, contacted, interested, meeting, proposal, closed, lost) plus revenue totals.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string", description: "Optional workspace UUID to filter pipeline" },
      },
    },
  },
  {
    name: "move_deal_stage",
    description: "Move a deal to a new pipeline stage (drag-and-drop equivalent).",
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
  },
];

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
