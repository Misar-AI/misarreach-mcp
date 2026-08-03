import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiFetch } from "../lib/api-client.js";

export const salesAgentTools: Tool[] = [
  {
    name: "get_sales_agent_config",
    description: "Fetch the current user's AI sales agent configuration.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "update_sales_agent_config",
    description:
      "Update the AI sales agent configuration (enable/disable, cal link, offer price, reply limits, confidence threshold).",
    inputSchema: {
      type: "object",
      properties: {
        enabled: { type: "boolean", description: "Enable or disable the sales agent" },
        cal_link: {
          type: "string",
          description: "Calendly or Cal.com URL for meeting booking (max 500 chars, set null to clear)",
        },
        offer_price: {
          type: "number",
          description: "Offer price in minor currency units (integer, min 0)",
        },
        offer_description: {
          type: "string",
          description: "Short description of the offer (max 1000 chars, set null to clear)",
        },
        max_replies_per_day: {
          type: "number",
          description: "Maximum automated replies per day (1-500, default 20)",
        },
        confidence_threshold: {
          type: "number",
          description: "Confidence score below which agent flags for human review (0.0-1.0, default 0.65)",
        },
      },
    },
  },
  {
    name: "get_sales_agent_actions",
    description:
      "Fetch today's AI sales agent actions and summary stats (total actions, deals closed, flagged for human review).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "process_sales_agent",
    description:
      "Run the AI sales agent pipeline on a conversation — decides the next action and optionally generates a reply. Logs the action to the agent activity feed.",
    inputSchema: {
      type: "object",
      properties: {
        conversationId: {
          type: "string",
          description: "UUID of the conversation to process",
        },
      },
      required: ["conversationId"],
    },
  },
];

export async function handleSalesAgentTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "get_sales_agent_config": {
      const data = await apiFetch("/sales-agent/config");
      return JSON.stringify(data, null, 2);
    }
    case "update_sales_agent_config": {
      const data = await apiFetch("/sales-agent/config", {
        method: "PATCH",
        body: JSON.stringify(args),
      });
      return JSON.stringify(data, null, 2);
    }
    case "get_sales_agent_actions": {
      const data = await apiFetch("/sales-agent/actions");
      return JSON.stringify(data, null, 2);
    }
    case "process_sales_agent": {
      const data = await apiFetch("/sales-agent/process", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return JSON.stringify(data, null, 2);
    }
    default:
      throw new Error(`Unknown sales agent tool: ${name}`);
  }
}
