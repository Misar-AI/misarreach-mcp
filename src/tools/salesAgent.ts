import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiFetch } from "../lib/api-client.js";

export const salesAgentTools: Tool[] = [
  {
    name: "get_sales_agent_config",
    description:
      "Fetch the AI sales agent's current settings: whether it is enabled, its booking " +
      "link, offer price, reply limits and confidence threshold. " +
      "\n\n" +
      "Read this before update_sales_agent_config so you change one field without " +
      "clobbering the rest, and to check whether the agent is enabled at all before " +
      "expecting it to act. " +
      "\n\n" +
      "Reads only, takes no parameters, changes nothing. Requires an API key. Returns the " +
      "configuration for the authenticated account. ",
    inputSchema: {
      type: "object",
      properties: {},
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "update_sales_agent_config",
    description:
      "Change the AI sales agent's settings — enable or disable it, set the booking link, " +
      "offer price, reply limits and confidence threshold. " +
      "\n\n" +
      "These settings govern an agent that replies to real prospects, so treat them as " +
      "live: ENABLING it lets it start responding on its own, the confidence threshold " +
      "decides how sure it must be before acting, and reply limits cap how much it can " +
      "send. Read the current config first — only the fields you pass change, but a wrong " +
      "value takes effect immediately. " +
      "\n\n" +
      "Safe to repeat. Requires an API key. ",
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
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_sales_agent_actions",
    description:
      "Get what the AI sales agent has done today, with summary stats — actions taken, " +
      "deals created, replies sent. " +
      "\n\n" +
      "This is the audit trail: use it to see what the agent did on the account's behalf, " +
      "and to sanity-check its behaviour after enabling it. Covers TODAY only, so it is not " +
      "the tool for historical reporting. " +
      "\n\n" +
      "Reads only and changes nothing; it does not approve or undo any action. Requires an " +
      "API key. No actions today is a normal answer, not an error. ",
    inputSchema: {
      type: "object",
      properties: {},
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "process_sales_agent",
    description:
      "Run the sales-agent pipeline over one conversation: decide the next action and carry " +
      "it out. " +
      "\n\n" +
      "This ACTS on a real conversation — depending on what it decides, it can reply to the " +
      "prospect, create a deal, or book a meeting. It is not a dry run and there is no " +
      "preview, so call it only when the user wants the agent to take its turn on that " +
      "specific conversation. For what it has already done, use get_sales_agent_actions. " +
      "\n\n" +
      "CONSUMES AI CREDITS. Not idempotent: calling twice processes the conversation twice " +
      "and can send two messages. Requires an API key, and the agent's configured " +
      "confidence threshold still governs whether it acts. ",
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
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
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
