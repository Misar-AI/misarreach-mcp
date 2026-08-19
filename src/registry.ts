/**
 * The MisarReach tool catalogue.
 *
 * Every tool the server exposes is registered here once and dispatched by name,
 * so both transports advertise and run exactly the same set.
 *
 * @module
 */
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import { leadTools, handleLeadTool } from "./tools/leads.js";
import { dealTools, handleDealTool } from "./tools/deals.js";
import { autopilotTools, handleAutopilotTool } from "./tools/autopilot.js";
import { channelTools, handleChannelTool } from "./tools/channels.js";
import { salesAgentTools, handleSalesAgentTool } from "./tools/salesAgent.js";

/**
 * The single source of truth for MisarReach's MCP surface.
 *
 * Both transports build their catalogue from here — the stdio binary today and
 * the hosted HTTP endpoint when `api.misar.io/reach/mcp` ships. Mail and blog
 * each drifted into multiple divergent implementations before they were
 * consolidated; starting reach with one registry avoids repeating it.
 */
export const ALL_TOOLS: Tool[] = [
  ...leadTools,
  ...dealTools,
  ...autopilotTools,
  ...channelTools,
  ...salesAgentTools,
];

type Handler = (name: string, args: Record<string, unknown>) => Promise<string>;

/** Which handler owns which tool, derived from each group's own declaration. */
const HANDLERS: Array<[Tool[], Handler]> = [
  [leadTools, handleLeadTool],
  [dealTools, handleDealTool],
  [autopilotTools, handleAutopilotTool],
  [channelTools, handleChannelTool],
  [salesAgentTools, handleSalesAgentTool],
];

const BY_NAME = new Map<string, Handler>();
for (const [tools, handler] of HANDLERS) {
  for (const tool of tools) BY_NAME.set(tool.name, handler);
}

/** Thrown when `tools/call` names a tool that does not exist. */
export class UnknownToolError extends Error {
  constructor(name: string) {
    super(`Unknown tool: ${name}`);
    this.name = "UnknownToolError";
  }
}

/** Look up a tool by name, following legacy aliases. */
export function resolveTool(name: string): Tool | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}

/** The advertised catalogue, in MCP `tools/list` wire shape. */
export function listTools(): Tool[] {
  return ALL_TOOLS;
}

/**
 * Run a tool by name.
 *
 * Resolves the tool BEFORE credentials are touched, so a mistyped name reports
 * "Unknown tool" rather than an authentication failure — otherwise an
 * unauthenticated user gets sent to fix their key instead of their typo.
 */
export async function dispatch(name: string, args: Record<string, unknown>): Promise<string> {
  const handler = BY_NAME.get(name);
  if (!handler) throw new UnknownToolError(name);
  return handler(name, args);
}
