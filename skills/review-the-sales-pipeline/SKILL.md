---
name: review-the-sales-pipeline
description: Report deal pipeline health and recommend next actions. Use when asked about deals, pipeline, forecast, or sales performance in MisarReach.
---

# Review the sales pipeline

## Steps

1. `get_pipeline` — value and count by stage.
2. `list_deals` — find deals that have not moved recently.
3. Report: total value, distribution by stage, stalled deals, win rate.

## Recommend, then ask

Give the three highest-impact next actions, each naming a specific deal and why.

Do not call `move_deal_stage` or `update_deal` on your own. Stage changes feed
reporting and can trigger automations; the user decides when a deal has actually
moved.
