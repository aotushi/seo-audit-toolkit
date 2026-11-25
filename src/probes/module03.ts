import type { CheckResult } from "../types.js";
import { fetchWithTrace } from "../utils/http.js";
import {
  isProfileEnabled,
  makeResult,
  notMeasured,
  type SiteCrawlContext,
} from "./context.js";

const DEPRECATED_SCHEMA_TYPES = new Set(["HowTo", "SpecialAnnouncement"]);

export async function runModule03(
  ctx: SiteCrawlContext
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const { config } = ctx;
  const pages = Array.from(ctx.crawledPages.values());
  const total = pages.length;

  // 03-01: Title Uniqueness & Length
  const missingTitle = pages.filter((p) => !p.title || /^(home|untitled|index)$/i.test(p.title));
  const titleMap = new Map<string, string[]>();
  for (const p of pages) {
    if (!p.title) continue;
    const k = p.title.toLowerCase();
    titleMap.set(k, [...(titleMap.get(k) ?? []), p.url]);
  }
  const dupTitles = Array.from(titleMap.values()).filter((arr) => arr.length > 1);
  const lengthWarn = pages.filter(
    (p) =>
      p.title.length > 0 &&
      (p.title.length < config.thresholds.titleMinLen ||
        p.title.length > config.thresholds.titleWarnMaxLen)
  );
  if (missingTitle.length > 0 || dupTitles.length > 0) {
    results.push(
      makeResult(
        "03-01",
        "Fail",
        "reproduced",
        {
          en: `Title issues: missing/default=${missingTitle.length}, duplicate groups=${dupTitles.length}, length out-of-range=${lengthWarn.length} (of ${total} pages).`,
          zh: `Title 异常：缺失/默认=${missingTitle.length}，重复组数=${dupTitles.length}，长度偏离=${lengthWarn.length}（共 ${total} 页）。`,
        },
        {
          missingTitle: missingTitle.map((p) => p.url),
          duplicateGroups: dupTitles.slice(0, 10),
          lengthWarn: lengthWarn.map((p) => ({ url: p.url, len: p.title.length })),
        },
        { denominator: total }
      )
    );
  } else if (lengthWarn.length > 0) {
    results.push(
      makeResult(
        "03-01",
        "Warn",
        "reproduced",
        {
          en: `All ${total} titles are unique, but ${lengthWarn.length} fall outside ${config.thresholds.titleMinLen}-${config.thresholds.titleWarnMaxLen} chars.`,
          zh: `全部 ${total} 页 Title 均唯一，但有 ${lengthWarn.length} 页长度超出 ${config.thresholds.titleMinLen}–${config.thresholds.titleWarnMaxLen} 字符。`,
        },
        { lengthWarn: lengthWarn.map((p) => ({ url: p.url, len: p.title.length })) },
        { affectedUrls: lengthWarn.map((p) => p.url), denominator: total }
      )
    );
  } else {
    results.push(
      makeResult(
        "03-01",
        "Pass",
        "reproduced",
        {
          en: `All ${total} pages have unique, well-sized Title tags.`,
          zh: `全部 ${total} 个页面 Title 唯一且长度规范。`,
        },
        { checked: total },
        { denominator: total }
      )
    );
  }

  // 03-02: Meta Description
  const missingDesc = pages.filter((p) => !p.metaDescription);
  const descMap = new Map<string, string[]>();
  for (const p of pages) {
    if (!p.metaDescription) continue;
    const k = p.metaDescription.toLowerCase();
    descMap.set(k, [...(descMap.get(k) ?? []), p.url]);
  }
  const dupDescs = Array.from(descMap.values()).filter((arr) => arr.length > 1);
  if (dupDescs.length > 0 && dupDescs.flat().length >= Math.max(2, Math.ceil(total * 0.5))) {
    results.push(
      makeResult(
        "03-02",
        "Fail",
        "reproduced",
        {
          en: `Widespread duplicate Meta Descriptions detected (${dupDescs.length} duplicate group(s)).`,
          zh: `存在大面积重复 Meta Description（${dupDescs.length} 组重复）。`,
        },
        { duplicateGroups: dupDescs.slice(0, 10) },
        { denominator: total }
      )
    );
  } else if (missingDesc.length > 0 || dupDescs.length > 0) {
    results.push(
      makeResult(
        "03-02",
        "Warn",
        "reproduced",
        {
          en: `Meta Description: missing=${missingDesc.length}/${total}, duplicate groups=${dupDescs.length}.`,
          zh: `Meta Description 缺失=${missingDesc.length}/${total}，重复组数=${dupDescs.length}。`,
        },
        { missingDesc: missingDesc.map((p) => p.url), duplicateGroups: dupDescs.slice(0, 10) },
        { denominator: total }
      )
    );
  } else {
    results.push(
      makeResult(
        "03-02",
        "Pass",
        "reproduced",
        {
          en: `All ${total} pages have unique Meta Descriptions.`,
          zh: `全部 ${total} 个页面均具备唯一 Meta Description。`,
        },
        { checked: total },
        { denominator: total }
      )
    );
  }

  // 03-03: Heading Hierarchy (H1-H3)
  const badH1 = pages.filter((p) => p.h1s.length !== 1 || p.logoInH1);
  const skippedHeadings = pages.filter((p) => p.headingSkipDetected);
  if (badH1.length > 0) {
    results.push(
      makeResult(
        "03-03",
        "Fail",
        "reproduced",
        {
          en: `${badH1.length}/${total} pages have missing H1, multiple H1s, or Logo inside H1.`,
          zh: `${badH1.length}/${total} 个页面缺失 H1、存在多个 H1 或由 Logo 占用 H1。`,
        },
        {
          badH1: badH1.map((p) => ({ url: p.url, h1Count: p.h1s.length, logoInH1: p.logoInH1 })),
        },
        { affectedUrls: badH1.map((p) => p.url), denominator: total }
      )
    );
  } else if (skippedHeadings.length > 0) {
    results.push(
      makeResult(
        "03-03",
        "Warn",
        "reproduced",
        {
          en: `All pages have 1 valid H1, but ${skippedHeadings.length}/${total} pages skip heading levels.`,
          zh: `所有页面均有唯一 H1，但有 ${skippedHeadings.length}/${total} 个页面存在标题跳级。`,
        },
        { skippedHeadings: skippedHeadings.map((p) => p.url) },
        { denominator: total }
      )
    );
  } else {
    results.push(
      makeResult(
        "03-03",
        "Pass",
        "reproduced",
        {
          en: `All ${total} pages have strictly 1 valid H1 and logical heading nesting.`,
          zh: `全部 ${total} 页均严格具备 1 个有效 H1 且标题层级规范。`,
        },
        { checked: total },
        { denominator: total }
      )
    );
  }

  // 03-04: Mobile vs Desktop Parity
  results.push(
    notMeasured("03-04", {
      en: "Mobile vs Desktop rendered DOM parity requires headless browser dual-viewport comparison.",
      zh: "移动与桌面端主内容等价性需通过无头浏览器双视口渲染对照核实。",
    })
  );

  // 03-05: Viewport Meta
  const missingViewport = pages.filter(
    (p) => !p.viewport || !p.viewport.toLowerCase().includes("width=device-width")
  );
  results.push(
    makeResult(
      "03-05",
      missingViewport.length === 0 ? "Pass" : "Fail",
      "reproduced",
      {
        en:
          missingViewport.length === 0
            ? `All ${total} pages declare a responsive viewport meta tag.`
            : `${missingViewport.length}/${total} pages are missing a valid responsive viewport meta tag.`,
        zh:
          missingViewport.length === 0
            ? `全部 ${total} 页均声明了标准响应式 viewport 标签。`
            : `${missingViewport.length}/${total} 个页面缺少有效的响应式 viewport 声明。`,
      },
      { missingViewport: missingViewport.map((p) => p.url) },
      { affectedUrls: missingViewport.map((p) => p.url), denominator: total }
    )
  );

  // 03-06, 03-07, 03-08: Images
  const allImgs = pages.flatMap((p) =>
    p.images.map((img, idx) => ({ pageUrl: p.url, idx, ...img }))
  );
  const uniqueImgUrls = Array.from(
    new Set(allImgs.map((i) => i.resolvedUrl).filter((u): u is string => Boolean(u)))
  ).slice(0, 15);

  const oversizedImgs: Array<{ url: string; kb: number }> = [];
  const brokenImgs: Array<{ url: string; status: number }> = [];
  let modernFormatCount = 0;

  for (const imgUrl of uniqueImgUrls) {
    const res = await fetchWithTrace(imgUrl, {
      method: "HEAD",
      timeoutMs: config.timeoutMs,
      userAgent: config.userAgent,
      rejectUnauthorized: false,
      maxRedirects: 3,
    });
    if (res.error || res.statusCode >= 400) {
      brokenImgs.push({ url: imgUrl, status: res.statusCode });
    } else {
      const len = Number(res.headers["content-length"] ?? "0");
      const ct = (res.headers["content-type"] ?? "").toLowerCase();
      if (ct.includes("webp") || ct.includes("avif") || /\.(webp|avif)(\?|$)/i.test(imgUrl)) {
        modernFormatCount++;
      }
      if (len > 0) {
        const kb = Math.round(len / 1024);
        if (kb > config.thresholds.imagePassKb) {
          oversizedImgs.push({ url: imgUrl, kb });
        }
      }
    }
  }

  // 03-06: Image Size & Modern Format
  if (uniqueImgUrls.length === 0) {
    results.push(
      notMeasured("03-06", {
        en: "No <img> elements found to measure file size or format.",
        zh: "未发现可检测体积与格式的 <img> 元素。",
      })
    );
  } else {
    const severeOversize = oversizedImgs.filter(
      (i) => i.kb > config.thresholds.imageWarnKb
    );
    const status =
      severeOversize.length > 0
        ? "Fail"
        : oversizedImgs.length > 0 || modernFormatCount === 0
          ? "Warn"
          : "Pass";
    results.push(
      makeResult(
        "03-06",
        status,
        "reproduced",
        {
          en: `Sampled ${uniqueImgUrls.length} image(s): oversized(>${config.thresholds.imagePassKb}KB)=${oversizedImgs.length}, severe(>${config.thresholds.imageWarnKb}KB)=${severeOversize.length}, WebP/AVIF=${modernFormatCount}.`,
          zh: `抽检 ${uniqueImgUrls.length} 张图片：超 ${config.thresholds.imagePassKb}KB=${oversizedImgs.length}，超 ${config.thresholds.imageWarnKb}KB=${severeOversize.length}，WebP/AVIF=${modernFormatCount}。`,
        },
        { oversizedImgs, modernFormatCount, sampled: uniqueImgUrls.length },
        { denominator: uniqueImgUrls.length }
      )
    );
  }

  // 03-07: Hero Lazy Load & Explicit Dimensions
  const lazyHeroPages = pages.filter(
    (p) => p.images.length > 0 && p.images[0].loading === "lazy"
  );
  const missingDims = allImgs.filter((i) => !i.width || !i.height);
  if (allImgs.length === 0) {
    results.push(
      notMeasured("03-07", {
        en: "No <img> elements found to inspect lazy-loading or dimensions.",
        zh: "未发现 <img> 元素，无法检查懒加载与显式宽高。",
      })
    );
  } else if (lazyHeroPages.length > 0) {
    results.push(
      makeResult(
        "03-07",
        "Fail",
        "reproduced",
        {
          en: `${lazyHeroPages.length} page(s) set loading='lazy' on the first/hero image; ${missingDims.length}/${allImgs.length} images lack width/height.`,
          zh: `${lazyHeroPages.length} 个页面对首图误设了 loading='lazy'；${missingDims.length}/${allImgs.length} 张图片缺少显式宽高。`,
        },
        { lazyHeroPages: lazyHeroPages.map((p) => p.url), missingDimsCount: missingDims.length }
      )
    );
  } else if (missingDims.length > 0) {
    results.push(
      makeResult(
        "03-07",
        "Warn",
        "reproduced",
        {
          en: `No hero image lazy-load issues, but ${missingDims.length}/${allImgs.length} images lack explicit width/height.`,
          zh: `首图未误用懒加载，但有 ${missingDims.length}/${allImgs.length} 张图片缺少显式 width/height。`,
        },
        { missingDimsCount: missingDims.length, totalImages: allImgs.length }
      )
    );
  } else {
    results.push(
      makeResult("03-07", "Pass", "reproduced", {
        en: "Hero images avoid lazy-loading and all images declare explicit dimensions.",
        zh: "首图未误设懒加载，且图片均声明了显式宽高。",
      })
    );
  }

  // 03-08: Alt Text & Broken Images
  const missingAlt = allImgs.filter((i) => i.alt === null || i.alt === "");
  if (allImgs.length === 0) {
    results.push(
      notMeasured("03-08", {
        en: "No <img> elements found to check alt text.",
        zh: "未发现 <img> 元素，无法检查 alt 属性。",
      })
    );
  } else if (brokenImgs.length > 0 || missingAlt.length / allImgs.length > 0.3) {
    results.push(
      makeResult(
        "03-08",
        "Fail",
        "reproduced",
        {
          en: `Broken images=${brokenImgs.length}; missing alt=${missingAlt.length}/${allImgs.length}.`,
          zh: `破图数量=${brokenImgs.length}；缺失 alt 属性=${missingAlt.length}/${allImgs.length}。`,
        },
        { brokenImgs, missingAltCount: missingAlt.length, totalImages: allImgs.length },
        { affectedUrls: brokenImgs.map((b) => b.url), denominator: allImgs.length }
      )
    );
  } else if (missingAlt.length > 0) {
    results.push(
      makeResult(
        "03-08",
        "Warn",
        "reproduced",
        {
          en: `Zero broken images; ${missingAlt.length}/${allImgs.length} images are missing alt text.`,
          zh: `无破图；有 ${missingAlt.length}/${allImgs.length} 张图片缺少 alt 描述。`,
        },
        { missingAltCount: missingAlt.length, totalImages: allImgs.length }
      )
    );
  } else {
    results.push(
      makeResult("03-08", "Pass", "reproduced", {
        en: `All ${allImgs.length} images have alt text and zero broken images were detected.`,
        zh: `全部 ${allImgs.length} 张图片均具备 alt 文本且无破图。`,
      })
    );
  }

  // 03-09: HTML Document Hygiene
  const brokenHead = pages.filter((p) => !p.hasDoctype || !p.hasCharsetUtf8 || p.headHasBodyTag);
  const missingLang = pages.filter((p) => !p.langAttr);
  if (brokenHead.length > 0) {
    results.push(
      makeResult(
        "03-09",
        "Fail",
        "reproduced",
        {
          en: `${brokenHead.length}/${total} pages have missing DOCTYPE, non-UTF8 charset, or stray body tags inside <head>.`,
          zh: `${brokenHead.length}/${total} 个页面缺少 DOCTYPE、非 UTF-8 编码或 <head> 内存在非法可见标签。`,
        },
        { brokenHead: brokenHead.map((p) => p.url) },
        { affectedUrls: brokenHead.map((p) => p.url), denominator: total }
      )
    );
  } else if (missingLang.length > 0) {
    results.push(
      makeResult(
        "03-09",
        "Warn",
        "reproduced",
        {
          en: `HTML structure valid, but ${missingLang.length}/${total} pages lack <html lang='...'>.`,
          zh: `HTML 基础结构完整，但有 ${missingLang.length}/${total} 个页面缺少 <html lang> 属性。`,
        },
        { missingLang: missingLang.map((p) => p.url) }
      )
    );
  } else {
    results.push(
      makeResult("03-09", "Pass", "reproduced", {
        en: `All ${total} pages pass DOCTYPE, UTF-8, <html lang>, and <head> integrity checks.`,
        zh: `全部 ${total} 页通过 DOCTYPE、UTF-8、<html lang> 与 <head> 完整性检查。`,
      })
    );
  }

  // 03-10: Dirty Data Scan
  const dirtyPages = pages.filter(
    (p) =>
      p.dirtyData.hasLoremIpsum ||
      p.dirtyData.localhostLinks.length > 0 ||
      p.dirtyData.untranslatedCjkChars > 0
  );
  results.push(
    makeResult(
      "03-10",
      dirtyPages.length === 0 ? "Pass" : "Fail",
      "reproduced",
      {
        en:
          dirtyPages.length === 0
            ? "No Lorem Ipsum, localhost links, or untranslated CJK residue detected."
            : `${dirtyPages.length}/${total} page(s) contain template dirty data (Lorem Ipsum, localhost URLs, or untranslated text).`,
        zh:
          dirtyPages.length === 0
            ? "未发现 Lorem Ipsum、localhost 测试链接或英文页未翻译中文残留。"
            : `${dirtyPages.length}/${total} 个页面存在模板脏数据（占位词、localhost 链接或未译字符残留）。`,
      },
      {
        dirtyPages: dirtyPages.map((p) => ({ url: p.url, dirtyData: p.dirtyData })),
      },
      { affectedUrls: dirtyPages.map((p) => p.url), denominator: total }
    )
  );

  // 03-11: Open Graph
  const homeOg = ctx.homepage?.openGraph ?? {};
  const requiredOg = ["og:title", "og:description", "og:url", "og:type", "og:image"];
  const missingOg = requiredOg.filter((k) => !homeOg[k]);
  let ogImgBroken = false;
  if (homeOg["og:image"]) {
    if (homeOg["og:image"].startsWith("http://") && ctx.canonicalOrigin.startsWith("https://")) {
      ogImgBroken = true;
    } else {
      const r = await fetchWithTrace(homeOg["og:image"], {
        method: "HEAD",
        timeoutMs: config.timeoutMs,
        userAgent: config.userAgent,
        rejectUnauthorized: false,
      });
      if (r.error || r.statusCode >= 400) ogImgBroken = true;
    }
  }
  if (ogImgBroken) {
    results.push(
      makeResult("03-11", "Fail", "reproduced", {
        en: `Homepage og:image is broken or insecure (${homeOg["og:image"]}).`,
        zh: `首页 og:image 破链或使用不安全协议（${homeOg["og:image"]}）。`,
      })
    );
  } else if (missingOg.length > 0) {
    results.push(
      makeResult(
        "03-11",
        "Warn",
        "reproduced",
        {
          en: `Homepage missing Open Graph tags: ${missingOg.join(", ")}.`,
          zh: `首页缺少部分 Open Graph 标签：${missingOg.join(", ")}。`,
        },
        { openGraph: homeOg, missingOg }
      )
    );
  } else {
    results.push(
      makeResult(
        "03-11",
        "Pass",
        "reproduced",
        {
          en: "Homepage includes complete Open Graph tags with a reachable og:image.",
          zh: "首页具备完整 Open Graph 字段且 og:image 可正常访问。",
        },
        { openGraph: homeOg }
      )
    );
  }

  // 03-12: Twitter Card
  const tw = ctx.homepage?.twitterCard;
  const hasTwCard = Boolean(tw?.tags["twitter:card"]);
  results.push(
    makeResult(
      "03-12",
      hasTwCard && !tw?.misusedPropertyAttr ? "Pass" : "Warn",
      "reproduced",
      {
        en: hasTwCard
          ? `Twitter Card present (${tw?.tags["twitter:card"]}), misused property attr=${tw?.misusedPropertyAttr}.`
          : "Homepage is missing twitter:card meta tags.",
        zh: hasTwCard
          ? `已配置 Twitter Card（${tw?.tags["twitter:card"]}），误用 property 属性=${tw?.misusedPropertyAttr}。`
          : "首页缺少 twitter:card 分享卡片标签。",
      },
      { twitterCard: tw }
    )
  );

  // 03-13: JSON-LD Syntax
  const allJsonLd = pages.flatMap((p) =>
    p.jsonLdBlocks.map((b) => ({ url: p.url, error: b.error }))
  );
  const brokenJsonLd = allJsonLd.filter((b) => Boolean(b.error));
  if (brokenJsonLd.length > 0) {
    results.push(
      makeResult(
        "03-13",
        "Fail",
        "reproduced",
        {
          en: `${brokenJsonLd.length}/${allJsonLd.length} JSON-LD script block(s) failed JSON syntax parsing.`,
          zh: `${brokenJsonLd.length}/${allJsonLd.length} 个 JSON-LD 块存在 JSON 语法解析错误。`,
        },
        { brokenJsonLd },
        { affectedUrls: brokenJsonLd.map((b) => b.url) }
      )
    );
  } else if (allJsonLd.length === 0) {
    results.push(
      makeResult("03-13", "Warn", "reproduced", {
        en: "No JSON-LD structured data blocks found in initial HTML.",
        zh: "初始 HTML 中未检测到任何 JSON-LD 结构化数据。",
      })
    );
  } else {
    results.push(
      makeResult(
        "03-13",
        "Pass",
        "reproduced",
        {
          en: `All ${allJsonLd.length} JSON-LD block(s) parsed cleanly with valid JSON syntax.`,
          zh: `全部 ${allJsonLd.length} 个 JSON-LD 结构化数据块语法合法。`,
        },
        { blockCount: allJsonLd.length }
      )
    );
  }

  // 03-14: Core Business / B2B Schema Coverage
  if (!isProfileEnabled("03-14", config)) {
    results.push(
      notMeasured("03-14", {
        en: "B2B Schema check disabled (b2b profile not active).",
        zh: "B2B 核心 Schema 检查未启用（未开启 B2B 扩展包）。",
      })
    );
  } else {
    const allTypes = Array.from(new Set(pages.flatMap((p) => p.schemaTypes)));
    const hasOrg = allTypes.includes("Organization") || allTypes.includes("LocalBusiness");
    const hasCrumb = allTypes.includes("BreadcrumbList");
    results.push(
      makeResult(
        "03-14",
        hasOrg && hasCrumb ? "Pass" : "Warn",
        "reproduced",
        {
          en: `Detected Schema types: ${allTypes.join(", ") || "none"} (Organization=${hasOrg}, BreadcrumbList=${hasCrumb}).`,
          zh: `检测到的 Schema 类型：${allTypes.join(", ") || "无"}（Organization=${hasOrg}，BreadcrumbList=${hasCrumb}）。`,
        },
        { schemaTypes: allTypes }
      )
    );
  }

  // 03-15: Deprecated Schema & Multi-Format Conflict
  const deprecatedFound = Array.from(
    new Set(pages.flatMap((p) => p.schemaTypes).filter((t) => DEPRECATED_SCHEMA_TYPES.has(t)))
  );
  const conflictPages = pages.filter(
    (p) => p.hasMicrodataProduct && p.schemaTypes.includes("Product")
  );
  if (conflictPages.length > 0) {
    results.push(
      makeResult(
        "03-15",
        "Fail",
        "reproduced",
        {
          en: `${conflictPages.length} page(s) emit both JSON-LD and Microdata Product markup (multi-format conflict).`,
          zh: `${conflictPages.length} 个页面同时输出 JSON-LD 与 Microdata Product 标记，存在多格式冲突。`,
        },
        { conflictPages: conflictPages.map((p) => p.url), deprecatedFound },
        { affectedUrls: conflictPages.map((p) => p.url) }
      )
    );
  } else if (deprecatedFound.length > 0) {
    results.push(
      makeResult(
        "03-15",
        "Warn",
        "reproduced",
        {
          en: `Deprecated schema type(s) detected: ${deprecatedFound.join(", ")}.`,
          zh: `检测到已废弃的 Schema 类型：${deprecatedFound.join(", ")}。`,
        },
        { deprecatedFound }
      )
    );
  } else {
    results.push(
      makeResult("03-15", "Pass", "reproduced", {
        en: "No deprecated schema types or JSON-LD/Microdata Product conflicts detected.",
        zh: "未发现已废弃 Schema 类型或 JSON-LD/Microdata 冲突。",
      })
    );
  }

  // 03-16: Basic Accessibility
  const totalUnlabeled = pages.reduce((s, p) => s + p.formStats.unlabeledInputs, 0);
  const totalEmptyBtns = pages.reduce((s, p) => s + p.formStats.emptyButtons, 0);
  results.push(
    makeResult(
      "03-16",
      totalUnlabeled === 0 && totalEmptyBtns === 0 ? "Pass" : "Warn",
      "tool_signal",
      {
        en: `Unlabeled form inputs=${totalUnlabeled}, unlabeled buttons=${totalEmptyBtns} across ${total} pages (contrast/tap targets need browser check).`,
        zh: `共扫描 ${total} 页：缺标签表单输入框=${totalUnlabeled}，无文字按钮=${totalEmptyBtns}（对比度与触控间距需浏览器复核）。`,
      },
      { totalUnlabeled, totalEmptyBtns }
    )
  );

  // 03-17: Privacy Policy & Cookie Compliance
  const hasPrivacy = pages.some((p) => p.hasPrivacyLink);
  const hasCookie = pages.some((p) => p.hasCookieNotice);
  const hasTrackers = pages.some(
    (p) =>
      p.tracking.ga4Ids.length > 0 ||
      p.tracking.gtmIds.length > 0 ||
      p.tracking.legacyUaIds.length > 0
  );
  if (!hasPrivacy && hasTrackers) {
    results.push(
      makeResult("03-17", "Fail", "reproduced", {
        en: "Tracking scripts detected but no Privacy Policy link was found.",
        zh: "页面部署了第三方追踪脚本，但全站未检测到 Privacy Policy 隐私政策链接。",
      })
    );
  } else if (!hasPrivacy || (hasTrackers && !hasCookie)) {
    results.push(
      makeResult("03-17", "Warn", "reproduced", {
        en: `Privacy Policy link=${hasPrivacy}, tracking scripts=${hasTrackers}, cookie notice signal=${hasCookie}.`,
        zh: `隐私政策链接=${hasPrivacy}，追踪脚本=${hasTrackers}，Cookie 告知线索=${hasCookie}。`,
      })
    );
  } else {
    results.push(
      makeResult("03-17", "Pass", "reproduced", {
        en: "Privacy Policy link is present and cookie compliance signals are consistent with tracking usage.",
        zh: "已检测到隐私政策链接，且与追踪脚本合规要求匹配。",
      })
    );
  }

  return results;
}
