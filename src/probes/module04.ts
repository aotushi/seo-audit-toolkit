import type { CheckResult } from "../types.js";
import { fetchWithTrace } from "../utils/http.js";
import {
  isProfileEnabled,
  makeResult,
  notMeasured,
  type SiteCrawlContext,
} from "./context.js";

const AI_BOTS = [
  "oai-searchbot",
  "gptbot",
  "claudebot",
  "perplexitybot",
  "google-extended",
];

export async function runModule04(
  ctx: SiteCrawlContext
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const { config, site } = ctx;
  const pages = Array.from(ctx.crawledPages.values());
  const total = pages.length;

  // 04-01: Core Buyer Search Intent Coverage (Manual/AI)
  results.push(
    notMeasured(
      "04-01",
      {
        en: "Buyer search intent coverage requires target-market SERP review (use AI digest for assisted audit).",
        zh: "采购搜索意图覆盖需结合目标市场 SERP 结果与着陆页形态进行人工/AI 复核。",
      },
      "insufficient_data",
      {
        homepageTitle: ctx.homepage?.title ?? "",
        homepageH1: ctx.homepage?.h1s[0] ?? "",
        samplePageTitles: pages.slice(0, 10).map((p) => ({ url: p.url, title: p.title })),
      }
    )
  );

  // 04-02: Homepage & Primary Category Alignment
  const home = ctx.homepage;
  if (!home) {
    results.push(
      notMeasured("04-02", {
        en: "Homepage unavailable.",
        zh: "首页不可达，无法核查定位一致性。",
      })
    );
  } else {
    const hasTitleAndH1 = Boolean(home.title && home.h1s.length > 0);
    const navLinks = home.links.filter((l) => l.isInternal && l.text.length > 1).length;
    results.push(
      makeResult(
        "04-02",
        hasTitleAndH1 && navLinks >= 3 ? "Pass" : "Warn",
        "tool_signal",
        {
          en: `Homepage Title='${home.title.slice(0, 60)}', H1='${(home.h1s[0] ?? "").slice(0, 60)}', internal text links=${navLinks}.`,
          zh: `首页 Title='${home.title.slice(0, 50)}'，H1='${(home.h1s[0] ?? "").slice(0, 50)}'，站内文字链接数=${navLinks}。`,
        },
        { title: home.title, h1: home.h1s[0] ?? "", internalLinkCount: navLinks }
      )
    );
  }

  // 04-03: Compliance / Regulated Vertical Copy
  if (!site.isComplianceVertical || !isProfileEnabled("04-03", config)) {
    results.push(
      notMeasured("04-03", {
        en: "Standard non-regulated vertical (N/A; excluded from denominator).",
        zh: "常规非受监管品类站点（不适用，不计入分母）。",
      })
    );
  } else {
    results.push(
      notMeasured("04-03", {
        en: "Compliance vertical flagged: manual/legal review required for certification claims.",
        zh: "已标记为合规/敏感垂直品类，需人工核查目标市场合规术语与认证真实性。",
      })
    );
  }

  // 04-04: Pillar + Cluster Topical Authority
  const guidePages = pages.filter((p) =>
    /\/(blog|guide|guides|news|resources|articles|faq|knowledge)\b/i.test(p.url)
  );
  results.push(
    makeResult(
      "04-04",
      guidePages.length > 0 ? "Pass" : "Warn",
      "tool_signal",
      {
        en: `Discovered ${guidePages.length} guide/blog/FAQ support page(s) out of ${total} crawled pages.`,
        zh: `在 ${total} 个已抓取页面中发现 ${guidePages.length} 个指南/博客/FAQ 等主题支撑页。`,
      },
      { guidePages: guidePages.map((p) => p.url) }
    )
  );

  // 04-05: Thin Content Detection
  const thinPages = pages.filter(
    (p) => p.wordCount < config.thresholds.thinContentWords
  );
  const thinRatio = total > 0 ? thinPages.length / total : 0;
  const thinStatus =
    thinPages.length === 0 ? "Pass" : thinRatio >= 0.5 ? "Fail" : "Warn";
  results.push(
    makeResult(
      "04-05",
      thinStatus,
      "reproduced",
      {
        en: `${thinPages.length}/${total} pages have fewer than ${config.thresholds.thinContentWords} visible words.`,
        zh: `${thinPages.length}/${total} 个页面可见正文字数少于 ${config.thresholds.thinContentWords} 词。`,
      },
      {
        thinPages: thinPages.map((p) => ({ url: p.url, wordCount: p.wordCount })),
      },
      { affectedUrls: thinPages.map((p) => p.url), denominator: total }
    )
  );

  // 04-06: Structured HTML Spec Tables (B2B)
  if (!isProfileEnabled("04-06", config)) {
    results.push(
      notMeasured("04-06", {
        en: "B2B HTML specification table check disabled (b2b profile not active).",
        zh: "B2B 规格表格化检查未启用（未开启 B2B 扩展包）。",
      })
    );
  } else {
    const pagesWithTables = pages.filter((p) => p.semanticTags.tableCount > 0);
    results.push(
      makeResult(
        "04-06",
        pagesWithTables.length > 0 ? "Pass" : "Warn",
        "tool_signal",
        {
          en: `${pagesWithTables.length}/${total} pages include structured HTML <table> elements (verify product specs are not trapped in images).`,
          zh: `${pagesWithTables.length}/${total} 个页面包含可抓取的 HTML <table> 表格（请结合产品页复核是否将参数做进长图）。`,
        },
        { pagesWithTables: pagesWithTables.map((p) => p.url) }
      )
    );
  }

  // 04-07: Trust Pages Completeness (E-E-A-T)
  if (!isProfileEnabled("04-07", config)) {
    results.push(
      notMeasured("04-07", {
        en: "B2B trust pages check disabled (b2b profile not active).",
        zh: "工厂/资质信任页检查未启用（未开启 B2B 扩展包）。",
      })
    );
  } else {
    const allLinksText = pages
      .flatMap((p) => p.links.filter((l) => l.isInternal))
      .map((l) => `${l.href} ${l.text}`.toLowerCase());
    const hasAbout = allLinksText.some((s) => /\babout\b|company/i.test(s));
    const hasContact = allLinksText.some((s) => /\bcontact\b|inquir/i.test(s));
    const hasFaq = allLinksText.some((s) => /\bfaq\b|questions/i.test(s));
    const hasQuality = allLinksText.some((s) =>
      /factory|production|quality|certif|oem|odm|process/i.test(s)
    );
    const foundCount = [hasAbout, hasContact, hasFaq, hasQuality].filter(Boolean).length;
    results.push(
      makeResult(
        "04-07",
        foundCount >= 3 ? "Pass" : foundCount >= 1 ? "Warn" : "Fail",
        "reproduced",
        {
          en: `Trust page signals found: About=${hasAbout}, Contact=${hasContact}, FAQ=${hasFaq}, Factory/Quality/OEM=${hasQuality}.`,
          zh: `信任页线索：About=${hasAbout}，Contact=${hasContact}，FAQ=${hasFaq}，工厂/质检/定制=${hasQuality}。`,
        },
        { hasAbout, hasContact, hasFaq, hasQuality }
      )
    );
  }

  // 04-08: Inquiry Form & CTA Presence
  if (!isProfileEnabled("04-08", config)) {
    results.push(
      notMeasured("04-08", {
        en: "B2B inquiry form check disabled (b2b profile not active).",
        zh: "询盘表单检查未启用（未开启 B2B 扩展包）。",
      })
    );
  } else {
    const hasForm = pages.some((p) => p.formStats.formCount > 0);
    const hasCta = pages.some((p) => p.hasInquiryCta);
    const hasEmail = pages.some((p) => p.emails.length > 0);
    results.push(
      makeResult(
        "04-08",
        hasForm && hasCta ? "Pass" : hasCta ? "Warn" : "Fail",
        "tool_signal",
        {
          en: `HTML form=${hasForm}, inquiry CTA=${hasCta}, visible email=${hasEmail} (verify mobile submission flow manually).`,
          zh: `表单存在=${hasForm}，询盘 CTA=${hasCta}，公开邮箱=${hasEmail}（手机端提交闭环需真机/浏览器复核）。`,
        },
        { hasForm, hasCta, hasEmail }
      )
    );
  }

  // 04-09: AI Crawler Access Policy
  const robots = ctx.robots;
  if (!robots || robots.statusCode !== 200) {
    results.push(
      notMeasured("04-09", {
        en: "Cannot evaluate AI crawler rules because robots.txt was not available.",
        zh: "未获取到有效 robots.txt，无法评估 AI 爬虫策略。",
      })
    );
  } else {
    const blockedAiBots = AI_BOTS.filter((bot) => {
      const r = robots.rulesByAgent[bot];
      return r ? r.disallow.includes("/") : false;
    });
    results.push(
      makeResult(
        "04-09",
        blockedAiBots.length === 0 ? "Pass" : "Warn",
        "reproduced",
        {
          en:
            blockedAiBots.length === 0
              ? "No major AI search crawlers are explicitly blocked in robots.txt."
              : `robots.txt explicitly blocks AI crawler(s): ${blockedAiBots.join(", ")}; confirm alignment with GEO strategy.`,
          zh:
            blockedAiBots.length === 0
              ? "robots.txt 未屏蔽主流 AI 检索爬虫。"
              : `robots.txt 明确屏蔽了 AI 爬虫：${blockedAiBots.join(", ")}，请确认是否符合企业 GEO 策略。`,
        },
        { blockedAiBots }
      )
    );
  }

  // 04-10: Passage Citability & Q&A Blocks
  const qHeadings = pages.flatMap((p) => p.questionHeadings);
  const tablesTotal = pages.reduce((s, p) => s + p.semanticTags.tableCount, 0);
  results.push(
    makeResult(
      "04-10",
      qHeadings.length > 0 || tablesTotal > 0 ? "Pass" : "Warn",
      "tool_signal",
      {
        en: `Found ${qHeadings.length} question-style H2/H3 heading(s) and ${tablesTotal} HTML table(s) for AI citation readiness.`,
        zh: `检测到 ${qHeadings.length} 个问句式 H2/H3 标题及 ${tablesTotal} 个结构化表格（可引用直答质量建议人工/AI 复核）。`,
      },
      { questionHeadingsSample: qHeadings.slice(0, 10), tablesTotal }
    )
  );

  // 04-11: Brand & Organization Entity Consistency
  const orgNames = Array.from(new Set(pages.flatMap((p) => p.organizationNames)));
  const emails = Array.from(new Set(pages.flatMap((p) => p.emails)));
  const expectedBrand = site.expectedBrand?.trim();
  const brandFound = expectedBrand
    ? pages.some((p) =>
        p.visibleText.toLowerCase().includes(expectedBrand.toLowerCase())
      )
    : true;
  results.push(
    makeResult(
      "04-11",
      brandFound && orgNames.length <= 1 ? "Pass" : "Warn",
      "tool_signal",
      {
        en: `Schema Organization names: [${orgNames.join(", ") || "none"}]; public emails: [${emails.slice(0, 5).join(", ") || "none"}].`,
        zh: `Schema 公司实体名：[${orgNames.join(", ") || "未声明"}]；公开邮箱：[${emails.slice(0, 5).join(", ") || "无"}]。`,
      },
      { orgNames, emails: emails.slice(0, 10), expectedBrand, brandFound }
    )
  );

  // 04-12: llms.txt & Semantic HTML
  const llmsUrl = new URL("/llms.txt", ctx.canonicalOrigin).toString();
  const llmsRes = await fetchWithTrace(llmsUrl, {
    timeoutMs: config.timeoutMs,
    userAgent: config.userAgent,
    rejectUnauthorized: false,
    maxBodyBytes: 8192,
  });
  const hasLlmsTxt = !llmsRes.error && llmsRes.statusCode === 200 && llmsRes.body.trim().length > 10;
  const hasSemanticMain = pages.some((p) => p.semanticTags.hasMain || p.semanticTags.hasArticle);
  results.push(
    makeResult(
      "04-12",
      hasSemanticMain ? "Pass" : "Warn",
      "reproduced",
      {
        en: `/llms.txt present=${hasLlmsTxt}; semantic <main>/<article> landmarks=${hasSemanticMain}.`,
        zh: `根目录 /llms.txt=${hasLlmsTxt}；语义化 <main>/<article> 结构=${hasSemanticMain}。`,
      },
      { hasLlmsTxt, hasSemanticMain }
    )
  );

  // 04-13: AI Search Visibility Baseline (Manual)
  results.push(
    notMeasured("04-13", {
      en: "AI search visibility across AI Overviews, ChatGPT, and Perplexity requires periodic external query testing.",
      zh: "AI 搜索可见度基线需在 Google AI Overviews / ChatGPT / Perplexity 定期抽测 10–20 个高意图问句。",
    })
  );

  // 04-14: Analytics & Conversion Tracking (GA4 / GTM)
  const ga4Ids = Array.from(new Set(pages.flatMap((p) => p.tracking.ga4Ids)));
  const gtmIds = Array.from(new Set(pages.flatMap((p) => p.tracking.gtmIds)));
  const legacyUaIds = Array.from(new Set(pages.flatMap((p) => p.tracking.legacyUaIds)));
  if (ga4Ids.length === 0 && gtmIds.length === 0) {
    results.push(
      makeResult(
        "04-14",
        "Fail",
        "reproduced",
        {
          en: "No GA4 or GTM analytics tags detected in crawled HTML.",
          zh: "页面中未检测到任何 GA4 或 GTM 流量统计代码。",
        },
        { ga4Ids, gtmIds, legacyUaIds }
      )
    );
  } else if (ga4Ids.length > 2 || gtmIds.length > 2 || legacyUaIds.length > 0) {
    results.push(
      makeResult(
        "04-14",
        "Warn",
        "reproduced",
        {
          en: `Multiple/legacy tracking tags found (GA4=${ga4Ids.join(",") || "none"}, GTM=${gtmIds.join(",") || "none"}, legacy UA=${legacyUaIds.join(",") || "none"}).`,
          zh: `存在多套或旧版追踪代码（GA4=${ga4Ids.join(",") || "无"}，GTM=${gtmIds.join(",") || "无"}，旧 UA=${legacyUaIds.join(",") || "无"}）。`,
        },
        { ga4Ids, gtmIds, legacyUaIds }
      )
    );
  } else {
    results.push(
      makeResult(
        "04-14",
        "Pass",
        "reproduced",
        {
          en: `Analytics detected cleanly (GA4=${ga4Ids.join(",") || "via GTM"}, GTM=${gtmIds.join(",") || "none"}); verify conversion events in GA4 admin.`,
          zh: `已规范部署统计代码（GA4=${ga4Ids.join(",") || "经 GTM"}，GTM=${gtmIds.join(",") || "无"}）；后台询盘转化事件需权限核验。`,
        },
        { ga4Ids, gtmIds }
      )
    );
  }

  return results;
}
