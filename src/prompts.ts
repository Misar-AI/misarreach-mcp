/**
 * Reusable prompt templates exposed over MCP `prompts/list` / `prompts/get`.
 *
 * TEMPLATES, executed by the calling client's model — never server-side
 * completions. Blog's original prompts called an inference API on every
 * `prompts/get`, spending credits on text the client could not steer and
 * failing outright on stdio where no inference credential exists.
 *
 * Every tool named below is a real tool in `src/tools/`.
 */

/** One argument a prompt accepts. */
export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
}

/** A prompt template: its metadata plus the builder that renders it. */
export interface PromptDefinition {
  name: string;
  description: string;
  arguments: PromptArgument[];
  build: (args: Record<string, string>) => string;
}

/** Every prompt this server exposes. */
export const PROMPTS: PromptDefinition[] = [
  {
    name: "build_lead_list",
    description: "Find, enrich, verify and score a target lead list before any outreach.",
    arguments: [
      { name: "icp", description: "Ideal customer profile — industry, size, geography, role", required: true },
      { name: "count", description: "How many leads to target (default 50)", required: false },
    ],
    build: (a) =>
      `Build a lead list for this ICP: ${a.icp}\\n` +
      `Target size: ${a.count || "50"}.\\n\\n` +
      "1. Call discover_companies to find matching companies.\\n" +
      "2. Call search_leads for contacts at those companies, then get_search_job_status until it completes.\\n" +
      "3. Call enrich_lead on the results, then verify_emails — never send to unverified addresses.\\n" +
      "4. Call score_leads and report the score distribution.\\n" +
      "5. Call create_lead_list to save the qualified set.\\n\\n" +
      "Report how many were found, verified, and qualified, and be explicit about " +
      "how many were dropped and why. Do NOT start outreach — that needs my approval.",
  },
  {
    name: "outreach_sequence",
    description: "Design and preview a multi-channel sequence, sending only after approval.",
    arguments: [
      { name: "list_id", description: "Lead list to target", required: false },
      { name: "goal", description: "What the sequence should achieve", required: true },
    ],
    build: (a) =>
      `Design a multi-channel outreach sequence for: ${a.goal}\\n` +
      `${a.list_id ? `Target list: ${a.list_id}\\n` : ""}\\n` +
      "1. Call list_lead_lists (and list_leads) to confirm the audience and its size.\\n" +
      "2. Call get_channels_status — only use channels that are actually connected.\\n" +
      "3. Draft the sequence, then call preview_message for EACH step and show me every preview.\\n\\n" +
      "Wait for my explicit approval. Only then call send_to_campaign. " +
      "Sending is irreversible and reaches real people — never call it to 'test'.",
  },
  {
    name: "pipeline_review",
    description: "Review deal pipeline health and recommend the next actions.",
    arguments: [{ name: "period", description: "Time window, e.g. 30d", required: false }],
    build: (a) =>
      `Review my sales pipeline for the last ${a.period || "30d"}.\\n\\n` +
      "Call get_pipeline and list_deals. Report value by stage, deals that have not " +
      "moved, and win rate.\\n\\n" +
      "Recommend the three highest-impact next actions, each naming a specific deal. " +
      "Do not call move_deal_stage or update_deal without my approval — stage changes " +
      "drive reporting and automations.",
  },
  {
    name: "autopilot_audit",
    description: "Check what autopilot has been doing and whether it should keep running.",
    arguments: [],
    build: () =>
      "Audit my MisarReach autopilot.\\n\\n" +
      "Call get_autopilot_status and list_autopilot_runs. Report what it has sent, " +
      "reply and bounce rates, and anything that looks wrong.\\n\\n" +
      "If bounce or complaint rates are unhealthy, say so plainly and recommend pausing. " +
      "Do not call start_autopilot without my explicit approval.",
  },
  {
    name: "sales_agent_tuning",
    description: "Review the AI sales agent's configuration and recent actions.",
    arguments: [],
    build: () =>
      "Review my AI sales agent.\\n\\n" +
      "Call get_sales_agent_config and get_sales_agent_actions. Summarise what it is " +
      "configured to do and what it actually did.\\n\\n" +
      "Flag any action you would not have taken and explain why. Propose config changes " +
      "as a diff and wait for approval before calling update_sales_agent_config.",
  },
];

const BY_NAME = new Map(PROMPTS.map((p) => [p.name, p]));

/** One prompt as advertised by `prompts/list`. */
export interface PromptSummary {
  /** Prompt id to pass to {@link getPrompt}. */
  name: string;
  /** What the prompt is for. */
  description: string;
  /** Arguments it accepts, and which are required. */
  arguments: Array<{ name: string; description: string; required?: boolean }>;
}

/** A rendered prompt, as returned by `prompts/get`. */
export interface RenderedPrompt {
  /** What the prompt is for. */
  description: string;
  /** The messages to seed the conversation with. */
  messages: Array<{ role: "user"; content: { type: "text"; text: string } }>;
  /**
   * The SDK's result union is an open record, so this has to stay indexable to
   * remain assignable to it — naming the type is what JSR needs, not sealing it.
   */
  [key: string]: unknown;
}

/** Every prompt this server exposes, as `prompts/list` returns them. */
export function listPrompts(): PromptSummary[] {
  return PROMPTS.map(({ name, description, arguments: args }) => ({ name, description, arguments: args }));
}

/** Render one prompt by name, or null when no such prompt exists. */
export function getPrompt(name: string, args: Record<string, string> = {}): RenderedPrompt | null {
  const prompt = BY_NAME.get(name);
  if (!prompt) return null;
  return {
    description: prompt.description,
    messages: [{ role: "user" as const, content: { type: "text" as const, text: prompt.build(args) } }],
  };
}
