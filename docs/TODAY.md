# Today: a daily decision brief

Today answers three questions for the selected brand: what deserves attention, what work needs follow-up, and what website idea could become the next test. It is a work list based on complete reporting periods, not a claim to show intraday results.

## Report-backed priorities

Today reads the same brand-scoped daily reports and saved goals as Performance. It refreshes the four GA4/Google Ads reports on opening and offers **Refresh brief**. The existing server cache is shared with Performance: 15 minutes for automatic refresh, one minute for manual refresh. A complete uncached refresh can consume four Zapier reporting actions. Failed refreshes preserve previous reports for inspection but exclude the failed source from priority decisions.

The page displays the current 28-day period, the preceding 28 days, and the configured reporting buffer. A report must cover both windows and have a valid collection timestamp within 48 hours. Missing data never means zero performance.

Rules rank up to three visible priorities:

- Spend over the brand's investigation threshold with no recorded conversions: check tracking and conversion delay first.
- Unverified Google Ads result definitions: confirm which primary conversion actions count as the intended business result.
- Cost per result above its target: uses Performance's assessment and requires at least ten conversions and a verified result definition.
- GA4 sessions down at least 20%, with at least 100 sessions in the preceding period: identifies the channel with the largest absolute decline without claiming it caused the change. GA4 reports with coverage limitations cannot generate this signal.
- Missing cost targets: save a target before evaluating efficiency.
- Potential campaign growth: verified results, adequate volume, cost at least 15% below target, and cost no higher than the preceding period. Lead quality and capacity still require review.

Every card provides the observed evidence, why it matters, the next step, source, reporting period, and a direct route into the campaign or Goals & tracking. These are deterministic checks, not an exhaustive audit or autonomous budget decisions. “No priority flags” is not an all-clear for the business.

## Follow-through and research

Active actions are scoped to the brand. Due and overdue tasks, saved outcomes needing review, and experiments with sufficient matching history rise to the top. Readiness checks do not save results, modify actions, or send notifications. Open an experiment to calculate and save its outcome. Source identity and sample/live separation use the same measurement engine as Performance.

Competitor ideas come from the last saved website comparison. Today only reads this report; it never starts an OpenAI scan or paid comparison. It shows the research date, supporting links, and suggested test. If brand context or compared competitors changed, it asks for an updated comparison. **Plan this test** opens the existing action form with the original finding and evidence; the user supplies ownership, a hypothesis, and any measurement plan before saving.

## Data modes

PromptPilot and Juniper & Co. show explicitly labeled fictional examples only when no live connection or saved performance reports exist. A failed status request cannot activate samples. Real connected reports always replace the showcase.

CSV findings remain in a separate expandable section, with their own evidence, periods, and review workflow. File imports are optional when live reports are connected. Native GA4 landing-page summaries are still available in Performance; they are not fabricated into daily history.

This feature is work in progress. It does not send alerts while the site is closed, analyze competitor ads, prove causation, or make changes to external marketing accounts.
