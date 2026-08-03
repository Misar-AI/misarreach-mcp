---
name: audit-autopilot-and-agent
description: Check what MisarReach autopilot and the AI sales agent have been doing, and whether they should keep running. Use when asked to review automation, autopilot, or agent behaviour.
---

# Audit autopilot and the sales agent

Automation that sends on your behalf needs periodic review — the failure mode is
silent, and it compounds.

## Steps

1. `get_autopilot_status` and `list_autopilot_runs` — what has it sent?
2. `get_sales_agent_config` and `get_sales_agent_actions` — what is the agent
   configured to do, and what did it actually do?

## Report

- Volume sent, reply rate, bounce rate, complaint rate.
- Any action you would not have taken, and why.

If bounce or complaint rates are unhealthy, recommend pausing plainly rather
than burying it. Do not call `start_autopilot` or `update_sales_agent_config`
without explicit approval.
