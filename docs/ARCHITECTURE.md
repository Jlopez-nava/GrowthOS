# Architecture

The static Next.js frontend has two distinct persistence paths: a browser-local demo/sandbox, and an authenticated company backend with separate brand namespaces. A separate optional database adapter is also included; it is not the identity provider for the company API.

## Hosted company backend

- `server/company.mjs` authorizes the trusted hosting identity, enforces owner/admin/member roles, and resolves brand membership.
- D1 stores company members, audit entries, and brand metadata. R2 stores encrypted workspace snapshots, tokens, reports, and attempt state.
- Each additional brand has its own storage namespace. Legacy first-brand data uses the company namespace.
- Workspace writes use revision checks and conditional ETags; the aggregate has a 10 MB limit. This is not real-time record merging.
- `server/zapier-mcp.mjs` bounds MCP requests; reporting requests are constructed in server code.
- `server/performance*.mjs` requests and normalizes daily history, preserves prior successful data on failure, and caches refresh attempts.

## Measurement

`lib/domain` owns domain validation and deterministic calculations. CSV daily recommendations and live provider reports are separate workflows. The Performance view distinguishes GA4 key events from unique leads, first-user from session channels, Ads attribution from GA4 revenue, and milestone counts from linked entity funnels. Missing or incomplete evidence stays unavailable.

`performance-samples.ts` provides deterministic fictional showcases only for the two reserved example brands when neither a live Zapier connection nor a saved Performance report exists. Sample source metadata is explicit and samples are not written to provider storage.

`actions.ts` defines the action lifecycle and observational before/after calculations. Action plans are an optional field of the encrypted company workspace, validated by `server/action-validation.mjs` and protected by the existing revision/ETag checks. Baseline snapshots are fixed after capture; comparisons require matching provenance and complete, mature periods. The standalone Supabase adapter does not persist action plans; creation is disabled in that mode. See [ACTIONS.md](ACTIONS.md).

See [STATUS.md](STATUS.md) for unfinished integrations and [DEPLOYMENT.md](DEPLOYMENT.md) for the authentication boundary required by this implementation.
