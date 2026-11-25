import assert from "node:assert/strict";
import http from "node:http";
import { describe, it } from "node:test";
import {
  buildAiDigest,
  DEFAULT_THRESHOLDS,
  DEFAULT_USER_AGENT,
  diffAuditReports,
  renderDiffMarkdown,
  renderMarkdownReport,
  RULES,
  runAudit,
  type AuditConfig,
} from "../src/index.js";

function startMockSite(options: {
  siteLabel: string;
  injectErrors: boolean;
  leakPeerDomain?: string;
}): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url ?? "/";

      if (urlPath === "/robots.txt") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        const host = req.headers.host ?? "127.0.0.1";
        res.end(
          `User-agent: *\nAllow: /\nSitemap: http://${host}/sitemap.xml\n`
        );
        return;
      }

      if (urlPath === "/sitemap.xml") {
        const host = req.headers.host ?? "127.0.0.1";
        res.writeHead(200, { "Content-Type": "application/xml" });
        const orphanEntry = options.injectErrors
          ? `<url><loc>http://${host}/orphan-page</loc></url>`
          : "";
        res.end(
          `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>http://${host}/</loc></url>
            <url><loc>http://${host}/products</loc></url>
            <url><loc>http://${host}/about</loc></url>
            ${orphanEntry}
          </urlset>`
        );
        return;
      }

      if (urlPath === "/llms.txt") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("# Example Site\n> High-quality industrial supplier.\n");
        return;
      }

      if (urlPath === "/hero.webp") {
        res.writeHead(200, {
          "Content-Type": "image/webp",
          "Content-Length": "1024",
        });
        res.end(Buffer.alloc(1024));
        return;
      }

      if (urlPath === "/broken-link" || urlPath.startsWith("/seo-audit-nonexistent")) {
        if (options.injectErrors && urlPath.startsWith("/seo-audit-nonexistent")) {
          // Simulate Soft 404!
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end("<html><body>Page not found (soft 404)</body></html>");
          return;
        }
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<html><body>404 Not Found</body></html>");
        return;
      }

      const host = req.headers.host ?? "127.0.0.1";
      const longCopy = Array(45)
        .fill("Precision engineered custom manufacturing components with ISO certified quality control and reliable global shipping.")
        .join(" ");

      const headers: Record<string, string> = {
        "Content-Type": "text/html; charset=utf-8",
        "Strict-Transport-Security": "max-age=31536000",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=3600",
      };

      if (urlPath === "/privacy-policy") {
        res.writeHead(200, headers);
        res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Privacy Policy | ${options.siteLabel}</title><meta name="description" content="Privacy policy and inquiry data handling for ${options.siteLabel}."><link rel="canonical" href="http://${host}/privacy-policy"></head><body><main><h1>Privacy Policy</h1><p>${longCopy}</p></main></body></html>`);
        return;
      }

      if (urlPath === "/" || urlPath === "/products" || urlPath === "/about" || urlPath === "/orphan-page") {
        const titleMap: Record<string, string> = {
          "/": `${options.siteLabel} - Custom Industrial Manufacturing Supplier`,
          "/products": options.injectErrors
            ? `${options.siteLabel} - Custom Industrial Manufacturing Supplier` // duplicate title
            : `Custom Product Catalog & Specs | ${options.siteLabel}`,
          "/about": `About Our Factory & Quality Control | ${options.siteLabel}`,
          "/orphan-page": `Orphan Product Model 500 | ${options.siteLabel}`,
        };

        const dirtySnippet = options.injectErrors
          ? `<p>Lorem ipsum dolor sit amet</p><a href="/broken-link">Broken</a>`
          : "";
        const badJsonLd = options.injectErrors
          ? `<script type="application/ld+json">{ invalid json }</script>`
          : `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"${options.siteLabel}","sameAs":["https://www.linkedin.com/company/example"]}</script>
             <script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[]}</script>`;
        const leakSnippet = options.leakPeerDomain
          ? `<p>Contact sales@${options.leakPeerDomain}</p>`
          : "";
        const ga4Snippet = options.injectErrors
          ? ""
          : `<script>window.gaId = "G-ABC1234567";</script>`;

        res.writeHead(200, headers);
        res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${titleMap[urlPath]}</title>
  <meta name="description" content="Factory-direct OEM manufacturing for ${urlPath} by ${options.siteLabel} with clear specifications, low MOQ, and fast sampling.">
  <link rel="canonical" href="http://${host}${urlPath}">
  <meta property="og:title" content="${titleMap[urlPath]}">
  <meta property="og:description" content="Factory-direct OEM manufacturing.">
  <meta property="og:url" content="http://${host}${urlPath}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="http://${host}/hero.webp">
  <meta name="twitter:card" content="summary_large_image">
  ${badJsonLd}
  ${ga4Snippet}
</head>
<body>
  <nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/products">Products</a> / <a href="/about">About Us</a> / <a href="/about#contact">Contact</a> / <a href="/about#faq">FAQ</a></nav>
  <main>
    <h1>${titleMap[urlPath]}</h1>
    <img src="/hero.webp" alt="Custom precision industrial product" width="800" height="600">
    <h2>How do you ensure manufacturing quality?</h2>
    <p>Every batch undergoes three-stage dimensional inspection and certified material testing prior to export.</p>
    <table><tr><th>Material</th><th>MOQ</th></tr><tr><td>316L Steel</td><td>500 pcs</td></tr></table>
    <p>${longCopy}</p>
    ${dirtySnippet}
    ${leakSnippet}
    <form><label for="email">Email</label><input id="email" type="email"><button type="submit">Request Quote</button></form>
  </main>
  <footer>
    <p>${options.siteLabel} | info@example.test | We use cookies to improve experience.</p>
    <a href="/privacy-policy">Privacy Policy</a>
  </footer>
</body>
</html>`);
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      assert.ok(addr && typeof addr === "object");
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

describe("SEO Audit Toolkit — 80-Rule Registry & Full Modules 01-05", () => {
  it("contains exactly 80 bilingual rules across modules 01-05", () => {
    assert.equal(RULES.length, 80);
    const counts = { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0 };
    for (const r of RULES) {
      counts[r.module]++;
      assert.ok(r.title.en.length > 0, `${r.id} missing EN title`);
      assert.ok(r.title.zh.length > 0, `${r.id} missing ZH title`);
      assert.ok(r.remediation.en.length > 0, `${r.id} missing EN remediation`);
      assert.ok(r.remediation.zh.length > 0, `${r.id} missing ZH remediation`);
    }
    assert.deepEqual(counts, { "01": 26, "02": 14, "03": 17, "04": 14, "05": 9 });
  });

  it("runs all 5 modules, detects injected failures, and computes diff when fixed", async () => {
    const brokenSite = await startMockSite({
      siteLabel: "Alpha Packaging",
      injectErrors: true,
    });
    const fixedSite = await startMockSite({
      siteLabel: "Alpha Packaging",
      injectErrors: false,
    });

    try {
      const makeConfig = (url: string, lang: "en" | "zh"): AuditConfig => ({
        sites: [{ url, name: "Alpha Packaging", expectedBrand: "Alpha Packaging" }],
        modules: ["01", "02", "03", "04", "05"],
        profiles: ["core", "b2b", "matrix"],
        lang,
        maxPages: 20,
        maxDepth: 3,
        concurrency: 2,
        delayMs: 0,
        timeoutMs: 5000,
        userAgent: DEFAULT_USER_AGENT,
        respectRobots: true,
        skipExternalNetworkLookups: true,
        networkLabel: "test-local",
        thresholds: DEFAULT_THRESHOLDS,
      });

      const beforeReport = await runAudit(makeConfig(brokenSite.baseUrl, "en"));
      const afterReport = await runAudit(makeConfig(fixedSite.baseUrl, "zh"));

      // Verify all 80 rules appear in report
      assert.equal(beforeReport.sites[0].results.length, 80);
      assert.equal(afterReport.sites[0].results.length, 80);

      const getStatus = (rep: typeof beforeReport, id: string) =>
        rep.sites[0].results.find((r) => r.ruleId === id)?.status;

      // Injected failures should be caught accurately
      assert.equal(getStatus(beforeReport, "01-07"), "Fail"); // Soft 404
      assert.equal(getStatus(beforeReport, "02-12"), "Fail"); // Orphan page
      assert.equal(getStatus(beforeReport, "02-13"), "Fail"); // Broken internal link
      assert.equal(getStatus(beforeReport, "03-01"), "Fail"); // Duplicate title
      assert.equal(getStatus(beforeReport, "03-10"), "Fail"); // Lorem Ipsum dirty data
      assert.equal(getStatus(beforeReport, "03-13"), "Fail"); // Invalid JSON-LD
      assert.equal(getStatus(beforeReport, "04-14"), "Fail"); // Missing GA4/GTM

      // Fixed site should pass those exact checks
      assert.equal(getStatus(afterReport, "01-07"), "Pass");
      assert.equal(getStatus(afterReport, "02-12"), "Pass");
      assert.equal(getStatus(afterReport, "02-13"), "Pass");
      assert.equal(getStatus(afterReport, "03-01"), "Pass");
      assert.equal(getStatus(afterReport, "03-10"), "Pass");
      assert.equal(getStatus(afterReport, "03-13"), "Pass");
      assert.equal(getStatus(afterReport, "04-14"), "Pass");

      // Verify Not Measured is strictly excluded from denominator
      const totals = afterReport.sites[0].totals;
      const measuredDenom = totals.pass + totals.warn + totals.fail;
      assert.ok(totals.notMeasured > 0);
      assert.equal(
        totals.passRate,
        Number(((totals.pass / measuredDenom) * 100).toFixed(1))
      );

      // Verify bilingual Markdown rendering
      const enMd = renderMarkdownReport(beforeReport, "en");
      const zhMd = renderMarkdownReport(afterReport, "zh");
      assert.ok(enMd.includes("Module Scorecard"));
      assert.ok(zhMd.includes("分模块计分卡"));

      // Verify compact AI digest
      const digest = buildAiDigest(beforeReport);
      assert.ok(JSON.stringify(digest).length < 15000);

      // Align canonicalOrigin so diff compares same logical site
      afterReport.sites[0].canonicalOrigin = beforeReport.sites[0].canonicalOrigin;
      const diff = diffAuditReports(beforeReport, afterReport);
      assert.ok(diff.improved.length >= 7);
      assert.equal(diff.regressed.length, 0);
      const diffMdZh = renderDiffMarkdown(diff, "zh");
      assert.ok(diffMdZh.includes("SEO 复测前后对比报告"));
    } finally {
      brokenSite.server.close();
      fixedSite.server.close();
    }
  });
});
