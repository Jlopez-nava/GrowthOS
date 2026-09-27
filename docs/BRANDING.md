# Subgrowth Digital interface branding

Applied the supplied September 26 branding guide to the existing working application.

- Forest `#0F2D28`: primary actions, active navigation, headings, contextual panel.
- Sage `#4E7F6D`: supporting accents, outline icons, source status.
- Sand `#F7F4ED`: application background and evidence callouts.
- Charcoal `#1F2937`: primary body text.
- Terracotta `#D8805B`: sampled in sRGB from the guide's visible orange swatch. The printed hex `#E2B6D0` is a pink and conflicts with the pictured terracotta, so the visible swatch takes precedence.
- Plus Jakarta Sans: locally hosted regular, medium, semibold, bold and extra-bold with SIL OFL license. No runtime Google font requests.
- Sans-serif hierarchy adapted for a working application: responsive 32–48px page headings, 24–28px sections, 20–24px card headings, 16px body, 14px controls, 12px secondary metadata.
- Existing outline icon family retained with consistent stroke weight.
- Restrained contour texture on the forest contextual card echoes the guide's patterns.
- Supplied logo remains unchanged at the requested 25% reduction: 132px sidebar width and 180px loading-screen width.
- No changes to analytics, data handling, integrations, or business facts.

Theme overrides are grouped in `app/brand.css`; local fonts live under `public/fonts/`.
