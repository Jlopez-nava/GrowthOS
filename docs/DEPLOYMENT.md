# Deploy your own GrowthOS

This is an early preview. The frontend works locally without accounts, but shared brands and live Google reports require an authenticated backend, storage, and secrets.

## Supported hosted architecture

The current backend targets Sites with a Workers-compatible runtime, D1 SQLite bound as `DB`, and R2 storage bound as `BUCKET`. It relies on **trusted authentication headers supplied by Sites**: `oai-authenticated-user-id` and `oai-authenticated-user-email`.

**Do not place this Worker on an unprotected public endpoint that accepts these headers from arbitrary callers.** If porting to another host, implement and validate authentication at the trusted server boundary before enabling company or provider APIs. GitHub Pages can serve static output, but cannot run these APIs or hold server secrets.

## Create an independent company deployment

1. Register a new, initially private Site under your own account. Provision its own D1 database and R2 bucket. Do not reuse another company's project, database, bucket, or encryption key.
2. Copy `docs/hosting.example.json` to `.openai/hosting.json`. Replace the placeholder with the **new Site ID returned by your hosting service**. The active file is gitignored; no production Site ID is included in this repository.
3. Apply both SQL migrations under `drizzle/` in filename order to your new database using your host's migration workflow.
4. Set the following **server runtime** values in the hosting service's secret/configuration manager. `.env.example` documents names only. A local `.env.local` is not automatically your Worker's runtime configuration.

| Variable | Purpose |
| --- | --- |
| `COMPANY_ID` | New stable identifier for this independent company/agency deployment |
| `GOOGLE_OWNER_EMAIL` | Sign-in email of this deployment's owner; required even if using only Zapier |
| `GOOGLE_APP_ORIGIN` | Exact HTTPS origin of this deployment, without a trailing slash |
| `CONNECTION_ENCRYPTION_KEY` | Unique 32-byte random key encoded as 64 lowercase hexadecimal characters |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Required only for direct Google OAuth; confidential server-side values |

Generate the encryption key locally using a cryptographic generator, for example `openssl rand -hex 32`, and enter it directly in the host's secret manager. Never put its output in Git, public logs, issues, or screenshots. Losing or replacing this key without a migration makes existing encrypted data unreadable.

5. Run `pnpm build` and publish the frontend plus `dist/server/index.js` and its companion files through your host's supported Worker deployment workflow. The bundle also includes the hosting manifest when you supply one. A successful build alone is not a configured live deployment.
6. Sign in as the owner and verify **Connections** and **Settings** load. An unauthenticated user must not be able to read company APIs.
7. Set up the first brand profile, then add more brands with **Manage brands**. Follow [CONNECTIONS.md](CONNECTIONS.md).

The optional `ZAPIER_GA4_*` / `ZAPIER_ADS_*` runtime fields are legacy defaults for the first brand. Prefer setting reporting IDs in each selected brand's Connections panel. Additional brands do not inherit the first brand's credentials or IDs.

## Team access

An admin adds a teammate and role in **Settings**. The Site owner separately grants that teammate viewer access in the hosting service. Both checks must pass. Saving an app role neither sends an invitation email nor changes the Site's audience.

All approved company teammates can work across all brands in this deployment. If clients must not see each other's data, use separate deployments until per-brand membership is implemented. Admins manage connections; members can read reports, refresh reports, and collaborate on workspace data.

## Validation before adding real accounts

- Confirm the owner can open the company workspace and an unapproved account cannot.
- Create two test brands and check their imports, goals, and reports remain separate.
- Connect a provider and verify its property/customer ID and dates against the provider's own report.
- Do not change a public repository's visibility to control application access; those are separate systems.

This repository does not automatically provision infrastructure, transfer the original private deployment, or copy production data. The separate optional persistence adapter has its own migrations and authentication and does not provide the trusted Sites identity layer used by this backend.
