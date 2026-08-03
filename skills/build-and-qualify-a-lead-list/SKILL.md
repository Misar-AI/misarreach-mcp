---
name: build-and-qualify-a-lead-list
description: Find companies matching an ICP, enrich and verify the contacts, score them, and save a qualified list. Use when asked to find leads, build a prospect list, or research a target market in MisarReach.
---

# Build and qualify a lead list

Never send outreach to a list that has not been through verification. Unverified
addresses drive bounces, and bounce rate is what gets a sending domain blocked.

## Steps

1. **Clarify the ICP** — industry, company size, geography, job titles. Ask if
   any are missing; a vague ICP produces an expensive, useless list.
2. `discover_companies` — find matching companies.
3. `search_leads` — find contacts. This is asynchronous: poll
   `get_search_job_status` until it reports completion. Do not assume results
   are ready.
4. `enrich_lead` — fill in missing fields.
5. `verify_emails` — **mandatory before any send.** Report how many failed.
6. `score_leads` — rank by fit.
7. `create_lead_list` — save the qualified set.

## Report honestly

Say how many were found, how many survived verification, and how many were
dropped. A list that shrinks by 60% is normal and worth stating plainly — hiding
it leads to a campaign sized against numbers that were never real.

Do not start outreach here. That is `run-an-outreach-sequence`, and it needs
explicit approval.
