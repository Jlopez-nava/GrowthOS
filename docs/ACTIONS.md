# Actions & experiments

GrowthOS connects a finding to a plan, a recorded implementation, and a review. Open **Performance → Actions & experiments**. The button beside Goals & tracking jumps to the board.

## Create work from evidence

1. Open a campaign in **Paid programs**, review its assessment, and select **Create action**. You can also open a CSV opportunity on Today and select **Create action**, or use **New action** on the board.
2. Choose **Task** for work with a completion checklist, or **Experiment** for a measurable change.
3. Assign an owner by name or team, add an optional due date, and describe the work or hypothesis. Assignment does not invite a user, grant access, or send a notification.
4. For an experiment, choose the exact daily report and campaign/channel/page/event, primary metric, success direction, relative improvement target, and 7-, 14-, or 28-day window. The source account, currency, timezone, definition, and sample/live provenance are saved with the plan.
5. Select **Create action**, then **Start work** when ready. The original finding remains attached. Assignment and due date remain editable; the success measure stays fixed for that experiment.

## Record implementation

Make the change in the source tool yourself. Record the implementation date and what changed. GrowthOS never changes campaign budgets, edits pages, or reverts work externally.

A task is completed when its completion note is saved. An experiment moves to Measuring. The baseline is the selected number of days immediately before the implementation date. The after period contains the same number of days immediately after it. The implementation day is excluded, avoiding partial-day comparisons.

For example, a 7-day experiment implemented September 10 compares September 3–9 with September 11–17. With a 7-day reporting buffer, the after period becomes eligible September 24 in the report timezone.

## Check results and save learning

1. Refresh Performance or import the matching daily CSV after the measurement window and reporting buffer have elapsed.
2. Open the action and select **Check results from loaded data**. This check uses the reports already loaded; it does not itself contact Google or Zapier.
3. If available, the baseline is captured when implementation is recorded. Otherwise, a subsequent check captures it. Once captured, it remains fixed. Checks can save a ready baseline while the after period is still pending.
4. Review before/after values, observed change, and whether your chosen target was met. Rates are computed from summed numerators and denominators, not averaged daily rates. A non-positive baseline has no relative percentage change or percentage-target claim. A rate with a zero denominator is unavailable.
5. Choose **Keep**, **Iterate**, **Revert**, or **Inconclusive**, record what you learned, and close the experiment. Keep/iterate/revert require a saved comparison; inconclusive can close an experiment with insufficient evidence. Decisions are records, not instructions executed in external tools.

Use **All actions** or **Completed** to revisit outcomes. Each action includes an activity history and a JSON export. Cancellation records a reason and retains history.

## Persistence and boundaries

- Hosted company actions are included in the selected brand's encrypted workspace snapshot. Existing authorization, revision checks, and conditional R2 writes apply. Teammates see the same actions, subject to the existing company-wide access model.
- The server validates the optional action payload and rejects another brand's records. Workspaces created before this feature need no migration.
- Demo and sandbox actions remain local to that browser, as those workspace modes already specify. They never become production reports. The separate optional Supabase workspace path does not yet support action storage; creation is disabled there.
- Live and sample sources cannot be combined. CSV comparisons require one valid record for every day, including zero-activity days. Missing, overlapping, incompatible, or immature data cannot produce a valid comparison.
- Checks are manual. There are no background reminders, email assignments, scheduled outcome checks, or automatic campaign changes.
- Before/after movement is observational. It does not prove causality, control for seasonality or concurrent changes, or establish statistical significance. Inspect traffic mix, tracking, conversion quality, and other interventions before deciding.
- Provider reports retain a rolling 56-day history. Capture baselines promptly after their reporting buffer; long or old experiments can require matching CSV history or a future backfill capability. A 28-day before/after comparison plus the excluded implementation day spans 57 days, so its baseline must be captured before the earliest day rolls out of the live report.
- Limits: 200 actions per workspace, 1,000 activity entries per action, within the shared workspace's existing 10 MB limit. Avoid confidential customer data in titles or notes; use anonymized references.
