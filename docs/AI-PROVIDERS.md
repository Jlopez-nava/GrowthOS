# Connect OpenAI or prepare a Claude integration

**Current release: OpenAI is implemented. Claude is not connected yet.** This guide separates setup you can use now from developer work needed to support a second provider. Do not put an Anthropic key in the OpenAI connection form or set `COMPETITOR_MODEL` to a Claude model name; neither changes the provider.

| Feature | Needs an AI API key? | Current provider |
| --- | --- | --- |
| Today performance priorities, calculations, CSV findings, tasks and experiments | No | Deterministic rules and calculations |
| Google Ads / GA4 reports | No AI key | Separate Google/Zapier connections |
| Competitor discovery and website comparisons | Yes | OpenAI Responses API with web search |
| Showing saved competitor ideas on Today | No new model call | Reads the saved comparison |
| Claude research, AI chat or AI draft generation | Not available in this release | Requires implementation |

## Before connecting either provider

Deploy your own authenticated company backend using [DEPLOYMENT.md](DEPLOYMENT.md). A clone, `pnpm dev`, GitHub Pages, or a static frontend alone cannot securely run the company/provider APIs. Configure the owner, company ID, trusted identity layer, database, encrypted storage and origin first.

Use your organization's provider account and server secrets. Never copy the original deployment's credentials or add keys to GitHub, screenshots, issues, browser bundles, `public/`, or a `NEXT_PUBLIC_` variable. Provider credentials belong to the company; research and reports belong to the selected brand. All approved teammates currently have access to all brands in that company deployment.

## OpenAI — working setup

### 1. Create a project key

Sign in to the [OpenAI API platform](https://platform.openai.com/), choose the project that should own usage, and create an API key. Review billing, usage controls and permissions. See the [official quickstart](https://developers.openai.com/api/docs/quickstart) and [authentication guidance](https://developers.openai.com/api/reference/overview).

The application's current default is `gpt-5.6-terra`, defined in `server/competitor-discovery.mjs`. Your project must be able to retrieve that model and use Responses with web search and structured output. A server operator can set `COMPETITOR_MODEL` to a compatible OpenAI model, but should validate the request options and evidence parsing before changing it. A model listed in code is not a guarantee of access in every account.

### 2. Choose one connection method

**Company admin, through GrowthOS:**

1. Keep the key in a local file named `.env.local`, containing an `OPENAI_API_KEY` assignment. Prefer a dedicated file containing only this credential. The following is a blank example; enter the real value privately in your local editor:

   ```dotenv
   OPENAI_API_KEY=
   ```

2. Sign in to **your own trusted HTTPS deployment** as a company admin and select a brand.
3. Open **Competitors → Connect OpenAI** (or **Manage OpenAI connection**).
4. Choose the local env file and click **Connect API key**. The browser reads it locally and sends only the extracted key to this deployment. It is not sent to GitHub or uploaded with the rest of the file.
5. The server checks model access, encrypts the key, and stores it for the company. After storage, API status responses do not return the key. Selecting a new key replaces the existing company research key.

**Deployment operator, using a runtime secret:**

1. Set `OPENAI_API_KEY` in the hosting service's **server runtime secret manager**.
2. Optionally set `COMPETITOR_MODEL` in server configuration; leaving it unset uses the code default.
3. Apply the configuration through the host's deployment workflow and reopen Competitors.

The encrypted company key takes precedence over the runtime secret. Updating only the runtime secret will not replace a key previously saved through the UI. A local `.env.local` or GitHub Actions secret is not automatically injected into the deployed Worker. Never bake the key into the frontend build. [OpenAI's authentication guidance](https://developers.openai.com/api/reference/overview) requires confidential keys to stay out of client code.

### 3. Verify with the right brand

1. Complete **Brand** with its public website, products/services, audience and geography.
2. In **Competitors**, click **Find competitors**, review the source links, and confirm actual competitors. Or add known businesses manually.
3. Under **Compare my brand**, choose one to three confirmed competitors and click **Compare websites**.
4. Check the saved report's brand, websites, research date and evidence. Opening Today then displays saved ideas without starting another paid scan.

Connecting a key validates model access; it does not prove that billing, web search and every report request will succeed. Scans/comparisons use the provider's API billing, have application limits, and can incur costs even when they fail. See [COMPETITORS.md](COMPETITORS.md) for exact limits and data sent to the provider.

### Troubleshooting

| What you see | What to check |
| --- | --- |
| No Connect OpenAI control | You need a hosted company workspace and an admin role |
| No key found in the file | Use the exact `OPENAI_API_KEY` name with a single-line value in a small plain-text env file |
| Model access could not be verified | Key validity, project permissions, Models access, and configured model |
| Connected but research fails | API billing/quota, model/tool support, request limit, and the redacted error in the app |
| Changing a runtime secret has no effect | A previously stored company key overrides it |
| Another brand's findings appear | Verify the selected brand and its public profile; do not paste private reports into a public issue |

## Claude / Anthropic — setup preparation, then developer integration

**There is no Claude selector or Anthropic adapter in this repository yet. Creating a key alone will not enable Claude in GrowthOS.**

To prepare a Claude account, use **Settings → API keys** in the [Claude Console](https://platform.claude.com/) and scope the key to the appropriate workspace. For shared production use, follow Anthropic's service-account guidance. Store it as `ANTHROPIC_API_KEY` in server secrets. If a key spans workspaces, follow the workspace-header requirements in [Anthropic's authentication documentation](https://platform.claude.com/docs/en/manage-claude/authentication). GrowthOS currently does not read this variable.

A developer must then:

1. Add explicit provider selection and separate encrypted credential handling. Keep OpenAI and Anthropic keys separate; make the provider choice visible to admins and in saved reports.
2. Implement Anthropic Messages API requests using the official SDK or direct server HTTP calls. OpenAI's Responses request and response formats cannot simply be reused.
3. Choose an available Claude model with web-search support and enable the appropriate server tool. Check organization tool settings and current model/tool compatibility in [Anthropic's web-search documentation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool).
4. Convert returned citations and structured findings into GrowthOS's existing discovery/comparison records. Preserve exact-source validation, both-brand evidence requirements, public-URL restrictions and the “not verified” behavior. Do not accept plausible model-written URLs as source evidence.
5. Extend the connection UI, model verification, provider-specific error redaction, timeout/cost limits and usage metadata. Preserve company-admin checks, CSRF protection, encrypted storage, brand isolation and failure retention. Review Anthropic's data handling separately; OpenAI's `store:false` setting is not a cross-provider guarantee.
6. Add provider-contract and isolation tests, then validate a public-website scan and comparison in a private test deployment before enabling the option for users.

Start with `server/competitors.mjs`, `server/competitor-discovery.mjs`, `server/competitor-comparison.mjs`, and `components/competitor-workbench.tsx`. The existing tests are the behavior contract; the provider must preserve evidence quality, not just return text.

## Keep keys private when sharing a fork

Commit only blank examples. Before publishing, check `git status --short`, `git diff --cached`, and `git ls-files .env.local`; the last command should return nothing. Git ignores do not protect a file that was already tracked. Scan Git history as well as the current files. Never print a key while checking it.

If a real key is exposed, revoke it in the provider console, replace the stored/runtime credential, and then remove it from repository history and other published copies. See [SECURITY.md](../SECURITY.md). Do not post the leaked value to request help.
