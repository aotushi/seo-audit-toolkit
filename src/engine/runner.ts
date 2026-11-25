import { RULE_SET_VERSION } from "../rules/registry.js";
import type {
  AuditConfig,
  AuditReport,
  CheckResult,
  ModuleId,
  ModuleScorecard,
  SiteAuditReport,
  SiteConfig,
} from "../types.js";
import { fetchWithTrace, normalizeUrl, sleep } from "../utils/http.js";
import { parseHtmlPage } from "../utils/html.js";
import type { RobotsInfo, SiteCrawlContext } from "../probes/context.js";
import { runModule01 } from "../probes/module01.js";
import { runModule02 } from "../probes/module02.js";
import { runModule03 } from "../probes/module03.js";
import { runModule04 } from "../probes/module04.js";
import {
  buildMatrixSummaryResults,
  runModule05ForSite,
} from "../probes/module05.js";

export const TOOL_VERSION = "1.0.0";

function parseRobotsTxt(url: string, statusCode: number, body: string): RobotsInfo {
  const sitemaps: string[] = [];
  const rulesByAgent: Record<string, { allow: string[]; disallow: string[] }> = {};
  let currentAgents: string[] = [];

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();

    if (key === "user-agent") {
      const agent = val.toLowerCase();
      currentAgents = [agent];
      if (!rulesByAgent[agent]) {
        rulesByAgent[agent] = { allow: [], disallow: [] };
      }
    } else if (key === "disallow" && val) {
      for (const a of currentAgents) {
        rulesByAgent[a]?.disallow.push(val);
      }
    } else if (key === "allow" && val) {
      for (const a of currentAgents) {
        rulesByAgent[a]?.allow.push(val);
      }
    } else if (key === "sitemap" && val) {
      sitemaps.push(val);
    }
  }

  const wildcard = rulesByAgent["*"];
  const disallowsAll = Boolean(
    wildcard &&
      wildcard.disallow.includes("/") &&
      !wildcard.allow.includes("/")
  );

  return {
    url,
    statusCode,
    body,
    sitemaps: Array.from(new Set(sitemaps)),
    disallowsAll,
    rulesByAgent,
  };
}

async function fetchSitemapUrls(
  candidates: string[],
  config: AuditConfig
): Promise<{ urls: string[]; errors: string[] }> {
  const urls = new Set<string>();
  const errors: string[] = [];
  const queue = [...candidates];
  const visitedSitemaps = new Set<string>();
  let processedSitemaps = 0;

  while (queue.length > 0 && processedSitemaps < 10 && urls.size < 20000) {
    const smUrl = queue.shift()!;
    if (visitedSitemaps.has(smUrl)) continue;
    visitedSitemaps.add(smUrl);
    processedSitemaps++;

    const res = await fetchWithTrace(smUrl, {
      timeoutMs: config.timeoutMs,
      userAgent: config.userAgent,
      rejectUnauthorized: false,
      maxBodyBytes: 5 * 1024 * 1024,
    });
    if (res.error || res.statusCode !== 200) {
      errors.push(`${smUrl}: ${res.error ?? `HTTP ${res.statusCode}`}`);
      continue;
    }

    const body = res.body;
    const isIndex = /<sitemapindex\b/i.test(body);
    const locMatches = body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi);
    for (const m of locMatches) {
      const loc = m[1].trim();
      if (isIndex) {
        queue.push(loc);
      } else {
        const norm = normalizeUrl(loc);
        if (norm) urls.add(norm);
      }
    }
  }

  return { urls: Array.from(urls), errors };
}

function isDisallowedByRobots(urlStr: string, robots?: RobotsInfo): boolean {
  if (!robots || robots.statusCode !== 200) return false;
  const rules = robots.rulesByAgent["*"];
  if (!rules) return false;
  const pathname = new URL(urlStr).pathname;
  for (const allow of rules.allow) {
    if (pathname.startsWith(allow)) return false;
  }
  for (const disallow of rules.disallow) {
    if (disallow && pathname.startsWith(disallow)) return true;
  }
  return false;
}

async function crawlSite(
  site: SiteConfig,
  config: AuditConfig
): Promise<SiteCrawlContext> {
  const startUrlStr = site.url.startsWith("http") ? site.url : `https://${site.url}`;
  const startUrl = new URL(startUrlStr);

  const ctx: SiteCrawlContext = {
    site,
    config,
    startUrl,
    canonicalOrigin: startUrl.origin,
    sitemapUrls: [],
    sitemapErrors: [],
    crawledPages: new Map(),
    clickDepth: new Map(),
    brokenInternalLinks: [],
    redirectInternalLinks: [],
  };

  // 1) Fetch homepage
  const homeRes = await fetchWithTrace(startUrl.toString(), {
    timeoutMs: config.timeoutMs,
    userAgent: config.userAgent,
    rejectUnauthorized: false,
  });
  ctx.homepageResponse = homeRes;

  if (!homeRes.error && homeRes.finalUrl) {
    try {
      ctx.canonicalOrigin = new URL(homeRes.finalUrl).origin;
    } catch {
      // keep startUrl.origin
    }
  }

  // 2) Fetch robots.txt & sitemap
  const robotsUrl = new URL("/robots.txt", ctx.canonicalOrigin).toString();
  const robotsRes = await fetchWithTrace(robotsUrl, {
    timeoutMs: config.timeoutMs,
    userAgent: config.userAgent,
    rejectUnauthorized: false,
    maxBodyBytes: 512 * 1024,
  });
  ctx.robots = parseRobotsTxt(
    robotsUrl,
    robotsRes.statusCode,
    robotsRes.error ? "" : robotsRes.body
  );

  const sitemapCandidates =
    ctx.robots.sitemaps.length > 0
      ? ctx.robots.sitemaps
      : [new URL("/sitemap.xml", ctx.canonicalOrigin).toString()];
  const sm = await fetchSitemapUrls(sitemapCandidates, config);
  ctx.sitemapUrls = sm.urls;
  ctx.sitemapErrors = sm.errors;

  if (homeRes.error || homeRes.statusCode === 0) {
    return ctx;
  }

  const normalizedHome = normalizeUrl(homeRes.finalUrl) ?? startUrl.toString();
  const homePage = parseHtmlPage(
    normalizedHome,
    homeRes.statusCode,
    homeRes.headers,
    homeRes.body,
    homeRes.ttfbMs,
    homeRes.byteLength
  );
  ctx.homepage = homePage;
  ctx.crawledPages.set(normalizedHome, homePage);
  ctx.clickDepth.set(normalizedHome, 0);

  // 3) Bounded BFS crawl
  const canonicalHost = new URL(ctx.canonicalOrigin).hostname.toLowerCase();
  const queue: Array<{ url: string; depth: number; source: string }> = [];
  const enqueued = new Set<string>([normalizedHome]);

  for (const link of homePage.links) {
    if (!link.isInternal || !link.resolvedUrl) continue;
    if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|zip|mp4|css|js|ico)(\?|$)/i.test(link.resolvedUrl)) {
      continue;
    }
    if (!enqueued.has(link.resolvedUrl)) {
      enqueued.add(link.resolvedUrl);
      queue.push({ url: link.resolvedUrl, depth: 1, source: normalizedHome });
    }
  }

  while (queue.length > 0 && ctx.crawledPages.size < config.maxPages) {
    const item = queue.shift()!;
    if (item.depth > config.maxDepth) continue;
    if (config.respectRobots && isDisallowedByRobots(item.url, ctx.robots)) {
      continue;
    }

    if (config.delayMs > 0) await sleep(config.delayMs);

    const res = await fetchWithTrace(item.url, {
      timeoutMs: config.timeoutMs,
      userAgent: config.userAgent,
      rejectUnauthorized: false,
    });

    if (res.error || res.statusCode >= 400 || res.statusCode === 0) {
      ctx.brokenInternalLinks.push({
        source: item.source,
        target: item.url,
        statusCode: res.statusCode,
        error: res.error,
      });
      continue;
    }

    if (res.hops.length > 1) {
      ctx.redirectInternalLinks.push({
        source: item.source,
        target: item.url,
        hops: res.hops.length - 1,
        finalUrl: res.finalUrl,
      });
    }

    const ct = (res.headers["content-type"] ?? "").toLowerCase();
    if (ct && !ct.includes("text/html") && !ct.includes("application/xhtml")) {
      continue;
    }

    const finalNorm = normalizeUrl(res.finalUrl) ?? item.url;
    if (ctx.crawledPages.has(finalNorm)) continue;

    const parsed = parseHtmlPage(
      finalNorm,
      res.statusCode,
      res.headers,
      res.body,
      res.ttfbMs,
      res.byteLength
    );
    ctx.crawledPages.set(finalNorm, parsed);
    ctx.clickDepth.set(finalNorm, item.depth);

    if (item.depth < config.maxDepth) {
      for (const link of parsed.links) {
        if (!link.resolvedUrl) continue;
        try {
          if (new URL(link.resolvedUrl).hostname.toLowerCase() !== canonicalHost) {
            continue;
          }
        } catch {
          continue;
        }
        if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|zip|mp4|css|js|ico)(\?|$)/i.test(link.resolvedUrl)) {
          continue;
        }
        if (!enqueued.has(link.resolvedUrl)) {
          enqueued.add(link.resolvedUrl);
          queue.push({
            url: link.resolvedUrl,
            depth: item.depth + 1,
            source: finalNorm,
          });
        }
      }
    }
  }

  return ctx;
}

export function computeScorecard(
  results: CheckResult[],
  modules: ModuleId[]
): { scorecard: ModuleScorecard[]; totals: Omit<ModuleScorecard, "module"> } {
  const scorecard: ModuleScorecard[] = modules.map((mod) => {
    const modResults = results.filter((r) => r.module === mod);
    const pass = modResults.filter((r) => r.status === "Pass").length;
    const warn = modResults.filter((r) => r.status === "Warn").length;
    const fail = modResults.filter((r) => r.status === "Fail").length;
    const notMeasured = modResults.filter((r) => r.status === "Not Measured").length;
    const p0Failures = modResults.filter(
      (r) => r.status === "Fail" && r.priority === "P0"
    ).length;
    const denom = pass + warn + fail;
    return {
      module: mod,
      totalRules: modResults.length,
      pass,
      warn,
      fail,
      notMeasured,
      p0Failures,
      passRate: denom > 0 ? Number(((pass / denom) * 100).toFixed(1)) : null,
    };
  });

  const pass = scorecard.reduce((s, m) => s + m.pass, 0);
  const warn = scorecard.reduce((s, m) => s + m.warn, 0);
  const fail = scorecard.reduce((s, m) => s + m.fail, 0);
  const notMeasured = scorecard.reduce((s, m) => s + m.notMeasured, 0);
  const p0Failures = scorecard.reduce((s, m) => s + m.p0Failures, 0);
  const totalRules = scorecard.reduce((s, m) => s + m.totalRules, 0);
  const denom = pass + warn + fail;

  return {
    scorecard,
    totals: {
      totalRules,
      pass,
      warn,
      fail,
      notMeasured,
      p0Failures,
      passRate: denom > 0 ? Number(((pass / denom) * 100).toFixed(1)) : null,
    },
  };
}

export async function runAudit(config: AuditConfig): Promise<AuditReport> {
  const contexts: SiteCrawlContext[] = [];
  for (const site of config.sites) {
    contexts.push(await crawlSite(site, config));
  }

  const siteReports: SiteAuditReport[] = [];
  for (const ctx of contexts) {
    const results: CheckResult[] = [];
    if (config.modules.includes("01")) {
      results.push(...(await runModule01(ctx)));
    }
    if (config.modules.includes("02")) {
      results.push(...(await runModule02(ctx)));
    }
    if (config.modules.includes("03")) {
      results.push(...(await runModule03(ctx)));
    }
    if (config.modules.includes("04")) {
      results.push(...(await runModule04(ctx)));
    }
    if (config.modules.includes("05")) {
      results.push(...(await runModule05ForSite(ctx, contexts)));
    }

    const { scorecard, totals } = computeScorecard(results, config.modules);
    siteReports.push({
      site: ctx.site,
      canonicalOrigin: ctx.canonicalOrigin,
      crawledPages: ctx.crawledPages.size,
      sitemapUrlsCount: ctx.sitemapUrls.length,
      results,
      scorecard,
      totals,
    });
  }

  const matrixResults = config.modules.includes("05")
    ? buildMatrixSummaryResults(contexts, config)
    : [];

  return {
    metadata: {
      toolName: "seo-audit-toolkit",
      toolVersion: TOOL_VERSION,
      ruleSetVersion: RULE_SET_VERSION,
      generatedAt: new Date().toISOString(),
      networkLabel: config.networkLabel ?? "local",
      modulesRun: config.modules,
      profilesEnabled: config.profiles,
      maxPages: config.maxPages,
      maxDepth: config.maxDepth,
      lang: config.lang,
    },
    sites: siteReports,
    matrixResults,
  };
}

/**
 * Produces a compact low-token JSON digest suitable for feeding directly to an AI model
 * without pasting raw HTML or large URL dumps.
 */
export function buildAiDigest(report: AuditReport): Record<string, unknown> {
  return {
    metadata: report.metadata,
    sites: report.sites.map((s) => ({
      url: s.canonicalOrigin,
      crawledPages: s.crawledPages,
      sitemapUrlsCount: s.sitemapUrlsCount,
      totals: s.totals,
      scorecard: s.scorecard,
      actionableFindings: s.results
        .filter((r) => r.status === "Fail" || r.status === "Warn")
        .map((r) => ({
          ruleId: r.ruleId,
          priority: r.priority,
          status: r.status,
          summary: r.summary[report.metadata.lang],
          affectedSample: r.affectedUrls?.slice(0, 5),
        })),
      manualOrNotMeasuredCount: s.results.filter((r) => r.status === "Not Measured").length,
    })),
    matrixFindings: report.matrixResults.map((r) => ({
      ruleId: r.ruleId,
      status: r.status,
      summary: r.summary[report.metadata.lang],
    })),
  };
}
