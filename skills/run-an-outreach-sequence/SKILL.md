---
name: run-an-outreach-sequence
description: Design, preview and send a multi-channel outreach sequence. Use when asked to run a campaign, start outreach, or message a lead list in MisarReach.
---

# Run an outreach sequence

`send_to_campaign` reaches real people and cannot be recalled. Everything before
it is reversible; it is not.

## Steps

1. `list_lead_lists` / `list_leads` — confirm the audience and its real size.
2. `get_channels_status` — only build steps on channels that are connected. A
   step on a disconnected channel silently never sends.
3. Draft the sequence: how many touches, on which channels, how far apart.
4. `preview_message` for **every** step, and show the user every preview.
5. Wait for explicit approval.
6. `send_to_campaign`.

## Rules

- Never call `send_to_campaign` to "test". Use `preview_message`.
- If verification has not run on this list, stop and run it first.
- If the audience is far larger than the user seems to expect, say so before
  sending rather than after.
