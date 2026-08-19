import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiFetch } from "../lib/api-client.js";

/** Outreach channel status and enablement (WhatsApp, SMS, push). */
export const channelTools: Tool[] = [
  {
    name: "get_channels_status",
    description:
      "Report the configuration, connection state and delivery stats for every outreach " +
      "channel — WhatsApp, SMS and push. " +
      "\n\n" +
      "Check this before relying on a channel: a disabled or unconfigured one silently " +
      "delivers nothing. It is also the natural first step before update_channel, so you " +
      "know the current state rather than toggling blind. " +
      "\n\n" +
      "Reads only, takes no parameters, and changes nothing. Requires an API key. Returns " +
      "each channel with whether it is enabled, whether credentials are configured, and " +
      "recent delivery counts. ",
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
    name: "update_channel",
    description:
      "Turn one outreach channel on or off — WhatsApp, SMS or push. " +
      "\n\n" +
      "This changes how the account actually delivers messages, so it affects live " +
      "campaigns and autopilot runs, not just future ones. DISABLING a channel silently " +
      "stops delivery over it; enabling one that has no credentials configured will not " +
      "make it work. Call get_channels_status first to see where things stand. " +
      "\n\n" +
      "Handles one channel per call. Safe to repeat: setting a channel to the state it is " +
      "already in changes nothing. Requires an API key. ",
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
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
];

/** Dispatch one channel tool call. */
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
