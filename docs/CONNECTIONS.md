# Connect tools for each brand

## Before you begin

Complete [your own deployment setup](DEPLOYMENT.md), sign in as an admin, and select the correct brand. Use **Manage brands → Add a brand** for each business you manage. One brand displays as a name; two or more enable the dropdown.

Use accounts you are authorized to access. Credentials and reports are stored under the selected brand's encrypted namespace. They are not shared with another deployment or included in this repository. Company teammates in the same deployment can access all its brands.

## 1. Zapier MCP — current live Performance path

1. Sign in at [Zapier MCP](https://mcp.zapier.com). Create a dedicated server for **Other**, named for the brand, for example `GrowthOS — Example Brand`. Keep separate servers/tokens for different client brands.
2. Open that server's **Settings**, select **Agentic mode**, and save. This implementation uses Zapier's inspect/execute meta-tools; Managed mode's standalone action list is not supported. See [Zapier's mode instructions](https://docs.zapier.com/mcp/manage/switch-modes).
3. Under **Apps**, add **Google Analytics 4** and **Google Ads**. For each, choose the Google connection with access to this client's property/account as the default connection. Connecting an app to a chat's MCP server does not connect it to the website's server.
4. Enable GA4 **Run Report for a Property** and Google Ads **API Request / Make API Mutating Request**. Despite the latter name, GrowthOS sends only a fixed, server-defined `POST googleAds:search` reporting query. It does not expose arbitrary tools, destinations, campaign changes, or budget writes.
5. In GrowthOS, select the brand and open **Connections → Live Google reports → Connect the website to Zapier**. Enter this brand's reporting IDs:

   | Field | Format | Where to find it |
   | --- | --- | --- |
   | GA4 account | `accounts/123456789` (illustrative) | Google Analytics Admin account details |
   | GA4 property | `properties/987654321` (illustrative) | Admin property details; **not** a `G-...` measurement ID |
   | Property name | Your recognizable property label | GA4 property details |
   | Google Ads customer | Ten digits, without hyphens | The client advertiser account |
   | Google Ads manager | Ten digits, without hyphens | The manager account used to access that client |

   IDs above are placeholders, not connected accounts. The current Zapier adapter requires a manager ID. For accounts without that manager relationship, use CSV reporting until the adapter supports that case.

6. In the dedicated Zapier server's **Connect** tab, generate its connection token. Paste **only the token** into the selected brand's secure Connections form, then choose **Save token & load reports**. Do not place it in source code, `.env.example`, GitHub, chat, or browser-side configuration.
7. Check **both** report panels. Match account IDs, date range, currency, and a few totals against Google. A valid empty result is different from a failed request. “Connected” in Zapier alone does not prove that the requested reports can run.
8. Open **Performance**. The dashboard loads daily traffic, first-user acquisition, events, and paid campaign history. Set **Goals & tracking** for this brand. Mark results verified only after confirming what the Google Ads primary conversion actions actually count.
9. Repeat with a separate server/token and the correct IDs for the next brand. Switching the dropdown does not reassign another brand's connection.

**Refresh behavior:** the relevant views check when opened and provide manual refresh. Automatic attempts are cached for 15 minutes; manual refresh has a one-minute cooldown. Performance can request four reports. Failed refreshes preserve the previous successful report. Nothing refreshes while the site is closed. Provider actions can consume Zapier tasks; check [current usage rules](https://docs.zapier.com/mcp/overview/usage) for your plan.

**Disconnect:** use the site's disconnect control to delete that brand's stored token/reports, and revoke the website token in Zapier separately if it should no longer be usable.

### Common Zapier problems

| Symptom | Check |
| --- | --- |
| Mode/meta-tools error | Dedicated server is in Agentic mode, with changes saved |
| Only GA4 works | Google Ads is added to the same website server, the API Request action is enabled, and its default account is correct |
| Ads permission error | Inspect Zapier History; confirm the advertiser/manager pair and that the selected connection can report on that client |
| Wrong account's numbers | Stop and verify the selected brand, stored IDs, and Zapier default Google connection |
| Missing/partial report | The adapter rejects truncated reports; current maximum is 10,000 rows per report |
| Website setup needed | Verify authenticated backend, storage bindings, encryption key, origin, and owner configuration |

Do not post raw Zapier History payloads in public issues: they can contain account data. Share a redacted error category and a fictional reproduction instead.

## 2. Direct Google OAuth — separate reporting controls

This path does not currently power the four-section live Performance dashboard. Use Zapier for that dashboard or CSV for imported-report workflows.

### Deployment owner setup

1. In Google Cloud, choose your own project and enable the Analytics Data and Analytics Admin APIs.
2. Configure the OAuth consent app and its audience. Add approved test users if it is in Testing.
3. Create an OAuth client of type **Web application**.
4. Register the exact redirect URI: `https://YOUR-DEPLOYMENT/api/google/oauth/callback`.
5. Save the client ID and secret as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in your hosting service's server configuration. Set `GOOGLE_APP_ORIGIN` to that same deployment origin.
6. Deploy the server configuration and follow Google's [web-server OAuth guidance](https://developers.google.com/identity/protocols/oauth2/web-server). Keep downloaded client-secret files outside the repository.

### Per-brand GA4 connection

1. Select the brand, open **Connections → Optional direct Google connection**.
2. Choose **Connect Google Analytics 4** and sign in with the Google account that can access this brand's property. Review the requested permissions.
3. After returning, choose **Load available properties**, then select the correct property.
4. Set dates, select **Sync report**, and compare the result with GA4.
5. Repeat independently for each brand. These reports sync manually and have separate credentials and controls from Zapier.

For `redirect_uri_mismatch`, compare the exact callback URL, scheme, host, and path. For no properties, check the Google account's access and the enabled APIs. Testing-mode grants may need reauthorization. Disconnecting GrowthOS does not revoke consent in your Google account; revoke it there separately when appropriate.

### Direct Google Ads is not ready for general use

OAuth and reporting UI/code exist, but `server/providers.mjs` currently does not supply the required Google Ads `developer-token` header. A developer must implement secure server-side token configuration, validate manager routing and API eligibility, and complete end-to-end tests before this path should be considered usable. OAuth alone is insufficient. See [Google Ads API prerequisites](https://developers.google.com/google-ads/api/docs/get-started/introduction). **Use the implemented Zapier reporting path or CSV in this release.**

The Ads OAuth scope is broader than read-only; the application only implements reporting operations. Review scope and access with the owner before granting consent.

## 3. CSV imports — no connector required

1. Select the correct brand (or local sandbox).
2. Open **Connections → Import CSV** or the import control in Performance's imported-report section.
3. Choose GA4, Google Ads, or Search Console. Enter the intended account/property, currency, timezone, and metric definition.
4. Select a UTF-8 CSV, review column mapping and preview, and validate before importing. Files are limited to 2 MB and 10,000 rows.
5. Inspect import history and evidence. Daily trend recommendations need complete comparison windows; use 56 days for a full current/prior 28-day comparison. Bundled files under `public/samples/` contain fictional data.

For daily data, keep one row per date/page for GA4 or Search Console, or date/campaign for Ads. Extra dimensions, duplicates, and summary rows can create double counting. Native GA4 landing-page summaries are supported with their metadata lines, but remain date-range summaries rather than invented daily history. **Key event counts are not converted-session counts.**

### Linked journey funnels

In **Performance → Evidence → Linked journeys → Import a journey CSV**, supply one anonymized entity per row:

```csv
entity_id,stage_1_at,stage_2_at,stage_3_at,stage_4_at,stage_5_at
sample-001,2026-08-01,2026-08-02,2026-08-04,2026-08-06,
```

The row is illustrative. Use your actual reporting dates and the stage labels for the selected brand model. Dates must be ordered `YYYY-MM-DD`, with no skipped intermediate stages; unreached later stages stay blank. The limit is 5,000 journeys and 2 MB. Include both comparison periods. Use opaque IDs, not names, emails, phone numbers, or other customer identifiers.

## 4. MintMCP — planned, not connected

The application includes planning guidance but **no MintMCP adapter**. A developer must implement server-side gateway authentication, restrict allowed reporting tools/destinations, map source schemas, and verify brand isolation before enabling it. A MintMCP token cannot be pasted into the Zapier field. Review [MintMCP's documentation](https://www.mintmcp.com/docs/quickstart) with your administrator; use Zapier or CSV until implementation is complete.
