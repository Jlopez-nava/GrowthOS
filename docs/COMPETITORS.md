# Competitor discovery and website comparison

GrowthOS discovers possible competitors using OpenAI web search, then asks a person to confirm the relationship. Discovery is separate from ongoing page-change monitoring, which is not implemented.

## Compare websites

After confirming competitors, use **Competitors → Compare my brand**, select one to three businesses, and click **Compare websites**. The existing company OpenAI connection is reused. Comparisons run only when an admin requests them, never automatically on page open.

The report researches the brand and selected competitors across positioning, offers, trust, conversion paths and content. It returns source-linked findings and up to five prioritized test hypotheses, each with a concrete change and measurement plan. A recommendation needs exact provider-returned evidence from both the brand and a selected competitor, also used in the website findings. Unknown details are labeled “Not verified”; this does not mean the feature is absent. If the brand or all competitors have no usable evidence, the request fails and preserves the last good report.

Reports are encrypted and isolated by company/brand. They are visible to company teammates; only admins may initiate paid research. A report records its date, websites, brand context, limitations, model and usage. Changing the brand context or dismissing a selected competitor during a request prevents saving an outdated result. Later changes flag the saved report as historical. This is a snapshot, not continuous monitoring or a causal claim that a competitor's tactics generate business.

Each brand can attempt three comparisons per UTC day, at least one minute apart, independently of discovery limits. Each request has a 120-second timeout, at most eight web tool calls and 14,000 output tokens across up to five model requests. Each website is researched separately (up to two web tool calls and 2,500 output tokens), then a final request synthesizes only validated findings (up to 4,000 output tokens). Failed requests can incur API costs and count toward the cap. Search results can be cached or incomplete. This is a text-based review, not browser testing of visuals, mobile layouts, forms, accessibility, or page speed.

Only public brand context and selected competitor names, IDs and website addresses are sent to OpenAI; report metrics, budgets, private notes and customer records are excluded. The response uses `store:false`; provider data policies still apply. Requests go to the fixed OpenAI API endpoint. The Worker does not directly fetch arbitrary competitor URLs.

## Public ad libraries

**Explore their ads** links each confirmed competitor to [Google's Ads Transparency Center](https://adstransparency.google.com/) and [Meta's Ad Library](https://www.facebook.com/ads/library/). Check advertiser identity and country/date filters yourself. These are manual lookup links, not scanned ads, proof of active campaigns or a complete advertising history.

Automated ad collection and analysis are not implemented. An ongoing feed needs an appropriately licensed data provider or supported API, its own credentials, and clear coverage limits. The brand's Google Ads OAuth/Zapier connection only accesses authorized accounts; it does not grant access to competitors' private account data. Public ad creatives cannot establish competitor leads, sales, CPA or ROAS. Website comparisons do not incorporate ad-library results.

## Connect your own company

1. Deploy the authenticated company Worker, D1 database and encrypted R2 storage described in your deployment guide. The local static/Next preview has no provider API.
2. Create an OpenAI project API key with access to the Responses API, web search and `gpt-5.6-terra`. API usage is billed to that project. Set appropriate project spending limits in OpenAI.
3. Keep the key in a local, Git-ignored env file as `OPENAI_API_KEY`. Never use a `NEXT_PUBLIC_` variable or commit the file.
4. As a company admin, open **Competitors → Connect OpenAI**, choose that env file, and select **Connect API key**. The browser extracts only `OPENAI_API_KEY`; it does not upload the rest of the file. The server verifies model access and encrypts the key using the existing company connection storage. Status responses never return it. This key serves all brands in this company, but competitor records are isolated by brand.
5. Alternatively, an operator may configure `OPENAI_API_KEY` as a server runtime secret. The encrypted company connection takes precedence if both are present. `COMPETITOR_MODEL` is an optional server-only model override; use a model supporting web search and structured output.

No credentials or production company information are included in this repository.

## Onboard and discover

Create a brand or open **Brand**. Enter its name, public website, products/services, audience, and geography. Local businesses should specify the cities or service area rather than only a country. Add known competitors with a name and public website; these become confirmed manual entries.

Enable **Find other competitors after setup** and save. The site opens Competitors and starts the first scan if the company connection is ready and no scan has been attempted for this brand. If setup was disconnected or a scan failed, use **Find competitors** after resolving it. Returning to the page does not repeatedly run paid searches. Editing an existing profile does not automatically repeat a previous scan; explicitly start a new one.

Each scan can suggest up to eight businesses. Each suggestion shows a possible reason for overlap and one or more supporting links. At least one exact source URL must have been returned by the web search provider on that candidate's official domain. This is an evidence check, not independent proof that the business is a direct competitor.

- **Yes, a competitor:** moves the business into Confirmed.
- **Not a competitor:** moves it into Dismissed and excludes the domain from later discovery scans.
- **Review again:** brings a dismissed business back for review.
- **Add manually:** adds a known business directly to Confirmed.

Rescans preserve prior decisions and do not overwrite manual entries. Removing a confirmed entry moves it to Dismissed; it is recoverable. Earlier free-text competitor notes remain visible and are not automatically converted into unverified businesses. Removing an onboarding row does not delete an already-imported competitor; manage saved decisions in Competitors.

## Limits and behavior

- Only admins can start paid scans or configure credentials. Company members can add and review competitors.
- Scans have a 90-second timeout, at most three web-search tool calls, and a 5,000-output-token cap. Each brand may attempt three scans per UTC day, at least one minute apart. Failed scans count toward the cap because they may consume provider resources.
- Optimistic writes isolate each brand and preserve teammate changes. Concurrent scans are suppressed; existing good results remain available after an error.
- Only brand name, website, products/services, audience, geography and already-known competitor domains go to OpenAI. Marketing metrics, budgets, customer records and other connection credentials are excluded. Responses use `store:false`; OpenAI's applicable data policies still apply.
- Scan timestamps, model, search-call counts and token usage are saved. These are usage records, not an invoice or a guaranteed dollar cost.
- Discovery runs after opted-in onboarding or an explicit scan request. It is not a scheduled background service. There is no automatic competitor-page change detection, ad-spend intelligence or keyword feed.
- Manual onboarding works in local and Supabase profiles. Live discovery and shared reviews require the company Worker backend.

## Validation

`pnpm test` covers source-evidence validation, link restrictions, own-brand and duplicate exclusion, access control, CSRF, encrypted keys, brand isolation, stale reviews, scan cooldown/caps, failure retention, and provider request boundaries. The frontend is also verified through the onboarding/manual-add flow.
