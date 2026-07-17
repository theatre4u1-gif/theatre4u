# Supabase backup — source-of-truth snapshot

This folder is a backup of the server side of the platform, so the schema and
server logic no longer live only inside the live Supabase project. Snapshot
taken July 17, 2026 from project `ldmmphwivnnboyhlxipl` (theatre4u-marketplace).

## What is here

- `functions/<slug>/index.ts` — the full source of all 20 live Edge Functions.
  This is the important one. Edge function source is NOT included in Supabase's
  database backups, so before this snapshot it existed only inside the live
  project. These files are that source, exactly as deployed.
- `migrations/MIGRATIONS_MANIFEST.md` — the ordered list of all 188 database
  migrations (the build history). The full SQL body of each still lives in the
  live project and can be pulled down with the Supabase CLI (see below).

## Edge functions in this snapshot (20)

Billing / money: `stripe-webhook`, `founding-checkout`, `invoice-request`,
`create-label-checkout`, `assign-labels`, `close-org`.
Email / notify: `send-sequence-email`, `email-sequence-scheduler`,
`signup-notify`, `message-notify`, `request-notify`, `team-invite`,
`district-invite`, `beta-signup`, `contact-form`, `resend-test`.
Other: `public-item` (QR lookups), `ai-help` (support chat), `track-visit`
(analytics), `post-to-facebook`.

Secrets (API keys, tokens) are read from Supabase environment variables at
runtime and are deliberately NOT in these files. Redeploying a function also
requires its secrets to be set in the Supabase dashboard.

## To pull the full migration SQL into this folder

Run once from a machine with the Supabase CLI installed and logged in:

```
supabase link --project-ref ldmmphwivnnboyhlxipl
supabase db pull        # writes timestamped .sql files into supabase/migrations/
```

To redeploy a function from this folder later:

```
supabase functions deploy <slug>
```

## Backup checklist — please confirm in the Supabase dashboard

These are the items an audit flagged. GitHub protects the code; Supabase holds
the business, so it is worth confirming the safety net is really on:

1. Database backups. Settings, then Database, then Backups. Confirm daily
   automated backups are enabled and you can see recent ones. Daily backups
   require the Pro plan; the free plan does not keep them.
2. Point in time recovery (PITR). Same page. Optional paid add on that lets you
   restore to any minute, not just the last daily snapshot. Worth it once real
   money is flowing.
3. Restore test. At least once, confirm you understand the restore flow (you do
   not have to actually run it). A backup you have never tested is a guess.
4. Storage (photos). Item photos and room photos live in Storage buckets, which
   are separate from the database backup. Confirm whether your plan covers
   Storage, and if not, plan a periodic export of the buckets.
5. Keep this snapshot current. Re-pull after any batch of schema or function
   changes so the repo copy does not drift from the live project.
