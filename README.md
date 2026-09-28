# GrowthOS

**Work in progress · early preview · actively being developed**

GrowthOS is a marketing intelligence workbench for agency teams managing multiple brands and in-house marketers focused on one business. It brings acquisition, paid programs, and customer journeys into one place so marketers can review what changed, inspect the evidence, and decide what to do next.

This repository is a sanitized source release. It contains no production accounts, connection tokens, customer exports, or deployment identity. You must configure your own deployment and connect the brands you are authorized to manage.

## Latest update: a clearer Today page

Today now helps you choose what to do: review up to three priorities with evidence and next steps, follow up on tasks and experiments, and turn saved competitor findings into tests. It uses the same connected reports as Performance, explains freshness and reporting dates, and keeps sample/CSV data labeled separately. It does not start paid competitor scans just because you open the page.

Read the [changelog](CHANGELOG.md), [Today guide](docs/TODAY.md), or [OpenAI / Claude setup guide](docs/AI-PROVIDERS.md). **OpenAI research is implemented; Claude requires a backend adapter.**

## What you can explore

- **Executive summary:** results, cost per result, recorded website revenue, goals, and comparisons between two 28-day periods.
- **Demand and acquisition:** new users, engagement, daily trends, and first-user versus session channels.
- **Paid programs:** campaign spend, budget plans, conversions, cost targets, and explained review prompts such as “Investigate” or “Consider scaling.” These never change ad budgets.
- **Brand-specific funnels:** service leads, software trials/subscriptions, and ecommerce purchases. GA4 milestone activity is distinguished from genuinely linked journey cohorts.
- **Brand workspaces:** select a client from the brand dropdown; a single-brand deployment displays the brand without a dropdown.
- **Today daily brief:** up to three report-backed priorities, due work and experiment follow-ups, saved competitor test ideas, and clear sources and reporting periods. [Daily brief guide](docs/TODAY.md).
- **Actions & experiments:** assign work from campaign findings or CSV opportunities, record changes, compare equal before/after periods, and save an outcome decision. [Workflow guide](docs/ACTIONS.md).
- **Competitor intelligence:** discover and confirm businesses, compare your website with up to three competitors, and review source-linked findings and test ideas. Includes manual Google/Meta ad-library lookup links. [Setup and workflow](docs/COMPETITORS.md).
- **CSV workflow:** validate reports, inspect source evidence, review deterministic opportunities, and create editable drafts.
- **Fictional showcases:** PromptPilot and Juniper & Co. demonstrate the Performance dashboard with labeled, simulated data. No sample number is a real business claim.

## Start locally — no credentials needed

Use Node **24+** (the tests use `node:sqlite`) and the package-manager version in `package.json`.

```sh
git clone https://github.com/Jlopez-nava/GrowthOS.git
cd GrowthOS
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:3000**. The local demo and sandbox work without a backend. Their data stays in browser storage. The initial local demo uses a fictional brand named Forma.

```sh
pnpm typecheck
pnpm test
pnpm build
```

The build produces the static frontend in `out/` and a Workers-compatible backend bundle in `dist/server/`. A local `next dev` server does **not** implement the company/provider API. Live connections require the authenticated hosted backend described below.

## Connect the brands you manage

1. [Set up your own deployment](docs/DEPLOYMENT.md). A GitHub clone does not include an account, database, credentials, or a running backend.
2. Use **Manage brands → Add a brand** for each client or business.
3. Select the brand **before** configuring connections or importing data.
4. Follow the [step-by-step connections guide](docs/CONNECTIONS.md) for Zapier MCP, direct Google OAuth, CSV imports, or the planned MintMCP path.
5. In **Performance → Goals & tracking**, define success, set targets, classify campaigns, and map the events that represent that brand’s funnel.

| Connection | Current status | What it supports |
| --- | --- | --- |
| Zapier MCP | Implemented; deployment/account setup required | GA4 and Google Ads reports; automatic refresh on opening the relevant view and manual refresh |
| Direct Google OAuth | GA4 reporting implementation; Ads adapter incomplete | Separate direct-report controls; not the four-section live Performance data source |
| CSV files | Implemented | GA4, Google Ads, Search Console, and linked journey imports |
| MintMCP | Not implemented | Integration planning guidance only |
| OpenAI API | Implemented; company admin setup required | Competitor discovery and evidence-backed website comparisons |
| Claude / Anthropic API | Not implemented | Account preparation and developer integration guide only |

[Connection instructions](docs/CONNECTIONS.md) include per-brand setup, verification, troubleshooting, and current limitations.

For AI research, follow [Connect OpenAI or prepare a Claude integration](docs/AI-PROVIDERS.md). OpenAI is configured under **Competitors → Connect OpenAI**, or through a server runtime secret. Never put an API key in GitHub or a public browser environment variable. One research key serves the company; Google/Zapier reporting connections are configured separately for each brand.

## Try the fictional Performance dashboards

On a configured **company deployment**, add these fictional brands using their exact names and reserved example domains:

| Name | Website | Scenario |
| --- | --- | --- |
| PromptPilot | `https://promptpilot.example` | AI app acquisition, trial activation, and paid subscriptions |
| Juniper & Co. | `https://juniperhome.example` | Ecommerce acquisition, purchase, and repeat-customer funnel |

Leave their provider connections empty, then open **Performance**. Each showcase supplies 56 rolling days, four paid campaigns, goals, and synthetic linked cohorts. Samples are rendered separately from provider storage; they are not copied into real reports. A connected Zapier account or saved Performance provider report disables the sample view. These hosted showcases are separate from the local Forma demo.

## Work in progress

This is a working prototype, **not a finished production platform or a security certification**. See [current status and roadmap](docs/STATUS.md).

Key boundaries:

- Performance and CSV insights use deterministic calculations and rules. Competitor discovery and website comparisons use OpenAI web search; AI chat and draft generation are not implemented.
- No background schedule runs while the website is closed.
- Live reports and CSV-based recommendations remain separate pipelines.
- Direct Google Ads requires developer-token support and further end-to-end validation.
- Company teammates can access all brands in that deployment. Client-specific access restrictions are not implemented.
- Current report and workspace limits suit bounded demos and small reporting workflows, not warehouse-scale ingestion.

## Repository map

- `components/` — interface, brand switching, connection guides, Performance dashboard.
- `lib/domain/` — calculations, CSV validation, workflow rules, fictional samples.
- `server/` — company authorization, encrypted storage, Google and Zapier reporting.
- `drizzle/` — company/brand SQLite migrations for the hosted backend.
- `supabase/` and `lib/adapters/` — separate optional persistence adapter; not a substitute for the hosted provider backend.
- `public/samples/` — fictional CSV examples.
- `tests/` — domain, storage, authorization, integration mocks, and browser checks.

## Privacy and contributing

Read [SECURITY.md](SECURITY.md) before connecting real accounts or sharing a fork. Use fictional examples in issues and pull requests. Never attach tokens, customer CSVs, private report screenshots, production database dumps, or `.env` files.

Code is distributed under the [ISC license](LICENSE), matching the existing package license. Third-party notices remain in their respective files. The included Subgrowth Digital name and logo identify the original interface; the code license does not grant trademark rights or imply endorsement. Replace them with your own branding for your company.
