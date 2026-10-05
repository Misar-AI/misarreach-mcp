# MisarReach MCP Server

> Find leads, enrich and score them, run multi-channel outreach, and manage the sales pipeline — from any AI assistant.

[![npm](https://img.shields.io/npm/v/@misarreach/mcp)](https://www.npmjs.com/package/@misarreach/mcp)
[![smithery](https://img.shields.io/badge/smithery-misar%2Fmisarreach--mcp-blue)](https://smithery.ai/server/misar/misarreach-mcp)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

**31 tools · 5 prompts · 4 resources · 4 agent skills**

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
| `list_leads` | List leads already saved to the account, newest first, with paging and search. |
| `search_leads` | Start an AI lead-search job and return its jobId immediately. |
| `get_search_job_status` | Poll one lead-search job for its progress and results. |
| `submit_lead_feedback` | Record whether an AI-generated outreach message for a lead was good or bad, as training signal for future generations. |
| `discover_companies` | Find COMPANIES matching firmographic criteria, optionally pulling contact emails for each. |
| `enrich_lead` | Fill in a saved lead's missing person and company detail — seniority, department, LinkedIn, phone, company size, industry. |
| `verify_emails` | Check whether email addresses are deliverable, one or up to 20 at a time. |
| `score_leads` | Queue AI qualification scoring for leads — either every unscored lead in a search job, or a specific set of ids. |
| `list_lead_lists` | List the managed lead lists this account has created or synced. |
| `create_lead_list` | Create a new, empty managed lead list. |
| `sync_lead_list` | Import a managed lead list into local lead records so the rest of these tools can work with it. |
| `preview_message` | Draft a sample AI-personalised outreach message for a named person, to show what the agent would say. |
| `send_to_campaign` | Add saved leads to a campaign's contact list in bulk, up to 500 at a time. |
| `list_deals` | List deals as a flat, paged array, optionally filtered by status, with revenue totals alongside. |
| `create_deal` | Open a new deal against a lead's email address. |
| `update_deal` | Change a deal's status, value, or notes. |
| `get_pipeline` | Get the sales pipeline as a board: deals grouped by stage, with revenue totals. |
| `move_deal_stage` | Move one deal to a different pipeline stage — the equivalent of dragging its card on the board. |
| `start_autopilot` | Start an autonomous outreach run: give the agent a goal and it finds, contacts and follows up with leads on its own. |
| `list_autopilot_runs` | List past and running autopilot runs with their status and result summaries. |
| `get_autopilot_status` | Get the current progress and results of one autopilot run. |
| `get_channels_status` | Report the configuration, connection state and delivery stats for every outreach channel — WhatsApp, SMS and push. |
| `update_channel` | Turn one outreach channel on or off — WhatsApp, SMS or push. |
| `get_sales_agent_config` | Fetch the AI sales agent's current settings: whether it is enabled, its booking link, offer price, reply limits and confidence threshold. |
| `update_sales_agent_config` | Change the AI sales agent's settings — enable or disable it, set the booking link, offer price, reply limits and confidence threshold. |
| `get_sales_agent_actions` | Get what the AI sales agent has done today, with summary stats — actions taken, deals created, replies sent. |
| `process_sales_agent` | Run the sales-agent pipeline over one conversation: decide the next action and carry it out. |
| `search_verified_leads` | Find people or businesses matching a plain-language description and return only leads with a real way to reach them (email, phone or LinkedIn), each read from a real record — never generated. |
| `reveal_company_contacts` | Read a company's own website now and return what it publishes: contact emails, a phone number, its social profiles and its detected tech stack. |
| `company_email_format` | The email address format a company uses (e.g. |
| `verify_email` | Check whether one email address can receive mail. |

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
- Source — https://github.com/Misar-AI/misarreach-mcp

MIT © [Misar AI](https://misar.io)
