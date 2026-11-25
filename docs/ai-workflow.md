# Low-Token AI Collaboration Workflow

This toolkit separates **deterministic checks (0 tokens)** from **subjective judgment (AI/human review)**:

1. **Layer 1 (Deterministic CLI — 0 Tokens)**:
   Run `seo-audit scan <url> --out ./audit-out`. This produces:
   - `report.json`: full structured raw evidence on disk.
   - `report.<lang>.md`: complete 80-item scorecard and findings table.
   - `ai-digest.json`: compact summary (a few KB) containing only scorecard totals, actionable `Fail`/`Warn` items, and counts of `Not Measured` items.

2. **Layer 2 (Browser Verification — Optional)**:
   For rules that require rendered DOM or real interaction (`01-14`, `01-15`, `01-17`, `03-04`, `04-08`), run a headless browser check (Playwright / Lighthouse) only on representative templates (Homepage, 1 Category Page, 1 Detail Page, 1 Contact/Inquiry Form).

3. **Layer 3 (AI Synthesis — Minimal Tokens)**:
   Provide **only `ai-digest.json`** (never raw HTML or full sitemap dumps) to your preferred AI assistant with a prompt such as:
   > "Review `ai-digest.json`. Prioritize P0/P1 fixes by business impact, separate CMS-controllable fixes from vendor/dev fixes, and propose a 2-week remediation plan."

4. **Retest Verification Loop**:
   After fixes are deployed, re-run with `--compare ./before/report.json` (or `seo-audit diff`) to generate objective before/after proof.
