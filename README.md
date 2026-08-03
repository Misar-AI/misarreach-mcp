# MisarReach MCP Server

> Find leads, enrich and score them, run multi-channel outreach, and manage the sales pipeline — from any AI assistant.

[![npm](https://img.shields.io/npm/v/@misarreach/mcp)](https://www.npmjs.com/package/@misarreach/mcp)
[![smithery](https://img.shields.io/badge/smithery-misar%2Fmisarreach--mcp-blue)](https://smithery.ai/server/misar/misarreach-mcp)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

**27 tools · 5 prompts · 4 resources · 4 agent skills**

Works with Claude (Desktop, Code, and web), Cursor, VS Code, Windsurf, Cline,
Zed, Gemini CLI, ChatGPT, and any other MCP-compatible client — over stdio or
Streamable HTTP.

---

## Install

### Smithery (recommended)

```bash
npx -y @smithery/cli install misar/misarreach-mcp --client claude
```

### Claude Code

```bash
claude mcp add misarreach -- npx -y @misarreach/mcp@latest
```

### Manual (any client)

```json
{
  "mcpServers": {
    "misarreach": {
      "command": "npx",
      "args": ["-y", "@misarreach/mcp@latest"],
      "env": { "MISARREACH_API_KEY": "mrk_your_key_here" }
    }
  }
}
```

Ready-made configs for every client live in [`connectors/`](./connectors).

### Remote (no install)

```json
{
  "mcpServers": {
    "misarreach": {
      "type": "streamable-http",
      "url": "https://api.misar.io/reach/mcp",
      "headers": { "Authorization": "Bearer mrk_your_key_here" }
    }
  }
}
```

---

## Authentication

Two options — no copy-paste needed for the first:

1. **Browser login.** Start the server with no key and run the `login` tool.
   It opens the MisarReach consent screen, you review the requested
   permissions, and the key is delivered straight back and saved to
   `~/.misarreach/config.json`.
2. **API key.** Create one at https://reach.misar.io/settings/api-keys and set `MISARREACH_API_KEY`.

Self-hosted instances: set `MISARREACH_BASE_URL`.

---

## Tools

| Tool | Description |
| --- | --- |
| `list_leads` | List saved leads for the authenticated user. |
| `search_leads` | Start an AI-powered lead search job. |
| `get_search_job_status` | Poll the status and results of a lead search job.. |
| `submit_lead_feedback` | Submit positive or negative feedback on an AI-generated lead message to improve future output quality.. |
| `discover_companies` | Discover companies matching criteria via Hunter.io. |
| `enrich_lead` | Enrich a lead with person and company data (seniority, department, LinkedIn, phone, company size, industry). |
| `verify_emails` | Verify email deliverability for one or more email addresses. |
| `score_leads` | Trigger on-demand AI scoring for all unscored leads in a job, or a specific set of lead IDs. |
| `list_lead_lists` | List Hunter.io lead lists associated with the account.. |
| `create_lead_list` | Create a new Hunter.io lead list.. |
| `sync_lead_list` | Sync a Hunter.io lead list into local lead records.. |
| `preview_message` | Generate a sample AI-personalised outreach message for a person. |
| `send_to_campaign` | Bulk-import selected lead IDs into a campaign's contact list. |
| `list_deals` | List deals with optional status filter. |
| `create_deal` | Create a new deal linked to a lead email.. |
| `update_deal` | Update a deal's status, value, or notes.. |
| `get_pipeline` | Get the full sales pipeline board with deals grouped by stage (new, contacted, interested, meeting, proposal, closed, lost) plus revenue totals.. |
| `move_deal_stage` | Move a deal to a new pipeline stage (drag-and-drop equivalent).. |
| `start_autopilot` | Start an AI autopilot run for outreach automation. |
| `list_autopilot_runs` | List past autopilot runs with their status and summary results.. |
| `get_autopilot_status` | Get the current status and progress of a specific autopilot run.. |
| `get_channels_status` | Get the status, configuration, and delivery stats for all outreach channels (WhatsApp, SMS, push notifications).. |
| `update_channel` | Enable or disable a specific outreach channel (whatsapp, sms, or push).. |
| `get_sales_agent_config` | Fetch the current user's AI sales agent configuration.. |
| `update_sales_agent_config` | Update the AI sales agent configuration (enable/disable, cal link, offer price, reply limits, confidence threshold).. |
| `get_sales_agent_actions` | Fetch today's AI sales agent actions and summary stats (total actions, deals closed, flagged for human review).. |
| `process_sales_agent` | Run the AI sales agent pipeline on a conversation — decides the next action and optionally generates a reply. |

## Prompts

Reusable workflows your client exposes as slash-commands.

| Prompt | Description |
| --- | --- |
| `build_lead_list` | Find, enrich, verify and score a target lead list before any outreach. |
| `outreach_sequence` | Design and preview a multi-channel sequence, sending only after approval. |
| `pipeline_review` | Review deal pipeline health and recommend the next actions. |
| `autopilot_audit` | Check what autopilot has been doing and whether it should keep running. |
| `sales_agent_tuning` | Review the AI sales agent's configuration and recent actions. |

## Resources

Read-only context an agent can attach without spending a tool call.

| URI | Description |
| --- | --- |
| `misarreach://channels` | Which outreach channels are connected and healthy. |
| `misarreach://lead-lists` | Your saved lead lists with sizes, so a campaign targets a real audience.. |
| `misarreach://pipeline` | Current pipeline by stage — the baseline for any performance question.. |
| `misarreach://autopilot/status` | Whether autopilot is running, and its current sending posture.. |

## Agent skills

Bundled in [`skills/`](./skills) — guidance an agent loads when a task matches.

| Skill | Use when |
| --- | --- |
| `audit-autopilot-and-agent` | Check what MisarReach autopilot and the AI sales agent have been doing, and whether they should keep running. Use when asked to review automation, autopilot, or agent behaviour. |
| `build-and-qualify-a-lead-list` | Find companies matching an ICP, enrich and verify the contacts, score them, and save a qualified list. Use when asked to find leads, build a prospect list, or research a target market in MisarReach. |
| `review-the-sales-pipeline` | Report deal pipeline health and recommend next actions. Use when asked about deals, pipeline, forecast, or sales performance in MisarReach. |
| `run-an-outreach-sequence` | Design, preview and send a multi-channel outreach sequence. Use when asked to run a campaign, start outreach, or message a lead list in MisarReach. |

---

## Safety

Destructive and irreversible actions are annotated (`destructiveHint`) so
clients can prompt before running them. The skills instruct agents to confirm
before anything that sends mail, publishes content, or is otherwise visible to
other people.

Discovery (`initialize`, `tools/list`, `prompts/list`, `resources/list`)
never requires credentials, so registries can index the server without one.
Every action does.

---

## Links

- Website — https://www.misarreach.com
- App — https://reach.misar.io
- Documentation — https://docs.misar.io/reach/mcp
- Smithery — https://smithery.ai/server/misar/misarreach-mcp
- npm — https://www.npmjs.com/package/@misarreach/mcp
- Source — https://github.com/mrgulshanyadav/misarreach-mcp

MIT © [Misar AI](https://misar.io)
