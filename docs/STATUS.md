# Work in progress

GrowthOS is an early preview published so others can explore, clone, and contribute while it develops.

## Implemented

- Local sample/sandbox workspaces and validated CSV imports.
- Hosted company roles and separate brand namespaces.
- Zapier-powered GA4 and Google Ads reporting with on-open/manual refresh.
- Performance summary, acquisition trends, campaign scorecards, targets, and brand-specific funnels.
- Explicitly fictional PromptPilot and Juniper showcases.
- Rules-based opportunities, inspectable evidence, review workflow, and versioned drafts.
- Encrypted server-side connection storage and source-specific reporting validation.

## Incomplete or not yet implemented

- Direct Google Ads developer-token support and full end-to-end OAuth validation.
- Feeding live reports into the existing CSV recommendation engine.
- MintMCP adapter, additional native connectors, and live Search Console connection.
- OpenAI-backed conversations and generation.
- Independent scheduled refresh, backfills, and background job operations.
- Competitor monitoring and causal measurement of recommended changes.
- Per-brand/client access control, real-time collaborative editing, and large-account pagination.
- Turnkey infrastructure provisioning and independent security review.

## Verification

Run `pnpm typecheck`, `pnpm test`, and `pnpm build` before contributing. Tests include calculation semantics, CSV validation, missing-versus-zero handling, auth boundaries, encrypted storage, brand isolation, stale-write protection, reporting mocks, and sample-data isolation.

Mocked provider tests and local builds do not prove that a new deployment's OAuth grants, provider permissions, billing, or report definitions are correct. Verify those in your own environment. Do not use successful builds or the existence of a Connect button as a production-readiness claim.
