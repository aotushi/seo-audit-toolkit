import fs from "node:fs";
import type { AuditConfig, CheckResult } from "../types.js";
import { fetchWithTrace, getApexDomain } from "../utils/http.js";
import { parseHtmlPage } from "../utils/html.js";
import {
  isProfileEnabled,
  makeResult,
  notMeasured,
  type SiteCrawlContext,
} from "./context.js";

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) {
    if (b.has(w)) inter++;
  }
  return inter / (a.size + b.size - inter);
}

export async function runModule05ForSite(
  ctx: SiteCrawlContext,
  allContexts: SiteCrawlContext[]
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const { config, site } = ctx;
  const pages = Array.from(ctx.crawledPages.values());
  const isMultiSite = allContexts.length > 1;

  // 05-01: Multi-Site Positioning & Keyword Overlap
  if (!isMultiSite || !isProfileEnabled("05-01", config)) {
    results.push(
      notMeasured("05-01", {
        en: "Single-site audit or matrix profile disabled (N/A).",
        zh: "单站审计或未启用站群矩阵扩展包（不适用，不计入分母）。",
      })
    );
  } else {
    const myTokens = tokenize(
      pages.map((p) => `${p.title} ${p.h1s.join(" ")}`).join(" ")
    );
    const overlaps: Array<{ peer: string; similarity: number }> = [];
    for (const peer of allContexts) {
      if (peer === ctx) continue;
      const peerTokens = tokenize(
        Array.from(peer.crawledPages.values())
          .map((p) => `${p.title} ${p.h1s.join(" ")}`)
          .join(" ")
      );
      const sim = Number(jaccardSimilarity(myTokens, peerTokens).toFixed(2));
      if (sim >= 0.45) {
        overlaps.push({ peer: peer.canonicalOrigin, similarity: sim });
      }
    }
    results.push(
      makeResult(
        "05-01",
        overlaps.length === 0 ? "Pass" : overlaps.some((o) => o.similarity >= 0.7) ? "Fail" : "Warn",
        "reproduced",
        {
          en:
            overlaps.length === 0
              ? "Low title/H1 keyword overlap across audited sites."
              : `High title/H1 overlap detected with ${overlaps.map((o) => `${o.peer} (${o.similarity})`).join(", ")}.`,
          zh:
            overlaps.length === 0
              ? "与其他受检站点的标题/H1 核心词重合度低，定位区隔清晰。"
              : `检测到与以下站点标题/H1 高度重合：${overlaps.map((o) => `${o.peer} (${o.similarity})`).join(", ")}。`,
        },
        { overlaps }
      )
    );
  }

  // 05-02: Cross-Site Template Cloning & Brand/Email Leakage
  if (!isMultiSite || !isProfileEnabled("05-02", config)) {
    results.push(
      notMeasured("05-02", {
        en: "Single-site audit or matrix profile disabled (N/A).",
        zh: "单站审计或未启用站群矩阵扩展包（不适用，不计入分母）。",
      })
    );
  } else {
    const myApex = getApexDomain(ctx.startUrl.hostname);
    const otherDomains = allContexts
      .filter((c) => c !== ctx)
      .map((c) => getApexDomain(c.startUrl.hostname))
      .filter((d) => d !== myApex);

    const leakedDomains: string[] = [];
    const combinedText = pages.map((p) => `${p.visibleText} ${p.emails.join(" ")}`).join(" ").toLowerCase();
    for (const other of otherDomains) {
      if (combinedText.includes(other)) {
        leakedDomains.push(other);
      }
    }
    results.push(
      makeResult(
        "05-02",
        leakedDomains.length === 0 ? "Pass" : "Fail",
        "reproduced",
        {
          en:
            leakedDomains.length === 0
              ? "No cross-site domain or email leakage detected from sibling sites."
              : `Cross-site template leakage detected: references to [${leakedDomains.join(", ")}] found on this site.`,
          zh:
            leakedDomains.length === 0
              ? "未发现残留其他站群域名或错误邮箱的模板克隆痕迹。"
              : `检测到跨站残留风险：本站正文或邮箱中出现其他站点域名 [${leakedDomains.join(", ")}]。`,
        },
        { leakedDomains }
      )
    );
  }

  // 05-03: Standalone Site vs External Comparison / Marketplace Copy
  const extUrls = site.externalComparisonUrls ?? [];
  if (extUrls.length === 0 || !isProfileEnabled("05-03", config)) {
    results.push(
      notMeasured("05-03", {
        en: "No external marketplace/comparison URLs configured (N/A).",
        zh: "未配置外部平台对照链接（不适用，不计入分母）。",
      })
    );
  } else {
    const myTokens = tokenize(pages.map((p) => p.visibleText).join(" "));
    const comps: Array<{ url: string; similarity: number; error?: string }> = [];
    for (const ext of extUrls.slice(0, 5)) {
      const r = await fetchWithTrace(ext, {
        timeoutMs: config.timeoutMs,
        userAgent: config.userAgent,
        rejectUnauthorized: false,
      });
      if (r.error || r.statusCode >= 400) {
        comps.push({ url: ext, similarity: 0, error: r.error ?? `HTTP ${r.statusCode}` });
      } else {
        const parsed = parseHtmlPage(ext, r.statusCode, r.headers, r.body, r.ttfbMs, r.byteLength);
        const sim = Number(jaccardSimilarity(myTokens, tokenize(parsed.visibleText)).toFixed(2));
        comps.push({ url: ext, similarity: sim });
      }
    }
    const maxSim = Math.max(...comps.map((c) => c.similarity), 0);
    results.push(
      makeResult(
        "05-03",
        maxSim >= 0.7 ? "Fail" : maxSim >= 0.45 ? "Warn" : "Pass",
        "reproduced",
        {
          en: `Compared against ${comps.length} external URL(s); max text overlap=${maxSim}.`,
          zh: `已与 ${comps.length} 条外部对照链接查重，最高文本重合度=${maxSim}。`,
        },
        { comparisons: comps }
      )
    );
  }

  // 05-04: Cross-Channel Brand & Company Entity Alignment (Manual)
  results.push(
    notMeasured("05-04", {
      en: "Cross-channel entity verification across B2B marketplaces requires business roster confirmation.",
      zh: "跨渠道（如阿里/MIC）公司实体一致性需结合业务台账人工核对。",
    })
  );

  // 05-05: External Directory / Partner Catalog Attribution (Manual)
  results.push(
    notMeasured("05-05", {
      en: "External partner catalog attribution requires business ownership confirmation.",
      zh: "外部补充目录/合作站归属需向业务方核实确认。",
    })
  );

  // 05-06: Legacy Domain & Broken Backlink Reclamation (Manual / Backlink API)
  results.push(
    notMeasured("05-06", {
      en: "Backlink reclamation requires GSC or third-party backlink dataset (Ahrefs/Semrush).",
      zh: "历史旧域与失效外链回收需接入 GSC 或第三方外链数据源。",
    })
  );

  // 05-07: Competitor Link-Worthy Asset Analysis (Manual)
  results.push(
    notMeasured("05-07", {
      en: "Competitor backlink content analysis requires external backlink data and manual review.",
      zh: "同市场竞品获链资产抽查需结合外部外链数据与人工核实。",
    })
  );

  // 05-08: Off-Page Brand Footprint & Social/sameAs Links
  const socialLinks = Array.from(new Set(pages.flatMap((p) => p.socialLinks)));
  results.push(
    makeResult(
      "05-08",
      socialLinks.length > 0 ? "Pass" : "Warn",
      "tool_signal",
      {
        en:
          socialLinks.length > 0
            ? `Found ${socialLinks.length} official social/sameAs profile link(s) on site.`
            : "No official social profile links (LinkedIn, YouTube, etc.) or Schema sameAs links detected.",
        zh:
          socialLinks.length > 0
            ? `站内检测到 ${socialLinks.length} 条官方社交/sameAs 外部档案链接。`
            : "站内未检测到 LinkedIn/YouTube 等官方外部档案链接或 Schema sameAs 声明。",
      },
      { socialLinks: socialLinks.slice(0, 15) }
    )
  );

  // 05-09: GSC Verification Loop (Optional JSON Import Hook)
  if (!site.gscSummaryFile) {
    results.push(
      notMeasured(
        "05-09",
        {
          en: "No Google Search Console summary file provided (configure gscSummaryFile to enable).",
          zh: "尚未接入 Google Search Console 数据（可通过 gscSummaryFile 导入汇总文件启用核验）。",
        },
        "needs_gsc"
      )
    );
  } else {
    try {
      const raw = JSON.parse(fs.readFileSync(site.gscSummaryFile, "utf8")) as {
        indexedPages?: number;
        notIndexedPages?: number;
        crawlErrors?: number;
        strikingDistanceQueries?: Array<{ query: string; position: number; impressions: number }>;
      };
      const crawlErrors = raw.crawlErrors ?? 0;
      const indexed = raw.indexedPages ?? 0;
      const notIndexed = raw.notIndexedPages ?? 0;
      const striking = raw.strikingDistanceQueries?.length ?? 0;
      const status =
        crawlErrors > 0 || indexed === 0
          ? "Fail"
          : notIndexed > indexed
            ? "Warn"
            : "Pass";
      results.push(
        makeResult(
          "05-09",
          status,
          "reproduced",
          {
            en: `GSC imported: indexed=${indexed}, notIndexed=${notIndexed}, crawlErrors=${crawlErrors}, striking-distance(8-20) queries=${striking}.`,
            zh: `已导入 GSC 数据：已收录=${indexed}，未收录=${notIndexed}，抓取错误=${crawlErrors}，第 8–20 名机会词=${striking}。`,
          },
          { gsc: raw }
        )
      );
    } catch (err) {
      results.push(
        notMeasured(
          "05-09",
          {
            en: `Failed to read GSC summary file (${err instanceof Error ? err.message : String(err)}).`,
            zh: `读取 GSC 汇总文件失败（${err instanceof Error ? err.message : String(err)}）。`,
          },
          "needs_gsc"
        )
      );
    }
  }

  return results;
}

export function buildMatrixSummaryResults(
  allContexts: SiteCrawlContext[],
  config: AuditConfig
): CheckResult[] {
  if (allContexts.length < 2 || !config.profiles.includes("matrix")) {
    return [];
  }
  // Check shared GA4/GTM IDs across distinct domains
  const trackerOwners = new Map<string, string[]>();
  for (const ctx of allContexts) {
    const ids = new Set(
      Array.from(ctx.crawledPages.values()).flatMap((p) => [
        ...p.tracking.ga4Ids,
        ...p.tracking.gtmIds,
      ])
    );
    for (const id of ids) {
      trackerOwners.set(id, [...(trackerOwners.get(id) ?? []), ctx.canonicalOrigin]);
    }
  }
  const sharedTrackers = Array.from(trackerOwners.entries()).filter(
    ([, owners]) => owners.length > 1
  );
  if (sharedTrackers.length === 0) return [];
  return [
    makeResult(
      "05-02",
      "Warn",
      "reproduced",
      {
        en: `Shared analytics ID(s) detected across multiple sites: ${sharedTrackers.map(([id, o]) => `${id} (${o.length} sites)`).join(", ")}.`,
        zh: `检测到多个站点共用同一统计代码 ID：${sharedTrackers.map(([id, o]) => `${id}（${o.length} 站共用）`).join(", ")}。`,
      },
      { sharedTrackers: Object.fromEntries(sharedTrackers) }
    ),
  ];
}
