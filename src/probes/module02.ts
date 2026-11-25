import type { CheckResult } from "../types.js";
import { fetchWithTrace, normalizeUrl } from "../utils/http.js";
import { isGenericAnchor } from "../utils/html.js";
import {
  isProfileEnabled,
  makeResult,
  notMeasured,
  type SiteCrawlContext,
} from "./context.js";

const ISO_LANG_RE = /^(x-default|[a-z]{2}(-[A-Za-z0-9]{2,4})?)$/;

export async function runModule02(
  ctx: SiteCrawlContext
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const { config, site } = ctx;
  const pages = Array.from(ctx.crawledPages.values());

  // 02-01: robots.txt
  const robots = ctx.robots;
  if (!robots || robots.statusCode >= 500 || robots.statusCode === 0) {
    results.push(
      makeResult("02-01", "Fail", "reproduced", {
        en: `robots.txt failed with HTTP ${robots?.statusCode ?? 0} (5xx causes search engines to pause crawling).`,
        zh: `robots.txt 返回异常状态码 ${robots?.statusCode ?? 0}（5xx 会导致搜索引擎暂停抓取）。`,
      })
    );
  } else if (robots.disallowsAll) {
    results.push(
      makeResult(
        "02-01",
        "Fail",
        "reproduced",
        {
          en: "robots.txt contains 'Disallow: /' for User-agent: *, blocking entire site crawl.",
          zh: "robots.txt 对 User-agent: * 设置了 Disallow: /，阻断整站抓取。",
        },
        { robotsUrl: robots.url, statusCode: robots.statusCode }
      )
    );
  } else if (robots.statusCode !== 200 || robots.sitemaps.length === 0) {
    results.push(
      makeResult(
        "02-01",
        "Warn",
        "reproduced",
        {
          en: `robots.txt HTTP ${robots.statusCode}; declared Sitemaps: ${robots.sitemaps.length}.`,
          zh: `robots.txt 状态码 ${robots.statusCode}；声明的 Sitemap 数量：${robots.sitemaps.length}。`,
        },
        { robotsUrl: robots.url, statusCode: robots.statusCode, sitemaps: robots.sitemaps }
      )
    );
  } else {
    results.push(
      makeResult(
        "02-01",
        "Pass",
        "reproduced",
        {
          en: `robots.txt returned 200, allows crawling, and declares ${robots.sitemaps.length} Sitemap(s).`,
          zh: `robots.txt 返回 200，未误拦整站，并声明了 ${robots.sitemaps.length} 个 Sitemap。`,
        },
        { robotsUrl: robots.url, sitemaps: robots.sitemaps }
      )
    );
  }

  // 02-02: XML Sitemap Purity & Coverage
  if (ctx.sitemapUrls.length === 0) {
    results.push(
      makeResult(
        "02-02",
        "Fail",
        "reproduced",
        {
          en: `No valid XML Sitemap URLs discovered (errors: ${ctx.sitemapErrors.join("; ") || "not found"}).`,
          zh: `未发现有效 XML Sitemap 网址（错误：${ctx.sitemapErrors.join("; ") || "未找到"}）。`,
        },
        { sitemapErrors: ctx.sitemapErrors }
      )
    );
  } else {
    const sample = ctx.sitemapUrls.slice(0, 10);
    const badSample: Array<{ url: string; status: number }> = [];
    for (const u of sample) {
      const existing = ctx.crawledPages.get(u);
      if (existing) {
        if (existing.statusCode !== 200 || existing.metaRobots.some((m) => m.includes("noindex"))) {
          badSample.push({ url: u, status: existing.statusCode });
        }
      } else {
        const res = await fetchWithTrace(u, {
          method: "HEAD",
          timeoutMs: config.timeoutMs,
          userAgent: config.userAgent,
          rejectUnauthorized: false,
          maxRedirects: 0,
        });
        if (res.statusCode !== 200) {
          badSample.push({ url: u, status: res.statusCode });
        }
      }
    }
    if (badSample.length > 0) {
      results.push(
        makeResult(
          "02-02",
          "Fail",
          "reproduced",
          {
            en: `${badSample.length}/${sample.length} sampled Sitemap URLs returned non-200 or noindex (total listed: ${ctx.sitemapUrls.length}).`,
            zh: `抽检 ${sample.length} 条 Sitemap 链接中有 ${badSample.length} 条非 200 或带 noindex（总计 ${ctx.sitemapUrls.length} 条）。`,
          },
          { totalUrls: ctx.sitemapUrls.length, badSample },
          { affectedUrls: badSample.map((b) => b.url), denominator: sample.length }
        )
      );
    } else {
      results.push(
        makeResult(
          "02-02",
          "Pass",
          "reproduced",
          {
            en: `XML Sitemap valid with ${ctx.sitemapUrls.length} URL(s); all ${sample.length} sampled URLs returned HTTP 200.`,
            zh: `XML Sitemap 有效，共含 ${ctx.sitemapUrls.length} 条链接；抽检 ${sample.length} 条全部返回 200。`,
          },
          { totalUrls: ctx.sitemapUrls.length, sampled: sample.length },
          { denominator: sample.length }
        )
      );
    }
  }

  // 02-03: IndexNow (Optional)
  results.push(
    notMeasured("02-03", {
      en: "IndexNow key verification is optional and requires CMS-configured key filename.",
      zh: "IndexNow 属于可选辅助协议，需结合 CMS 配置的密钥文件名核验。",
    })
  );

  // 02-04: Meta Robots & X-Robots-Tag
  const noindexPages = pages.filter((p) =>
    p.metaRobots.some((m) => /\b(noindex|none)\b/i.test(m))
  );
  const homeNoindex =
    ctx.homepage?.metaRobots.some((m) => /\b(noindex|none)\b/i.test(m)) ?? false;
  if (homeNoindex) {
    results.push(
      makeResult(
        "02-04",
        "Fail",
        "reproduced",
        {
          en: "Homepage contains a noindex/none directive via Meta Robots or X-Robots-Tag.",
          zh: "首页包含 noindex / none 禁收录指令，严重阻断搜索收录。",
        },
        { homepageMetaRobots: ctx.homepage?.metaRobots },
        { affectedUrls: [ctx.canonicalOrigin] }
      )
    );
  } else if (noindexPages.length > 0) {
    results.push(
      makeResult(
        "02-04",
        "Warn",
        "reproduced",
        {
          en: `${noindexPages.length}/${pages.length} crawled pages carry noindex; verify whether intentional.`,
          zh: `抓取的 ${pages.length} 个页面中有 ${noindexPages.length} 个带 noindex，请核实是否为预期排除页。`,
        },
        { noindexPages: noindexPages.map((p) => ({ url: p.url, directives: p.metaRobots })) },
        { affectedUrls: noindexPages.map((p) => p.url), denominator: pages.length }
      )
    );
  } else {
    results.push(
      makeResult(
        "02-04",
        "Pass",
        "reproduced",
        {
          en: `All ${pages.length} crawled pages are indexable (no accidental noindex/none found).`,
          zh: `全部 ${pages.length} 个已抓取页面均未发现误配的 noindex / none 指令。`,
        },
        { checked: pages.length },
        { denominator: pages.length }
      )
    );
  }

  // 02-05: Canonical Completeness & Validity
  const missingCanonical = pages.filter((p) => p.canonicalTags.length === 0);
  const multipleCanonical = pages.filter((p) => p.canonicalTags.length > 1);
  const relativeCanonical = pages.filter((p) =>
    p.canonicalTags.some((c) => !/^https?:\/\//i.test(c))
  );
  if (multipleCanonical.length > 0 || relativeCanonical.length > 0) {
    results.push(
      makeResult(
        "02-05",
        "Fail",
        "reproduced",
        {
          en: `Canonical errors: multiple=${multipleCanonical.length}, relative=${relativeCanonical.length}, missing=${missingCanonical.length} (out of ${pages.length}).`,
          zh: `Canonical 异常：重复声明=${multipleCanonical.length}，相对路径=${relativeCanonical.length}，缺失=${missingCanonical.length}（共 ${pages.length} 页）。`,
        },
        {
          multipleCanonical: multipleCanonical.map((p) => p.url),
          relativeCanonical: relativeCanonical.map((p) => p.url),
          missingCanonical: missingCanonical.map((p) => p.url),
        },
        { denominator: pages.length }
      )
    );
  } else if (missingCanonical.length > 0) {
    results.push(
      makeResult(
        "02-05",
        "Warn",
        "reproduced",
        {
          en: `${missingCanonical.length}/${pages.length} pages are missing a rel='canonical' tag.`,
          zh: `${missingCanonical.length}/${pages.length} 个页面缺少 rel='canonical' 标签。`,
        },
        { missingCanonical: missingCanonical.map((p) => p.url) },
        { affectedUrls: missingCanonical.map((p) => p.url), denominator: pages.length }
      )
    );
  } else {
    results.push(
      makeResult(
        "02-05",
        "Pass",
        "reproduced",
        {
          en: `All ${pages.length} crawled pages declare a single absolute rel='canonical' URL.`,
          zh: `全部 ${pages.length} 个已抓取页面均包含唯一、绝对路径的 Canonical 标签。`,
        },
        { checked: pages.length },
        { denominator: pages.length }
      )
    );
  }

  // 02-06: Faceted Filter & Sort URLs
  const facetRe = /[?&](sort|order|filter|price|color|size|capacity|material)=/i;
  const facetUrls = pages.filter((p) => facetRe.test(p.url));
  const uncontrolledFacets = facetUrls.filter(
    (p) =>
      !p.metaRobots.some((m) => m.includes("noindex")) &&
      p.canonicalTags.every((c) => c === p.url)
  );
  if (facetUrls.length === 0) {
    results.push(
      makeResult("02-06", "Pass", "tool_signal", {
        en: "No uncontrolled sort/filter parameter URLs encountered during crawl.",
        zh: "抓取过程中未发现失控的排序/筛选参数 URL。",
      })
    );
  } else {
    results.push(
      makeResult(
        "02-06",
        uncontrolledFacets.length > 0 ? "Warn" : "Pass",
        "reproduced",
        {
          en: `Discovered ${facetUrls.length} filter/sort URL(s); ${uncontrolledFacets.length} lack noindex or canonical consolidation.`,
          zh: `发现 ${facetUrls.length} 个筛选/排序参数页，其中 ${uncontrolledFacets.length} 个缺少 noindex 或 Canonical 归并。`,
        },
        { uncontrolledFacets: uncontrolledFacets.map((p) => p.url) },
        { affectedUrls: uncontrolledFacets.map((p) => p.url) }
      )
    );
  }

  // 02-07: Pagination Crawlability & Canonical
  const paginatedPages = pages.filter((p) => /[?&]page=\d+|\/page\/\d+/i.test(p.url));
  const badPaginated = paginatedPages.filter((p) => {
    const firstCanon = p.canonicalTags[0];
    return firstCanon && !/[?&]page=\d+|\/page\/\d+/i.test(firstCanon);
  });
  if (paginatedPages.length === 0) {
    results.push(
      notMeasured("02-07", {
        en: "No paginated URLs discovered within crawl sample.",
        zh: "本次抓取样本中未遇到分页 URL（如需验证请增大抓取深度或手工核查分类翻页）。",
      })
    );
  } else {
    results.push(
      makeResult(
        "02-07",
        badPaginated.length > 0 ? "Fail" : "Pass",
        "reproduced",
        {
          en:
            badPaginated.length > 0
              ? `${badPaginated.length}/${paginatedPages.length} paginated pages canonicalize back to page 1.`
              : `All ${paginatedPages.length} discovered paginated pages use crawlable links with self-referencing canonicals.`,
          zh:
            badPaginated.length > 0
              ? `${badPaginated.length}/${paginatedPages.length} 个分页错误地将 Canonical 指向第 1 页。`
              : `发现的 ${paginatedPages.length} 个分页链接均可抓取且自引用 Canonical。`,
        },
        { badPaginated: badPaginated.map((p) => p.url) },
        { affectedUrls: badPaginated.map((p) => p.url), denominator: paginatedPages.length }
      )
    );
  }

  // 02-08: Variant Duplication
  if (!isProfileEnabled("02-08", config)) {
    results.push(
      notMeasured("02-08", {
        en: "Product variant duplication check disabled (b2b profile not active).",
        zh: "规格变体重复度检查未启用（未开启 B2B 扩展包）。",
      })
    );
  } else {
    const dupTitles = new Map<string, string[]>();
    for (const p of pages) {
      if (!p.title) continue;
      const key = p.title.toLowerCase();
      const list = dupTitles.get(key) ?? [];
      list.push(p.url);
      dupTitles.set(key, list);
    }
    const groups = Array.from(dupTitles.values()).filter((g) => g.length > 1);
    results.push(
      makeResult(
        "02-08",
        groups.length > 0 ? "Warn" : "Pass",
        "tool_signal",
        {
          en:
            groups.length > 0
              ? `Found ${groups.length} duplicate-title page group(s) that may indicate duplicate product variants.`
              : "No duplicate-title variant clusters detected in crawled pages.",
          zh:
            groups.length > 0
              ? `发现 ${groups.length} 组标题完全相同的页面，可能存在规格变体重复风险。`
              : "已抓取页面中未发现明显的同标题重复变体集群。",
        },
        { duplicateGroups: groups.slice(0, 10) }
      )
    );
  }

  // 02-09: Multilingual & hreflang
  const pagesWithHreflang = pages.filter((p) => p.hreflangLinks.length > 0);
  if (!site.isMultilingual && pagesWithHreflang.length === 0) {
    results.push(
      notMeasured("02-09", {
        en: "Monolingual site (no hreflang tags detected; N/A).",
        zh: "单语站点（未检测到 hreflang，不适用，不计入分母）。",
      })
    );
  } else {
    const invalidCodes: string[] = [];
    for (const p of pagesWithHreflang) {
      for (const h of p.hreflangLinks) {
        if (!ISO_LANG_RE.test(h.hreflang)) {
          invalidCodes.push(`${p.url} -> ${h.hreflang}`);
        }
      }
    }
    results.push(
      makeResult(
        "02-09",
        invalidCodes.length > 0 ? "Fail" : "Pass",
        "reproduced",
        {
          en:
            invalidCodes.length > 0
              ? `Found ${invalidCodes.length} invalid hreflang ISO code(s).`
              : `Validated hreflang tags across ${pagesWithHreflang.length} page(s) with valid ISO codes.`,
          zh:
            invalidCodes.length > 0
              ? `发现 ${invalidCodes.length} 处不合规范的 hreflang 语言代码。`
              : `已校验 ${pagesWithHreflang.length} 个页面的 hreflang 标签，ISO 语言代码规范。`,
        },
        { invalidCodes: invalidCodes.slice(0, 20) }
      )
    );
  }

  // 02-10: URL Readability & Consistency
  const badUrls = pages.filter((p) => {
    const u = new URL(p.url);
    return (
      /[A-Z]/.test(u.pathname) ||
      u.pathname.includes("_") ||
      u.pathname.includes("%20") ||
      u.pathname.split("/").filter(Boolean).length > 5
    );
  });
  results.push(
    makeResult(
      "02-10",
      badUrls.length === 0 ? "Pass" : "Warn",
      "reproduced",
      {
        en: `${badUrls.length}/${pages.length} URLs contain uppercase, underscores, spaces, or >5 path segments.`,
        zh: `${badUrls.length}/${pages.length} 个 URL 存在大写字母、下划线、空格或超过 5 层目录。`,
      },
      { badUrls: badUrls.map((p) => p.url) },
      { affectedUrls: badUrls.map((p) => p.url), denominator: pages.length }
    )
  );

  // 02-11: Navigation Hierarchy & Click Depth
  const depths = Array.from(ctx.clickDepth.values());
  const maxDepthFound = depths.length > 0 ? Math.max(...depths) : 0;
  const deepPages = Array.from(ctx.clickDepth.entries())
    .filter(([, d]) => d > config.thresholds.maxClickDepthPass)
    .map(([u]) => u);
  const depthStatus =
    maxDepthFound <= config.thresholds.maxClickDepthPass
      ? "Pass"
      : maxDepthFound <= config.thresholds.maxClickDepthWarn
        ? "Warn"
        : "Fail";
  results.push(
    makeResult(
      "02-11",
      depthStatus,
      "reproduced",
      {
        en: `Max click depth=${maxDepthFound}; ${deepPages.length}/${pages.length} pages exceed ${config.thresholds.maxClickDepthPass} clicks.`,
        zh: `最大点击深度=${maxDepthFound} 跳；${deepPages.length}/${pages.length} 个页面超过 ${config.thresholds.maxClickDepthPass} 跳。`,
      },
      { maxDepthFound, deepPages: deepPages.slice(0, 20) },
      { affectedUrls: deepPages.slice(0, 20), denominator: pages.length }
    )
  );

  // 02-12: Orphan Pages (Crawl vs Sitemap vs Known URLs)
  const crawledSet = new Set(ctx.crawledPages.keys());
  const expectedSet = new Set<string>([
    ...ctx.sitemapUrls,
    ...(site.knownUrls ?? []).map((u) => normalizeUrl(u, ctx.canonicalOrigin) ?? u),
  ]);
  if (expectedSet.size === 0) {
    results.push(
      notMeasured("02-12", {
        en: "Orphan page cross-check requires an XML Sitemap or configured knownUrls list.",
        zh: "孤立页三表比对需要有效的 XML Sitemap 或配置的业务 URL 清单。",
      })
    );
  } else {
    const orphans = Array.from(expectedSet).filter((u) => !crawledSet.has(u));
    const hitCap = ctx.crawledPages.size >= config.maxPages;
    const status = orphans.length === 0 ? "Pass" : hitCap ? "Warn" : "Fail";
    results.push(
      makeResult(
        "02-12",
        status,
        hitCap ? "tool_signal" : "reproduced",
        {
          en: `Found ${orphans.length}/${expectedSet.size} URL(s) in Sitemap/knownUrls with no internal link found during crawl${hitCap ? " (crawl hit maxPages cap; verify)" : ""}.`,
          zh: `在 Sitemap/已知清单的 ${expectedSet.size} 条 URL 中发现 ${orphans.length} 条未通过内链抓取到的疑似孤立页${hitCap ? "（已达抓取上限，需复核）" : ""}。`,
        },
        { orphanSample: orphans.slice(0, 30), hitCrawlCap: hitCap },
        { affectedUrls: orphans.slice(0, 30), denominator: expectedSet.size }
      )
    );
  }

  // 02-13: Internal Broken Links & Redirect Chains
  const broken = ctx.brokenInternalLinks;
  const redirs = ctx.redirectInternalLinks;
  if (broken.length > 0) {
    results.push(
      makeResult(
        "02-13",
        "Fail",
        "reproduced",
        {
          en: `Found ${broken.length} broken internal link(s) (4xx/5xx) and ${redirs.length} redirected internal link(s).`,
          zh: `发现 ${broken.length} 条站内断链（4xx/5xx）及 ${redirs.length} 条重定向内链。`,
        },
        { broken: broken.slice(0, 30), redirected: redirs.slice(0, 20) },
        { affectedUrls: broken.map((b) => `${b.source} -> ${b.target} (${b.statusCode})`) }
      )
    );
  } else if (redirs.length > 0) {
    results.push(
      makeResult(
        "02-13",
        "Warn",
        "reproduced",
        {
          en: `Zero broken internal links, but ${redirs.length} internal link(s) point to redirects.`,
          zh: `无站内死链，但有 ${redirs.length} 条内链指向重定向地址。`,
        },
        { redirected: redirs.slice(0, 20) }
      )
    );
  } else {
    results.push(
      makeResult("02-13", "Pass", "reproduced", {
        en: "Zero broken or redirected internal links found across crawled pages.",
        zh: "已抓取页面中未发现站内断链或多跳重定向内链。",
      })
    );
  }

  // 02-14: Breadcrumbs & Anchor Quality
  const withBreadcrumbs = pages.filter((p) => p.hasBreadcrumbs).length;
  const allInternalLinks = pages.flatMap((p) => p.links.filter((l) => l.isInternal));
  const genericCount = allInternalLinks.filter((l) => isGenericAnchor(l.text)).length;
  const genericRatio =
    allInternalLinks.length > 0 ? genericCount / allInternalLinks.length : 0;
  results.push(
    makeResult(
      "02-14",
      withBreadcrumbs > 0 && genericRatio <= 0.1 ? "Pass" : "Warn",
      "reproduced",
      {
        en: `Pages with breadcrumbs: ${withBreadcrumbs}/${pages.length}; generic anchors: ${genericCount}/${allInternalLinks.length}.`,
        zh: `含面包屑页面：${withBreadcrumbs}/${pages.length}；泛泛锚文本链接：${genericCount}/${allInternalLinks.length}。`,
      },
      { withBreadcrumbs, totalPages: pages.length, genericCount, totalInternalLinks: allInternalLinks.length }
    )
  );

  return results;
}
