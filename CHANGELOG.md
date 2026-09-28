# Changelog

GrowthOS is a work in progress. These notes describe implemented behavior and its limits, not a production-readiness certification.

## 2026-09-27 — Today daily brief

- Replaced the CSV-only Today inbox with a daily decision brief for the selected brand.
- Added up to three priorities from the same daily reports and campaign assessments used by Performance. Each explains the evidence, why it matters, the next step, source and reporting period.
- Added direct links to the relevant campaign, Goals & tracking, or saved action.
- Added due/overdue work and experiment follow-ups. Readiness checks do not change saved actions or claim causal lift.
- Added saved competitor website ideas with an option to plan a test. Opening Today does not start new paid AI research.
- Added report freshness and coverage explanations. Missing, failed or stale sources do not become zero results or an “all clear.”
- Preserved CSV findings in a separate expandable section and kept fictional brand samples explicitly labeled.
- Shared Performance's on-open refresh cache and manual-refresh cooldown; no background schedule was added.
- Checked TypeScript, the production build, 103 automated tests, campaign/goal/action navigation, and mobile overflow.

Read [Using Today](docs/TODAY.md) for thresholds, data modes and follow-through.

## Documentation and connection clarity

- Added [OpenAI and Claude API guidance](docs/AI-PROVIDERS.md), including server-secret handling, company versus brand scope, setup checks and troubleshooting.
- Marked OpenAI competitor research as implemented and Claude as requiring a backend integration. Performance calculations and rule-based priorities do not require either AI API.
- Kept [per-brand Google/Zapier setup](docs/CONNECTIONS.md), [deployment prerequisites](docs/DEPLOYMENT.md) and [unfinished work](docs/STATUS.md) linked from the README.

Earlier preview features include multi-brand workspaces, Performance help on hover, actions and experiments, competitor discovery and review, and evidence-backed website comparisons. Automated competitor-ad collection remains deferred; only manual public ad-library links are available.
