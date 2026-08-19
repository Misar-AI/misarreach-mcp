import { apiFetch } from "./lib/api-client.js";

/**
 * MCP resources — read-only context a client can attach directly, without
 * spending a tool call. Kept small: some clients fetch every resource eagerly,
 * so anything large or paginated belongs in a tool.
 */

/** A readable resource: its metadata plus the reader that fetches it. */
export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  read: () => Promise<unknown>;
}

/** Every resource this server exposes. */
export const RESOURCES: ResourceDefinition[] = [
  {
    uri: "misarreach://channels",
    name: "Connected channels",
    description:
      "Which outreach channels are connected and healthy. Read this before designing any sequence — a step on a disconnected channel silently never sends.",
    mimeType: "application/json",
    read: () => apiFetch("/channels"),
  },
  {
    uri: "misarreach://lead-lists",
    name: "Lead lists",
    description: "Your saved lead lists with sizes, so a campaign targets a real audience.",
    mimeType: "application/json",
    read: () => apiFetch("/lead-lists"),
  },
  {
    uri: "misarreach://pipeline",
    name: "Deal pipeline",
    description: "Current pipeline by stage — the baseline for any performance question.",
    mimeType: "application/json",
    read: () => apiFetch("/deals/pipeline"),
  },
  {
    uri: "misarreach://autopilot/status",
    name: "Autopilot status",
    description: "Whether autopilot is running, and its current sending posture.",
    mimeType: "application/json",
    read: () => apiFetch("/autopilot/status"),
  },
];

const BY_URI = new Map(RESOURCES.map((r) => [r.uri, r]));

/** One resource as advertised by `resources/list`. */
export interface ResourceSummary {
  /** URI to pass to {@link readResource}. */
  uri: string;
  /** Human-readable name. */
  name: string;
  /** What the resource contains. */
  description: string;
  /** MIME type of the contents. */
  mimeType: string;
}

/** The contents of one resource, as returned by `resources/read`. */
export interface ResourceReadResult {
  /** One block per resource; text blocks carry JSON. */
  contents: Array<{ uri: string; mimeType: string; text: string }>;
  /**
   * The SDK's result union is an open record, so this has to stay indexable to
   * remain assignable to it — naming the type is what JSR needs, not sealing it.
   */
  [key: string]: unknown;
}

/** Every resource this server exposes, as `resources/list` returns them. */
export function listResources(): ResourceSummary[] {
  return RESOURCES.map(({ uri, name, description, mimeType }) => ({ uri, name, description, mimeType }));
}

/** Read one resource by URI, or null when no such resource exists. */
export async function readResource(uri: string): Promise<ResourceReadResult | null> {
  const resource = BY_URI.get(uri);
  if (!resource) return null;
  return {
    contents: [{ uri, mimeType: resource.mimeType, text: JSON.stringify(await resource.read(), null, 2) }],
  };
}
