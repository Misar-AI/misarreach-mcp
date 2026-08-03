import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiFetch } from "../lib/api-client.js";

export const autopilotTools: Tool[] = [
  {
    name: "start_autopilot",
    description:
      "Start an AI autopilot run for outreach automation. Provide a goal and the agent runs fire-and-forget. Returns runId — poll get_autopilot_status for progress. Consumes autopilot credits.",
    inputSchema: {
      type: "object",
      properties: {
        goal: {
          type: "string",
          description: "Outreach goal description (10-500 chars). E.g. 'Find and email 10 SaaS startup CTOs in London about our product'",
        },
        workspace_id: {
          type: "string",
          description: "Optional workspace UUID to associate with this run",
        },
      },
      required: ["goal"],
    },
  },
  {
    name: "list_autopilot_runs",
    description: "List past autopilot runs with their status and summary results.",
    inputSchema: {
      type: "object",
      properties: {
        limit:  { type: "number", description: "Max results (default 20)" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
  },
  {
    name: "get_autopilot_status",
    description: "Get the current status and progress of a specific autopilot run.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Autopilot run UUID" },
      },
      required: ["runId"],
    },
  },
];

export async function handleAutopilotTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "start_autopilot": {
      const data = await apiFetch("/autopilot/start", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return JSON.stringify(data, null, 2);
    }
    case "list_autopilot_runs": {
      const params = new URLSearchParams();
      if (args.limit)  params.set("limit", String(args.limit));
      if (args.offset) params.set("offset", String(args.offset));
      const data = await apiFetch(`/autopilot/runs?${params}`);
      return JSON.stringify(data, null, 2);
    }
    case "get_autopilot_status": {
      const data = await apiFetch(`/autopilot/${args.runId}/status`);
      return JSON.stringify(data, null, 2);
    }
    default:
      throw new Error(`Unknown autopilot tool: ${name}`);
  }
}
