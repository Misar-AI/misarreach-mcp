import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiFetch } from "../lib/api-client.js";

export const autopilotTools: Tool[] = [
  {
    name: "start_autopilot",
    description:
      "Start an autonomous outreach run: give the agent a goal and it finds, contacts and " +
      "follows up with leads on its own. " +
      "\n\n" +
      "This is the most consequential tool on this server. It is FIRE-AND-FORGET and it " +
      "SENDS REAL MESSAGES TO REAL PEOPLE without returning for approval, so only start a " +
      "run when the user has explicitly asked for one and understands the goal as written — " +
      "the goal text is the entire brief. It returns a runId immediately; watch progress " +
      "with get_autopilot_status. " +
      "\n\n" +
      "CONSUMES AUTOPILOT CREDITS, plus search, enrichment and AI credits as it works. " +
      "Requires an API key. Each call starts a SEPARATE run — calling twice runs two " +
      "campaigns concurrently against the same goal. ",
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
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "list_autopilot_runs",
    description:
      "List past and running autopilot runs with their status and result summaries. " +
      "\n\n" +
      "Use it to review what has already been run — and to check for a run already in " +
      "flight before start_autopilot launches a second one against the same goal. For " +
      "detail on one run, use get_autopilot_status. " +
      "\n\n" +
      "Reads only, costs no credits, and starts nothing. Requires an API key. Returns runs " +
      "newest first with paging. ",
    inputSchema: {
      type: "object",
      properties: {
        limit:  { type: "number", description: "Max results (default 20)" },
        offset: { type: "number", description: "Pagination offset" },
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
    name: "get_autopilot_status",
    description:
      "Get the current progress and results of one autopilot run. " +
      "\n\n" +
      "This is how you follow a run started by start_autopilot: call it with the runId, " +
      "leaving time between polls. Reading status does not pause, stop, or alter the run in " +
      "any way — it keeps going regardless, and there is no tool here to stop it. " +
      "\n\n" +
      "Reads only and costs no credits, however often you call it. Requires an API key. A " +
      "run still in progress is a normal answer, not an error. ",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Autopilot run UUID" },
      },
      required: ["runId"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
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
