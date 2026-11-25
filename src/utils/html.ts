import * as cheerio from "cheerio";
import { normalizeUrl } from "./http.js";

export interface ExtractedLink {
  href: string;
  resolvedUrl: string | null;
  text: string;
  isInternal: boolean;
  targetBlank: boolean;
  hasNoopener: boolean;
}

export interface ExtractedImage {
  src: string;
  resolvedUrl: string | null;
  alt: string | null;
  loading: string | null;
  width: string | null;
  height: string | null;
  fetchPriority: string | null;
}

export interface ParsedPage {
  url: string;
  statusCode: number;
  headers: Record<string, string>;
  ttfbMs: number;
  byteLength: number;
  hasDoctype: boolean;
  langAttr: string | null;
  hasCharsetUtf8: boolean;
  headHasBodyTag: boolean;
  title: string;
  metaDescription: string;
  metaRobots: string[];
  canonicalTags: string[];
  hreflangLinks: Array<{ hreflang: string; href: string }>;
  viewport: string | null;
  generator: string | null;
  h1s: string[];
  h2s: string[];
  h3s: string[];
  headingSkipDetected: boolean;
  logoInH1: boolean;
  links: ExtractedLink[];
  images: ExtractedImage[];
  openGraph: Record<string, string>;
  twitterCard: { tags: Record<string, string>; misusedPropertyAttr: boolean };
  jsonLdBlocks: Array<{ raw: string; parsed?: Record<string, unknown>; error?: string }>;
  schemaTypes: string[];
  hasMicrodataProduct: boolean;
  mixedContentUrls: string[];
  thirdPartyScriptDomains: string[];
  blockingHeadScripts: number;
  dirtyData: {
    hasLoremIpsum: boolean;
    localhostLinks: string[];
    untranslatedCjkChars: number;
  };
  tracking: {
    ga4Ids: string[];
    gtmIds: string[];
    legacyUaIds: string[];
  };
  semanticTags: {
    hasMain: boolean;
    hasArticle: boolean;
    hasNav: boolean;
    tableCount: number;
  };
  hasBreadcrumbs: boolean;
  formStats: {
    formCount: number;
    totalInputs: number;
    unlabeledInputs: number;
    emptyButtons: number;
  };
  hasPrivacyLink: boolean;
  hasCookieNotice: boolean;
  hasInquiryCta: boolean;
  questionHeadings: string[];
  visibleText: string;
  wordCount: number;
  emails: string[];
  socialLinks: string[];
  organizationNames: string[];
  footerText: string;
}

const GENERIC_ANCHORS = new Set([
  "click here",
  "read more",
  "learn more",
  "more",
  "view more",
  "here",
  "details",
]);

export function isGenericAnchor(text: string): boolean {
  return GENERIC_ANCHORS.has(text.trim().toLowerCase());
}

export function parseHtmlPage(
  url: string,
  statusCode: number,
  headers: Record<string, string>,
  rawHtml: string,
  ttfbMs: number,
  byteLength: number
): ParsedPage {
  const pageUrl = new URL(url);
  const pageOrigin = pageUrl.origin;
  const pageHost = pageUrl.hostname.toLowerCase();

  const $ = cheerio.load(rawHtml);

  const hasDoctype = /<!doctype\s+html/i.test(rawHtml.slice(0, 500));
  const langAttr = $("html").attr("lang")?.trim() || null;
  const hasCharsetUtf8 =
    /charset=["']?utf-8["']?/i.test(rawHtml.slice(0, 4096)) ||
    (headers["content-type"] ?? "").toLowerCase().includes("utf-8");

  const headMatch = rawHtml.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  const headHtml = headMatch ? headMatch[1] : "";
  const headHasBodyTag = /<(div|p|h1|h2|img|section|main|header|footer|ul|table)\b/i.test(
    headHtml
  );

  const title = $("title").first().text().replace(/\s+/g, " ").trim();
  const metaDescription =
    $('meta[name="description" i]').first().attr("content")?.trim() ?? "";

  const metaRobots: string[] = [];
  $('meta[name="robots" i], meta[name="googlebot" i]').each((_, el) => {
    const content = $(el).attr("content")?.trim();
    if (content) metaRobots.push(content.toLowerCase());
  });
  if (headers["x-robots-tag"]) {
    metaRobots.push(headers["x-robots-tag"].toLowerCase());
  }

  const canonicalTags: string[] = [];
  $('link[rel="canonical" i]').each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (href) canonicalTags.push(href);
  });

  const hreflangLinks: Array<{ hreflang: string; href: string }> = [];
  $('link[rel="alternate" i][hreflang]').each((_, el) => {
    const hreflang = $(el).attr("hreflang")?.trim() ?? "";
    const href = $(el).attr("href")?.trim() ?? "";
    if (hreflang && href) hreflangLinks.push({ hreflang, href });
  });

  const viewport =
    $('meta[name="viewport" i]').first().attr("content")?.trim() ?? null;
  const generator =
    $('meta[name="generator" i]').first().attr("content")?.trim() ?? null;

  const h1s: string[] = [];
  let logoInH1 = false;
  $("h1").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    h1s.push(text);
    const hasImg = $(el).find("img").length > 0;
    const cls = ($(el).attr("class") ?? "").toLowerCase();
    if ((hasImg && text.length === 0) || cls.includes("logo")) {
      logoInH1 = true;
    }
  });
  const h2s = $("h2")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);
  const h3s = $("h3")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);

  let headingSkipDetected = false;
  let prevLevel = 0;
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const level = Number(el.tagName.slice(1));
    if (prevLevel > 0 && level - prevLevel > 1) {
      headingSkipDetected = true;
    }
    prevLevel = level;
  });

  const links: ExtractedLink[] = [];
  const localhostLinks: string[] = [];
  const socialLinksSet = new Set<string>();
  let hasPrivacyLink = false;

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    const text = $(el).text().replace(/\s+/g, " ").trim();
    const resolvedUrl = normalizeUrl(href, url);
    let isInternal = false;
    if (resolvedUrl) {
      try {
        const u = new URL(resolvedUrl);
        isInternal = u.hostname.toLowerCase() === pageHost;
        if (
          (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
          pageHost !== "localhost" &&
          pageHost !== "127.0.0.1"
        ) {
          localhostLinks.push(resolvedUrl);
        }
        if (
          /(linkedin\.com|youtube\.com|youtu\.be|facebook\.com|instagram\.com|x\.com|twitter\.com)/i.test(
            u.hostname
          )
        ) {
          socialLinksSet.add(resolvedUrl);
        }
      } catch {
        // ignore invalid URL
      }
    }
    const targetBlank = ($(el).attr("target") ?? "").toLowerCase() === "_blank";
    const rel = ($(el).attr("rel") ?? "").toLowerCase();
    const hasNoopener = rel.includes("noopener") || rel.includes("noreferrer");

    if (
      /privacy[\s-]?policy|隐私政策/i.test(text) ||
      /privacy[-_]?policy|\/privacy\b/i.test(href)
    ) {
      hasPrivacyLink = true;
    }

    links.push({
      href,
      resolvedUrl,
      text,
      isInternal,
      targetBlank,
      hasNoopener,
    });
  });

  const images: ExtractedImage[] = [];
  const mixedContentSet = new Set<string>();

  $("img").each((_, el) => {
    const src =
      ($(el).attr("src") ?? $(el).attr("data-src") ?? "").trim();
    const resolvedUrl = src ? normalizeUrl(src, url) : null;
    const altAttr = $(el).attr("alt");
    if (pageUrl.protocol === "https:" && src.toLowerCase().startsWith("http://")) {
      mixedContentSet.add(src);
    }
    images.push({
      src,
      resolvedUrl,
      alt: altAttr === undefined ? null : altAttr.trim(),
      loading: $(el).attr("loading")?.trim().toLowerCase() ?? null,
      width: $(el).attr("width")?.trim() ?? null,
      height: $(el).attr("height")?.trim() ?? null,
      fetchPriority: $(el).attr("fetchpriority")?.trim().toLowerCase() ?? null,
    });
  });

  // Mixed content & third-party scripts
  const thirdPartySet = new Set<string>();
  let blockingHeadScripts = 0;

  $("script[src], link[rel='stylesheet'][href], iframe[src]").each((_, el) => {
    const attr = el.tagName === "link" ? "href" : "src";
    const val = ($(el).attr(attr) ?? "").trim();
    if (
      pageUrl.protocol === "https:" &&
      val.toLowerCase().startsWith("http://")
    ) {
      mixedContentSet.add(val);
    }
    if (el.tagName === "script" && val) {
      const resolved = normalizeUrl(val, url);
      if (resolved) {
        try {
          const h = new URL(resolved).hostname.toLowerCase();
          if (h !== pageHost && !h.endsWith("." + pageHost)) {
            thirdPartySet.add(h);
          }
        } catch {
          // ignore
        }
      }
      if (
        $(el).parents("head").length > 0 &&
        $(el).attr("defer") === undefined &&
        $(el).attr("async") === undefined &&
        $(el).attr("type") !== "module"
      ) {
        blockingHeadScripts++;
      }
    }
  });

  // Open Graph & Twitter
  const openGraph: Record<string, string> = {};
  $('meta[property^="og:" i]').each((_, el) => {
    const prop = ($(el).attr("property") ?? "").toLowerCase();
    const content = ($(el).attr("content") ?? "").trim();
    if (prop && content) openGraph[prop] = content;
  });

  const twitterTags: Record<string, string> = {};
  let misusedPropertyAttr = false;
  $('meta[name^="twitter:" i], meta[property^="twitter:" i]').each((_, el) => {
    const nameAttr = $(el).attr("name");
    const propAttr = $(el).attr("property");
    if (!nameAttr && propAttr) misusedPropertyAttr = true;
    const key = (nameAttr ?? propAttr ?? "").toLowerCase();
    const content = ($(el).attr("content") ?? "").trim();
    if (key && content) twitterTags[key] = content;
  });

  // JSON-LD & Microdata
  const jsonLdBlocks: ParsedPage["jsonLdBlocks"] = [];
  const schemaTypesSet = new Set<string>();
  const organizationNamesSet = new Set<string>();

  function collectSchemaTypes(node: unknown) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(collectSchemaTypes);
      return;
    }
    const rec = node as Record<string, unknown>;
    const rawType = rec["@type"];
    if (typeof rawType === "string") {
      schemaTypesSet.add(rawType);
      if (rawType === "Organization" && typeof rec["name"] === "string") {
        organizationNamesSet.add(rec["name"].trim());
      }
    } else if (Array.isArray(rawType)) {
      rawType.forEach((t) => {
        if (typeof t === "string") schemaTypesSet.add(t);
      });
    }
    if (Array.isArray(rec["sameAs"])) {
      rec["sameAs"].forEach((s) => {
        if (typeof s === "string") socialLinksSet.add(s);
      });
    }
    if (Array.isArray(rec["@graph"])) {
      collectSchemaTypes(rec["@graph"]);
    }
  }

  $('script[type="application/ld+json" i]').each((_, el) => {
    const raw = $(el).html()?.trim() ?? "";
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      jsonLdBlocks.push({ raw, parsed });
      collectSchemaTypes(parsed);
    } catch (err) {
      jsonLdBlocks.push({
        raw,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  const hasMicrodataProduct =
    $('[itemtype*="schema.org/Product" i]').length > 0;

  // Forms & a11y
  const formCount = $("form").length;
  let totalInputs = 0;
  let unlabeledInputs = 0;
  $("form input, form textarea, form select").each((_, el) => {
    const type = ($(el).attr("type") ?? "").toLowerCase();
    if (["hidden", "submit", "button", "reset"].includes(type)) return;
    totalInputs++;
    const id = $(el).attr("id");
    const hasLabelFor = id ? $(`label[for="${id}"]`).length > 0 : false;
    const hasParentLabel = $(el).parents("label").length > 0;
    const hasAria = Boolean(
      $(el).attr("aria-label") ||
        $(el).attr("aria-labelledby") ||
        $(el).attr("placeholder")
    );
    if (!hasLabelFor && !hasParentLabel && !hasAria) {
      unlabeledInputs++;
    }
  });

  let emptyButtons = 0;
  $("button").each((_, el) => {
    const txt = $(el).text().trim();
    const aria = ($(el).attr("aria-label") ?? $(el).attr("title") ?? "").trim();
    if (!txt && !aria) emptyButtons++;
  });

  // Visible text extraction
  const clone = cheerio.load(rawHtml);
  clone("script, style, noscript, svg").remove();
  const visibleText = clone("body").text().replace(/\s+/g, " ").trim();
  const footerText = clone("footer").text().replace(/\s+/g, " ").trim();
  const words = visibleText.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  // Dirty data
  const hasLoremIpsum = /\blorem\s+ipsum\b/i.test(visibleText);
  const isEnglishPage = !langAttr || langAttr.toLowerCase().startsWith("en");
  const cjkMatches = visibleText.match(/[\u4e00-\u9fff]/g) ?? [];
  const untranslatedCjkChars = isEnglishPage ? cjkMatches.length : 0;

  // Tracking tags
  const ga4Ids = Array.from(
    new Set(rawHtml.match(/\bG-[A-Z0-9]{6,14}\b/g) ?? [])
  );
  const gtmIds = Array.from(
    new Set(rawHtml.match(/\bGTM-[A-Z0-9]{5,12}\b/g) ?? [])
  );
  const legacyUaIds = Array.from(
    new Set(rawHtml.match(/\bUA-\d{4,10}-\d{1,4}\b/g) ?? [])
  );

  const hasBreadcrumbs =
    schemaTypesSet.has("BreadcrumbList") ||
    $('nav[aria-label*="breadcrumb" i], .breadcrumb, .breadcrumbs, [itemtype*="BreadcrumbList"]').length > 0;

  const hasCookieNotice =
    /cookie\s*(consent|policy|notice|preferences|banner)|accept\s+cookies|we\s+use\s+cookies/i.test(
      rawHtml
    );

  const hasInquiryCta =
    formCount > 0 ||
    links.some((l) =>
      /contact|inquir|quote|rfq|get\s+a\s+quote|whatsapp|mailto:/i.test(
        `${l.text} ${l.href}`
      )
    );

  const questionHeadings = [...h2s, ...h3s].filter(
    (h) =>
      h.endsWith("?") ||
      h.endsWith("？") ||
      /^(how|what|why|when|where|which|can|do|does|is|are)\b/i.test(h)
  );

  const emails = Array.from(
    new Set(
      (
        rawHtml.match(
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
        ) ?? []
      ).filter((e) => !/\.(png|jpg|jpeg|webp|svg|gif)$/i.test(e))
    )
  );

  return {
    url,
    statusCode,
    headers,
    ttfbMs,
    byteLength,
    hasDoctype,
    langAttr,
    hasCharsetUtf8,
    headHasBodyTag,
    title,
    metaDescription,
    metaRobots,
    canonicalTags,
    hreflangLinks,
    viewport,
    generator,
    h1s,
    h2s,
    h3s,
    headingSkipDetected,
    logoInH1,
    links,
    images,
    openGraph,
    twitterCard: { tags: twitterTags, misusedPropertyAttr },
    jsonLdBlocks,
    schemaTypes: Array.from(schemaTypesSet),
    hasMicrodataProduct,
    mixedContentUrls: Array.from(mixedContentSet),
    thirdPartyScriptDomains: Array.from(thirdPartySet),
    blockingHeadScripts,
    dirtyData: {
      hasLoremIpsum,
      localhostLinks: Array.from(new Set(localhostLinks)),
      untranslatedCjkChars,
    },
    tracking: { ga4Ids, gtmIds, legacyUaIds },
    semanticTags: {
      hasMain: $("main").length > 0,
      hasArticle: $("article").length > 0,
      hasNav: $("nav").length > 0,
      tableCount: $("table").length,
    },
    hasBreadcrumbs,
    formStats: { formCount, totalInputs, unlabeledInputs, emptyButtons },
    hasPrivacyLink,
    hasCookieNotice,
    hasInquiryCta,
    questionHeadings,
    visibleText,
    wordCount,
    emails,
    socialLinks: Array.from(socialLinksSet),
    organizationNames: Array.from(organizationNamesSet),
    footerText,
  };
}
