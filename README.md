# SEO Audit Toolkit

[English](README.md) | [简体中文](README.zh-CN.md)

An open-source, cross-platform, bilingual (**EN / ZH**) deterministic **SEO & GEO audit CLI** covering **80 standardized rules across 5 modules** (`01`–`05`).

Designed around the **"Zero-Token Deterministic First"** philosophy:
- Run deterministic local probes for **0 tokens** (no raw HTML pasted into LLMs).
- Strictly enforce four-state verdicts (`Pass` / `Warn` / `Fail` / `Not Measured`) — never mark unmeasured or permission-gated checks as passed.
- Output human-readable bilingual Markdown reports, machine-readable JSON, compact AI-ready digests (`ai-digest.json`), and before/after retest diffs (`diff`).

## Features

- **5 Modules, 80 Rules** (single-source-of-truth bilingual registry):
  - **Module 01 (26 rules)**: Domain lifecycle (RDAP), DNS/MX/SPF/DMARC, Wayback snapshots, TLS/SSL validity & SAN coverage, 4-entry 301 consolidation, Soft 404, security headers, compression, TTFB, CMS/tech stack fingerprinting.
  - **Module 02 (14 rules)**: `robots.txt`, XML Sitemap parsing & purity sampling, Meta Robots / `X-Robots-Tag`, Canonical tags, facets, pagination, `hreflang`, URL hygiene, BFS click depth, 3-list orphan page cross-check, internal broken links, breadcrumbs.
  - **Module 03 (17 rules)**: Title & Meta Description uniqueness/lengths, H1–H3 hierarchy, viewport, image size/format/lazy-load/`alt`/broken images, HTML `<head>` integrity, template dirty-data scan (`Lorem Ipsum`, `localhost`, untranslated CJK on EN pages), Open Graph, Twitter Card, JSON-LD syntax & Microdata conflict detection, basic form a11y, Privacy Policy & cookie compliance.
  - **Module 04 (14 rules)**: Buyer intent digest, homepage alignment, topical clusters, thin content detection, B2B HTML spec tables, E-E-A-T trust pages, inquiry CTA/form signals, AI crawler `robots.txt` policy (`GPTBot`, `OAI-SearchBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`), Q&A citability, `/llms.txt` & semantic HTML, GA4/GTM tracking.
  - **Module 05 (9 rules)**: Multi-site keyword overlap, cross-site template/domain/tracker leakage, external marketplace copy duplication comparison, official social/`sameAs` footprint, and optional Google Search Console (GSC) JSON summary import.
- **Modular Profiles**: Enable only what you need (`core`, `b2b`, `matrix`, `compliance`).
- **Before / After Retest Diff**: Compare two `report.json` runs to verify P0/P1 fixes.

## Quick Start

Requires **Node.js >= 20**.

```bash
npm install
npm run build

# Scan a single site (English report)
node dist/src/cli.js scan https://example.com --lang en --out ./reports/example

# Scan a single site (Chinese report)
node dist/src/cli.js scan https://example.com --lang zh --out ./reports/example

# Scan multiple sites using a config file
node dist/src/cli.js scan --config config.example.json --lang en --out ./reports/matrix

# Compare before vs after retest reports
node dist/src/cli.js diff ./reports/before/report.json ./reports/after/report.json --lang en

# List all 80 bilingual rules
node dist/src/cli.js rules --lang en
```

## AI Collaboration (Low-Token Workflow)

See [docs/ai-workflow.md](docs/ai-workflow.md) for how to feed `ai-digest.json` (only a few KB) into any AI assistant (Claude Code, Cursor, Gemini, Codex, etc.) for subjective content/E-E-A-T/GEO review without burning tokens on raw HTML.

## Responsible Use Disclaimer

This toolkit performs **passive, read-only HTTP/DNS/TLS checks** only. Always audit websites you own or have explicit authorization to test, and use polite crawl limits (`--max-pages`, `--delay`).

## License

MIT
