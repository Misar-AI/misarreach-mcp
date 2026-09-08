#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { dispatch, listTools, resolveTool, UnknownToolError } from "./registry.js";
import { listPrompts, getPrompt } from "./prompts.js";
import { listResources, readResource } from "./resources.js";
import { authTools, handleAuthTool } from "./tools/auth.js";
import { formatError } from "./lib/errors.js";

const AUTH_TOOL_NAMES = new Set(authTools.map((t) => t.name));

export const SERVER_NAME = "misarreach";
export const SERVER_VERSION = "2.0.0";

function buildServer(): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {}, prompts: {}, resources: {} } },
  );

  // Discovery handlers NEVER touch credentials. Gating them is what left
  // MisarMail's registry listing frozen at a stale 16-tool snapshot: scanners
  // run with no key, so a server that refuses (or exits) never gets catalogued.
  // Auth tools are stdio-only: they drive the local browser and filesystem.
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...listTools(), ...authTools],
  }));
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: listPrompts() }));
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: listResources() }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const result = getPrompt(request.params.name, request.params.arguments ?? {});
    if (!result) throw new Error(`Prompt not found: ${request.params.name}`);
    return result;
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const result = await readResource(request.params.uri);
    if (!result) throw new Error(`Resource not found: ${request.params.uri}`);
    return result;
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
      // Resolve the tool before anything reads credentials, so a mistyped name
      // reports "Unknown tool" rather than an authentication failure — which
      // would send the user to fix their key instead of their typo.
      // Auth tools run BEFORE any credential exists, so they must not go
      // through the credential-reading dispatch path.
      if (AUTH_TOOL_NAMES.has(name)) {
        const text = await handleAuthTool(name, args as Record<string, unknown>);
        return { content: [{ type: "text" as const, text }] };
      }

      if (!resolveTool(name)) throw new UnknownToolError(name);
      const text = await dispatch(name, args as Record<string, unknown>);
      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${formatError(err)}` }],
        isError: true,
      };
    }
  });

  return server;
}

/** Entry point used by Smithery's sandbox scanner, which imports rather than execs. */
export function createSandboxServer(): Server {
  return buildServer();
}

async function main() {
  const server = buildServer();
  await server.connect(new StdioServerTransport());
}

/**
 * Auto-start only on a direct run.
 *
 * The previous version connected the transport at module top level, so merely
 * importing this file started a server on stdio — which breaks any scanner or
 * test that imports the module to enumerate tools.
 */
const argv1 = process.argv[1] ?? "";
if (argv1.endsWith("index.ts") || argv1.endsWith("index.js") || argv1.endsWith("misarreach-mcp")) {
  main().catch((err) => {
    console.error("MCP server error:", formatError(err));
    process.exit(1);
  });
}

export { ALL_TOOLS, dispatch, listTools, resolveTool, UnknownToolError } from "./registry.js";
export { PROMPTS, listPrompts, getPrompt } from "./prompts.js";
export { RESOURCES, listResources, readResource } from "./resources.js";
export { httpContext, runWithContext, type ReachContext } from "./lib/context.js";
export { createReachHttpHandler, corsPreflight } from "./http.js";
