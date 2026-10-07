/**
 * Tool annotations are what directory scanners and app-store review read to
 * decide whether a tool needs the user's confirmation before it runs. An
 * under-declared write (a tool that overwrites, resolves or sends, marked
 * `destructiveHint: false`) is a review failure — score_leads and update_deal
 * were flagged for exactly that. These tests pin the hints to what each
 * handler and the API route behind it actually do.
 */
import { describe, expect, it } from "vitest";
import { listTools } from "../../src/registry.js";
import { authTools } from "../../src/tools/auth.js";

const HINTS = ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"] as const;
const byName = new Map([...listTools(), ...authTools].map((t) => [t.name, t]));
const hints = (name: string) => {
  const tool = byName.get(name);
  if (!tool) throw new Error(`no tool ${name}`);
  return tool.annotations!;
};

describe("tool annotations", () => {
  it("every tool declares a title and all four hints as booleans", () => {
    for (const tool of byName.values()) {
      expect(tool.annotations?.title, tool.name).toBeTruthy();
      for (const h of HINTS) expect(typeof tool.annotations?.[h], `${tool.name}.${h}`).toBe("boolean");
    }
  });

  it("a read-only tool is never also destructive", () => {
    for (const tool of byName.values()) {
      if (tool.annotations?.readOnlyHint) expect(tool.annotations.destructiveHint, tool.name).toBe(false);
    }
  });

  // Overwrites stored data, resolves business state, or sets off outreach that
  // cannot be called back.
  const DESTRUCTIVE = [
    "score_leads",
    "update_deal",
    "move_deal_stage",
    "send_to_campaign",
    "sync_lead_list",
    "enrich_lead",
    "verify_emails",
    "verify_email",
    "update_channel",
    "update_sales_agent_config",
    "start_autopilot",
    "process_sales_agent",
    "logout",
  ];

  it.each(DESTRUCTIVE)("%s is a destructive write", (name) => {
    expect(hints(name).readOnlyHint).toBe(false);
    expect(hints(name).destructiveHint).toBe(true);
  });

  it("anything not listed as destructive is additive or read-only", () => {
    for (const tool of byName.values()) {
      if (!DESTRUCTIVE.includes(tool.name)) expect(tool.annotations?.destructiveHint, tool.name).toBe(false);
    }
  });

  it.each(["send_to_campaign", "start_autopilot", "process_sales_agent", "move_deal_stage"])(
    "%s reaches outside the account",
    (name) => expect(hints(name).openWorldHint).toBe(true),
  );

  it.each(["update_deal", "move_deal_stage", "score_leads", "start_autopilot", "process_sales_agent"])(
    "%s is not idempotent",
    (name) => expect(hints(name).idempotentHint).toBe(false),
  );
});
