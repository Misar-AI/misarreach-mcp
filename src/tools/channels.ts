import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiFetch } from "../lib/api-client.js";

export const channelTools: Tool[] = [
  {
    name: "get_channels_status",
    description:
      "Get the status, configuration, and delivery stats for all outreach channels (WhatsApp, SMS, push notifications).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "update_channel",
    description: "Enable or disable a specific outreach channel (whatsapp, sms, or push).",
    inputSchema: {
      type: "object",
      properties: {
        channel: {
          type: "string",
          enum: ["whatsapp", "sms", "push"],
          description: "Channel to update",
        },
        enabled: { type: "boolean", description: "Whether to enable (true) or disable (false) the channel" },
      },
      required: ["channel", "enabled"],
    },
  },
];

export async function handleChannelTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "get_channels_status": {
      const data = await apiFetch("/channels/status");
      return JSON.stringify(data, null, 2);
    }
    case "update_channel": {
      const data = await apiFetch("/channels/status", {
        method: "PATCH",
        body: JSON.stringify(args),
      });
      return JSON.stringify(data, null, 2);
    }
    default:
      throw new Error(`Unknown channel tool: ${name}`);
  }
}
