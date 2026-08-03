---
name: misarreach
description: Find leads, enrich and score them, run multi-channel outreach, and manage the sales pipeline — from any AI assistant. Use when the user asks about their MisarReach account, or wants to work with it from this conversation.
---

# MisarReach

Work with a MisarReach account over the REST API.

## This skill needs an API key

There is no MCP connection here, so every call is a direct HTTPS request and the
user must supply a key.

If the user has not given you one, ask for it and tell them exactly how to get it:

> Create a key at https://reach.misar.io/settings/api-keys (Settings → API keys). It starts with `mrk_`.
> Paste it here and I will use it for this conversation only.

Never guess a key, never reuse one from another conversation, and never write it
into a file or repeat it back in full.

## Making a call

```
POST https://api.misar.io/reach/<endpoint>
Authorization: Bearer mrk_<their key>
Content-Type: application/json
```

A 401 means the key is wrong or revoked — say so plainly and point them back to
https://reach.misar.io/settings/api-keys rather than retrying.

## What you can do

- `list_leads` — List saved leads for the authenticated user.
- `search_leads` — Start an AI-powered lead search job.
- `get_search_job_status` — Poll the status and results of a lead search job.
- `list_lead_lists` — List Hunter.
- `list_deals` — List deals with optional status filter.
- `get_pipeline` — Get the full sales pipeline board with deals grouped by stage (new, contacted, interested, meeting, proposal, closed, lost) plus revenue totals.
- `list_autopilot_runs` — List past autopilot runs with their status and summary results.
- `get_autopilot_status` — Get the current status and progress of a specific autopilot run.

Full reference: https://docs.misar.io/reach/mcp

## Rules

1. **Read before you write.** Never act on an id, URL or metric you have not
   seen in a response.
2. **Confirm anything the outside world sees** — anything that sends, publishes,
   or is visible to other people — before doing it.
3. **Report failures honestly.** If a call fails, say what failed and why. Never
   present an unverified result as done.

## Prefer the MCP server when available

If the user works in Claude Desktop, Claude Code, Cursor, VS Code or any MCP
client, the @misarreach/mcp server is a better fit: it authenticates once and
exposes 27 typed tools instead of hand-built requests.
Setup: https://docs.misar.io/reach/mcp
