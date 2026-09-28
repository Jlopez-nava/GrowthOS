# Work in progress

GrowthOS is an early preview published so others can explore, clone, and contribute while it develops.

## Implemented

- Local sample/sandbox workspaces and validated CSV imports.
- Hosted company roles and separate brand namespaces.
- Zapier-powered GA4 and Google Ads reporting with on-open/manual refresh.
- Performance summary, acquisition trends, campaign scorecards, targets, and brand-specific funnels.
- Explicitly fictional PromptPilot and Juniper showcases.
- Today daily brief with live Performance priorities, source coverage, actionable follow-ups, and saved competitor ideas. See [TODAY.md](TODAY.md).
- Rules-based opportunities, inspectable evidence, review workflow, and versioned drafts.
- Brand-scoped tasks and experiments with owners, dates, implementation logs, guarded before/after comparisons, and saved outcome reviews. See [ACTIONS.md](ACTIONS.md).
- OpenAI web-search competitor discovery, source-linked suggestions, human confirmation/dismissal, and manual onboarding entries. See [COMPETITORS.md](COMPETITORS.md).
- Website comparison of up to three confirmed competitors, evidence-linked findings, prioritized test hypotheses, and public Google/Meta ad-library links.
- Encrypted server-side connection storage and source-specific reporting validation.

## Incomplete or not yet implemented

- Direct Google Ads developer-token support and full end-to-end OAuth validation.
- A unified live/CSV recommendation engine: Today uses live Performance assessments; CSV findings still use their separate evidence and rules.
- MintMCP adapter, additional native connectors, and live Search Console connection.
- OpenAI-backed conversations and generation.
- Independent scheduled refresh, backfills, and background job operations.
- Automated competitor-ad ingestion, scheduled competitor page-change monitoring and causal measurement of recommended changes.
- Per-brand/client access control, real-time collaborative editing, and large-account pagination.
- Turnkey infrastructure provisioning and independent security review.

## Verification

Run `pnpm typecheck`, `pnpm test`, and `pnpm build` before contributing. Tests include calculation semantics, CSV validation, missing-versus-zero handling, auth boundaries, encrypted storage, brand isolation, stale-write protection, reporting mocks, and sample-data isolation.

Mocked provider tests and local builds do not prove that a new deployment's OAuth grants, provider permissions, billing, or report definitions are correct. Verify those in your own environment. Do not use successful builds or the existence of a Connect button as a production-readiness claim.
