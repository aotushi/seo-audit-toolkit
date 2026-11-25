import type { CheckResult } from "../types.js";
import {
  inspectDns,
  inspectRdap,
  inspectWayback,
  type RdapSummary,
  type WaybackSummary,
} from "../utils/dns.js";
import {
  fetchWithTrace,
  getApexDomain,
  isLocalOrIpHost,
} from "../utils/http.js";
import { inspectTls, type TlsInspectionResult } from "../utils/tls.js";
import {
  isProfileEnabled,
  makeResult,
  notMeasured,
  type SiteCrawlContext,
} from "./context.js";

function detectCmsAndTech(
  headers: Record<string, string>,
  rawHtml: string,
  generator: string | null
): { cms: string[]; exposedVersions: string[]; csrSignals: string[] } {
  const cms = new Set<string>();
  const exposedVersions: string[] = [];
  const csrSignals: string[] = [];

  const lowerHtml = rawHtml.toLowerCase();
  if (lowerHtml.includes("wp-content") || lowerHtml.includes("wp-includes")) {
    cms.add("WordPress");
  }
  if (lowerHtml.includes("cdn.shopify.com") || lowerHtml.includes("shopify")) {
    cms.add("Shopify");
  }
  if (lowerHtml.includes("woocommerce")) cms.add("WooCommerce");
  if (lowerHtml.includes("next/static") || lowerHtml.includes("__next_data__")) {
    cms.add("Next.js");
  }
  if (lowerHtml.includes("_nuxt")) cms.add("Nuxt");
  if (lowerHtml.includes("leadongcdn") || lowerHtml.includes("ld-")) {
    cms.add("Leadong SaaS");
  }
  if (generator) cms.add(generator);

  const xPoweredBy = headers["x-powered-by"];
  if (xPoweredBy && /\d+\.\d+/.test(xPoweredBy)) {
    exposedVersions.push(`X-Powered-By: ${xPoweredBy}`);
  }
  const server = headers["server"];
  if (server && /\d+\.\d+/.test(server)) {
    exposedVersions.push(`Server: ${server}`);
  }
  if (generator && /\d+\.\d+/.test(generator)) {
    exposedVersions.push(`meta[generator]: ${generator}`);
  }

  if (/<div\s+id=["'](root|app|__next)["'][^>]*>\s*<\/div>/i.test(rawHtml)) {
    csrSignals.push("Empty SPA root container detected");
  }

  return {
    cms: Array.from(cms),
    exposedVersions,
    csrSignals,
  };
}

export async function runModule01(
  ctx: SiteCrawlContext
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const { config, site, startUrl } = ctx;
  const host = startUrl.hostname;
  const apex = getApexDomain(host);
  const isLocal = isLocalOrIpHost(host);
  const skipExt = Boolean(config.skipExternalNetworkLookups) || isLocal;

  // 1) DNS, RDAP, Wayback, TLS in parallel
  const [dnsInfo, rdapInfo, waybackInfo, tlsInfo] = await Promise.all([
    inspectDns(apex),
    skipExt
      ? Promise.resolve<RdapSummary>({
          available: false,
          eppStatuses: [],
          error: "External RDAP lookup skipped",
        })
      : inspectRdap(apex, config.timeoutMs),
    skipExt
      ? Promise.resolve<WaybackSummary>({
          available: false,
          snapshotCount: 0,
          error: "External Wayback lookup skipped",
        })
      : inspectWayback(apex, config.timeoutMs),
    startUrl.protocol === "https:" || !isLocal
      ? inspectTls(host, startUrl.port ? Number(startUrl.port) : 443, config.timeoutMs)
      : Promise.resolve<TlsInspectionResult>({
          hostname: host,
          port: Number(startUrl.port || 80),
          reachable: false,
          authorized: false,
          sans: [],
          coversApex: false,
          coversWww: false,
          error: "HTTP-only local target",
        }),
  ]);

  // 01-D1: Domain Registrar, Lifecycle & Expiry
  if (!rdapInfo.available || rdapInfo.daysUntilExpiry === undefined) {
    results.push(
      notMeasured(
        "01-D1",
        {
          en: `RDAP domain lifecycle unavailable (${rdapInfo.error ?? "no expiry field"}).`,
          zh: `无法通过公开 RDAP 获取域名生命周期（${rdapInfo.error ?? "无到期字段"}）。`,
        },
        "insufficient_data",
        { rdap: rdapInfo }
      )
    );
  } else {
    const days = rdapInfo.daysUntilExpiry;
    const status =
      days <= 0 ? "Fail" : days <= config.thresholds.domainWarnDays ? "Warn" : "Pass";
    results.push(
      makeResult(
        "01-D1",
        status,
        "reproduced",
        {
          en: `Registrar: ${rdapInfo.registrar ?? "Unknown"}; expires in ${days} days (${rdapInfo.expiresAt}).`,
          zh: `注册商：${rdapInfo.registrar ?? "未知"}；剩余有效期 ${days} 天（到期日 ${rdapInfo.expiresAt}）。`,
        },
        { rdap: rdapInfo }
      )
    );
  }

  // 01-D2: EPP Status & DNS Resolution
  if (isLocal) {
    results.push(
      notMeasured("01-D2", {
        en: "Skipped EPP/DNS health check for local/IP test target.",
        zh: "本地/IP 测试目标跳过公网 EPP 与 DNS 解析健康检查。",
      })
    );
  } else {
    const badEpp = rdapInfo.eppStatuses.filter((s) =>
      /hold|redemption|pendingdelete/i.test(s)
    );
    const hasIp = dnsInfo.a.length > 0 || dnsInfo.aaaa.length > 0 || dnsInfo.cname.length > 0;
    const hasTransferLock = rdapInfo.eppStatuses.some((s) =>
      /transferprohibited/i.test(s)
    );
    if (!hasIp || badEpp.length > 0) {
      results.push(
        makeResult(
          "01-D2",
          "Fail",
          "reproduced",
          {
            en: `DNS/EPP issue detected: A/AAAA/CNAME=${hasIp}, critical EPP=${badEpp.join(", ") || "none"}.`,
            zh: `检测到 DNS/EPP 异常：解析存在=${hasIp}，高危状态=${badEpp.join(", ") || "无"}。`,
          },
          { dns: dnsInfo, eppStatuses: rdapInfo.eppStatuses }
        )
      );
    } else if (rdapInfo.available && !hasTransferLock) {
      results.push(
        makeResult(
          "01-D2",
          "Warn",
          "reproduced",
          {
            en: `DNS resolves (${dnsInfo.a.join(", ")}), but clientTransferProhibited lock was not observed.`,
            zh: `DNS 解析正常（${dnsInfo.a.join(", ")}），但未检测到防转移锁（clientTransferProhibited）。`,
          },
          { dns: dnsInfo, eppStatuses: rdapInfo.eppStatuses }
        )
      );
    } else {
      results.push(
        makeResult(
          "01-D2",
          "Pass",
          "reproduced",
          {
            en: `DNS resolves cleanly (${dnsInfo.a.join(", ") || dnsInfo.cname.join(", ")}) with healthy EPP status.`,
            zh: `DNS 解析稳定（${dnsInfo.a.join(", ") || dnsInfo.cname.join(", ")}），EPP 状态正常。`,
          },
          { dns: dnsInfo, eppStatuses: rdapInfo.eppStatuses }
        )
      );
    }
  }

  // 01-D3: Wayback Historical Snapshots
  if (!waybackInfo.available) {
    results.push(
      notMeasured(
        "01-D3",
        {
          en: `Wayback Machine lookup skipped or unavailable (${waybackInfo.error ?? "unknown"}).`,
          zh: `Wayback 历史快照未查询或暂不可用（${waybackInfo.error ?? "未知"}）。`,
        },
        "insufficient_data",
        { wayback: waybackInfo }
      )
    );
  } else {
    results.push(
      makeResult(
        "01-D3",
        "Warn",
        "tool_signal",
        {
          en: `Found ${waybackInfo.snapshotCount} archived year(s) (${waybackInfo.firstYear ?? "-"} to ${waybackInfo.lastYear ?? "-"}); manual review recommended for spam history.`,
          zh: `检索到 ${waybackInfo.snapshotCount} 个历史年份快照（${waybackInfo.firstYear ?? "-"} 至 ${waybackInfo.lastYear ?? "-"}），建议人工抽查历史用途。`,
        },
        { wayback: waybackInfo }
      )
    );
  }

  // 01-D4: Email DNS (MX / SPF / DMARC)
  if (!isProfileEnabled("01-D4", config) || isLocal) {
    results.push(
      notMeasured("01-D4", {
        en: "Email DNS check not applicable (b2b profile disabled or local target).",
        zh: "邮件 DNS 检查不适用（未启用 B2B 扩展包或为本地测试目标）。",
      })
    );
  } else if (dnsInfo.mx.length === 0) {
    results.push(
      notMeasured(
        "01-D4",
        {
          en: "No MX records found; domain may not be used for email.",
          zh: "未检测到 MX 记录，该域名可能未用于邮件收发。",
        },
        "reproduced",
        { mx: dnsInfo.mx, spf: dnsInfo.spf, dmarc: dnsInfo.dmarc }
      )
    );
  } else if (dnsInfo.spf && dnsInfo.dmarc) {
    results.push(
      makeResult(
        "01-D4",
        "Pass",
        "reproduced",
        {
          en: `MX (${dnsInfo.mx.length}), SPF, and DMARC records are configured.`,
          zh: `已配置 MX（${dnsInfo.mx.length} 条）、SPF 与 DMARC 记录。`,
        },
        { mx: dnsInfo.mx, spf: dnsInfo.spf, dmarc: dnsInfo.dmarc }
      )
    );
  } else {
    results.push(
      makeResult(
        "01-D4",
        "Warn",
        "reproduced",
        {
          en: `MX present, but missing ${!dnsInfo.spf ? "SPF" : ""}${!dnsInfo.spf && !dnsInfo.dmarc ? " & " : ""}${!dnsInfo.dmarc ? "DMARC" : ""}.`,
          zh: `存在 MX 记录，但缺失 ${!dnsInfo.spf ? "SPF" : ""}${!dnsInfo.spf && !dnsInfo.dmarc ? " 与 " : ""}${!dnsInfo.dmarc ? "DMARC" : ""}。`,
        },
        { mx: dnsInfo.mx, spf: dnsInfo.spf, dmarc: dnsInfo.dmarc }
      )
    );
  }

  const homeRes = ctx.homepageResponse;
  const homePage = ctx.homepage;
  const headers = homeRes?.headers ?? {};

  // 01-T1: Hosting & Server Header
  results.push(
    makeResult(
      "01-T1",
      homeRes && !homeRes.error ? "Pass" : "Fail",
      "reproduced",
      {
        en: `Resolved IPs: ${dnsInfo.a.join(", ") || host}; Server header: ${headers["server"] ?? "hidden"}.`,
        zh: `解析 IP：${dnsInfo.a.join(", ") || host}；Web 服务器头：${headers["server"] ?? "已隐藏"}。`,
      },
      { ips: dnsInfo.a, server: headers["server"] ?? null }
    )
  );

  // 01-T2: CDN, WAF & Edge Caching
  const cdnHeaderKeys = ["cf-ray", "cf-cache-status", "x-cache", "x-cdn", "via", "x-vercel-cache", "x-amz-cf-id"];
  const detectedCdnHeaders: Record<string, string> = {};
  for (const k of cdnHeaderKeys) {
    if (headers[k]) detectedCdnHeaders[k] = headers[k];
  }
  const wafBlocked =
    homeRes &&
    (homeRes.statusCode === 403 || homeRes.statusCode === 429) &&
    /cloudflare|attention required|captcha|access denied|bot/i.test(homeRes.body);
  if (wafBlocked) {
    results.push(
      makeResult(
        "01-T2",
        "Fail",
        "reproduced",
        {
          en: `WAF/bot challenge blocked homepage request (HTTP ${homeRes.statusCode}).`,
          zh: `WAF/人机验证拦截了首页请求（HTTP ${homeRes.statusCode}）。`,
        },
        { cdnHeaders: detectedCdnHeaders, statusCode: homeRes.statusCode }
      )
    );
  } else if (Object.keys(detectedCdnHeaders).length > 0) {
    results.push(
      makeResult(
        "01-T2",
        "Pass",
        "reproduced",
        {
          en: `CDN/cache signals detected (${Object.keys(detectedCdnHeaders).join(", ")}), no bot block observed.`,
          zh: `检测到 CDN/缓存信号（${Object.keys(detectedCdnHeaders).join(", ")}），未误拦爬虫。`,
        },
        { cdnHeaders: detectedCdnHeaders }
      )
    );
  } else {
    results.push(
      makeResult(
        "01-T2",
        "Warn",
        "tool_signal",
        {
          en: "No obvious CDN edge cache headers detected on HTML response.",
          zh: "主文档响应头中未检测到明显的 CDN 边缘缓存信号。",
        },
        { cdnHeaders: detectedCdnHeaders }
      )
    );
  }

  // 01-T3: SSL CA & Renewal
  if (!tlsInfo.reachable) {
    results.push(
      isLocal && startUrl.protocol === "http:"
        ? notMeasured("01-T3", {
            en: "TLS CA check not applicable on HTTP-only local test server.",
            zh: "本地纯 HTTP 测试服务不适用 TLS 证书签发商检查。",
          })
        : makeResult(
            "01-T3",
            "Fail",
            "reproduced",
            {
              en: `TLS handshake failed: ${tlsInfo.error ?? "unreachable"}.`,
              zh: `TLS 握手失败：${tlsInfo.error ?? "无法连接"}。`,
            },
            { tls: tlsInfo }
          )
    );
  } else {
    const isAutoCa = /let's encrypt|google trust|cloudflare|amazon|zerossl/i.test(
      tlsInfo.issuer ?? ""
    );
    results.push(
      makeResult(
        "01-T3",
        isAutoCa ? "Pass" : "Warn",
        "reproduced",
        {
          en: `CA Issuer: ${tlsInfo.issuer ?? "Unknown"}; expires ${tlsInfo.validTo ?? "Unknown"}.`,
          zh: `证书签发商：${tlsInfo.issuer ?? "未知"}；到期时间：${tlsInfo.validTo ?? "未知"}。`,
        },
        { issuer: tlsInfo.issuer, validFrom: tlsInfo.validFrom, validTo: tlsInfo.validTo }
      )
    );
  }

  // 01-T4: CMS & Version Exposure
  const tech = detectCmsAndTech(
    headers,
    homeRes?.body ?? "",
    homePage?.generator ?? null
  );
  results.push(
    makeResult(
      "01-T4",
      tech.exposedVersions.length > 0 ? "Warn" : "Pass",
      "reproduced",
      {
        en: `Detected CMS/Stack: ${tech.cms.join(", ") || "Custom/Unknown"}; exposed versions: ${tech.exposedVersions.length}.`,
        zh: `识别技术栈：${tech.cms.join(", ") || "自建/未明"}；暴露版本号数：${tech.exposedVersions.length}。`,
      },
      { cms: tech.cms, exposedVersions: tech.exposedVersions }
    )
  );

  // 01-T5: Frontend Rendering & Third-Party Scripts
  const tpCount = homePage?.thirdPartyScriptDomains.length ?? 0;
  results.push(
    makeResult(
      "01-T5",
      tech.csrSignals.length > 0 ? "Warn" : "Pass",
      "reproduced",
      {
        en: `Third-party script domains: ${tpCount}; CSR shell signals: ${tech.csrSignals.length}.`,
        zh: `第三方脚本域名数：${tpCount}；纯客户端渲染信号：${tech.csrSignals.length}。`,
      },
      {
        thirdPartyScriptDomains: homePage?.thirdPartyScriptDomains ?? [],
        csrSignals: tech.csrSignals,
      }
    )
  );

  // 01-01: SSL Certificate Validity & Expiry
  if (isLocal && startUrl.protocol === "http:") {
    results.push(
      notMeasured("01-01", {
        en: "SSL check not applicable on HTTP-only local test server.",
        zh: "本地纯 HTTP 测试服务不适用 SSL 证书检查。",
      })
    );
  } else if (!tlsInfo.reachable || !tlsInfo.authorized || (tlsInfo.daysRemaining ?? -1) <= 0) {
    results.push(
      makeResult(
        "01-01",
        "Fail",
        "reproduced",
        {
          en: `SSL invalid or expired (authorized=${tlsInfo.authorized}, daysRemaining=${tlsInfo.daysRemaining ?? "N/A"}, err=${tlsInfo.authorizationError ?? tlsInfo.error ?? "none"}).`,
          zh: `SSL 证书无效或已过期（信任=${tlsInfo.authorized}，剩余天数=${tlsInfo.daysRemaining ?? "N/A"}，错误=${tlsInfo.authorizationError ?? tlsInfo.error ?? "无"}）。`,
        },
        { tls: tlsInfo }
      )
    );
  } else if ((tlsInfo.daysRemaining ?? 999) <= config.thresholds.sslWarnDays) {
    results.push(
      makeResult(
        "01-01",
        "Warn",
        "reproduced",
        {
          en: `SSL certificate expires soon (${tlsInfo.daysRemaining} days remaining).`,
          zh: `SSL 证书即将过期（剩余 ${tlsInfo.daysRemaining} 天）。`,
        },
        { tls: tlsInfo }
      )
    );
  } else {
    results.push(
      makeResult(
        "01-01",
        "Pass",
        "reproduced",
        {
          en: `SSL certificate valid (${tlsInfo.daysRemaining} days remaining, ${tlsInfo.protocol ?? "TLS"}).`,
          zh: `SSL 证书有效且信任链完整（剩余 ${tlsInfo.daysRemaining} 天，${tlsInfo.protocol ?? "TLS"}）。`,
        },
        { tls: tlsInfo }
      )
    );
  }

  // 01-02: SAN Coverage (Apex + www)
  if (isLocal && startUrl.protocol === "http:") {
    results.push(
      notMeasured("01-02", {
        en: "SAN coverage not applicable on HTTP-only local test server.",
        zh: "本地纯 HTTP 测试服务不适用证书 SAN 覆盖检查。",
      })
    );
  } else if (!tlsInfo.reachable) {
    results.push(
      makeResult("01-02", "Fail", "reproduced", {
        en: "Cannot verify SAN coverage because TLS connection failed.",
        zh: "TLS 连接失败，无法验证证书域名覆盖。",
      })
    );
  } else {
    const both = tlsInfo.coversApex && tlsInfo.coversWww;
    results.push(
      makeResult(
        "01-02",
        both ? "Pass" : "Fail",
        "reproduced",
        {
          en: `SAN covers apex=${tlsInfo.coversApex}, www=${tlsInfo.coversWww} (SANs: ${tlsInfo.sans.slice(0, 6).join(", ")}).`,
          zh: `证书覆盖裸域=${tlsInfo.coversApex}，覆盖 www=${tlsInfo.coversWww}（SAN：${tlsInfo.sans.slice(0, 6).join(", ")}）。`,
        },
        { coversApex: tlsInfo.coversApex, coversWww: tlsInfo.coversWww, sans: tlsInfo.sans }
      )
    );
  }

  // 01-03: HTTPS Enforcement & Mixed Content
  const mixed = Array.from(ctx.crawledPages.values()).flatMap((p) => p.mixedContentUrls);
  if (startUrl.protocol === "http:" && isLocal) {
    results.push(
      notMeasured("01-03", {
        en: "HTTPS mixed-content check not applicable on HTTP-only local target.",
        zh: "本地纯 HTTP 测试目标不适用 HTTPS 混合内容检查。",
      })
    );
  } else if (!ctx.canonicalOrigin.startsWith("https://")) {
    results.push(
      makeResult("01-03", "Fail", "reproduced", {
        en: `Canonical origin is not HTTPS (${ctx.canonicalOrigin}).`,
        zh: `规范首页未使用 HTTPS（${ctx.canonicalOrigin}）。`,
      })
    );
  } else if (mixed.length > 0) {
    results.push(
      makeResult(
        "01-03",
        "Warn",
        "reproduced",
        {
          en: `Found ${mixed.length} insecure HTTP asset reference(s) on HTTPS pages.`,
          zh: `HTTPS 页面中发现 ${mixed.length} 处 HTTP 混合内容资源引用。`,
        },
        { mixedContentUrls: mixed.slice(0, 20) }
      )
    );
  } else {
    results.push(
      makeResult("01-03", "Pass", "reproduced", {
        en: "Canonical origin uses HTTPS with zero mixed-content URLs found.",
        zh: "全站采用 HTTPS 且未发现混合内容资源。",
      })
    );
  }

  // 01-04: Security Headers & Basic Hygiene
  const hasHsts = Boolean(headers["strict-transport-security"]);
  const hasNoSniff = (headers["x-content-type-options"] ?? "")
    .toLowerCase()
    .includes("nosniff");
  const missingNoopener = Array.from(ctx.crawledPages.values()).flatMap((p) =>
    p.links.filter((l) => !l.isInternal && l.targetBlank && !l.hasNoopener)
  );
  if (hasHsts && hasNoSniff && missingNoopener.length === 0) {
    results.push(
      makeResult("01-04", "Pass", "reproduced", {
        en: "HSTS, X-Content-Type-Options: nosniff, and external rel=noopener checks passed.",
        zh: "HSTS、nosniff 安全头与新窗口外链 rel=noopener 检查全部通过。",
      })
    );
  } else {
    results.push(
      makeResult(
        "01-04",
        "Warn",
        "reproduced",
        {
          en: `HSTS=${hasHsts}, nosniff=${hasNoSniff}, target=_blank external links missing noopener=${missingNoopener.length}.`,
          zh: `HSTS=${hasHsts}，nosniff=${hasNoSniff}，缺 noopener 的新窗口外链数=${missingNoopener.length}。`,
        },
        {
          hsts: headers["strict-transport-security"] ?? null,
          xContentTypeOptions: headers["x-content-type-options"] ?? null,
          missingNoopenerCount: missingNoopener.length,
        }
      )
    );
  }

  // 01-05: Four-Entry Single-Hop 301 Consolidation
  if (isLocal) {
    results.push(
      notMeasured("01-05", {
        en: "Four-entry (http/https × apex/www) redirect check skipped for local/IP target.",
        zh: "本地/IP 测试目标跳过四入口（http/https × 裸域/www）跳转收敛检查。",
      })
    );
  } else {
    const entries = [
      `http://${apex}/`,
      `http://www.${apex}/`,
      `https://${apex}/`,
      `https://www.${apex}/`,
    ];
    const traces = await Promise.all(
      entries.map((u) =>
        fetchWithTrace(u, {
          timeoutMs: config.timeoutMs,
          userAgent: config.userAgent,
          rejectUnauthorized: false,
          maxBodyBytes: 4096,
        })
      )
    );
    const finalUrls = new Set(traces.filter((t) => !t.error).map((t) => t.finalUrl));
    const hasFailures = traces.some((t) => Boolean(t.error) || t.statusCode >= 400);
    const multiHopOr302 = traces.some(
      (t) =>
        t.hops.length > 2 ||
        t.hops.some((h) => h.statusCode === 302 || h.statusCode === 307)
    );
    if (hasFailures || finalUrls.size !== 1) {
      results.push(
        makeResult(
          "01-05",
          "Fail",
          "reproduced",
          {
            en: `Four entries did not cleanly consolidate to one canonical URL (distinct finals=${finalUrls.size}, errors=${hasFailures}).`,
            zh: `四个入口未收敛到唯一规范首页（落地数=${finalUrls.size}，存在报错=${hasFailures}）。`,
          },
          {
            traces: traces.map((t) => ({
              entry: t.url,
              finalUrl: t.finalUrl,
              status: t.statusCode,
              hops: t.hops.map((h) => `${h.statusCode}:${h.url}`),
              error: t.error,
            })),
          }
        )
      );
    } else if (multiHopOr302) {
      results.push(
        makeResult(
          "01-05",
          "Warn",
          "reproduced",
          {
            en: `All 4 entries consolidate to ${Array.from(finalUrls)[0]}, but multi-hop or 302 redirect was observed.`,
            zh: `四入口最终收敛至 ${Array.from(finalUrls)[0]}，但存在多跳重定向或 302 跳转。`,
          },
          { finalUrl: Array.from(finalUrls)[0] }
        )
      );
    } else {
      results.push(
        makeResult(
          "01-05",
          "Pass",
          "reproduced",
          {
            en: `All 4 entries cleanly converge in <= 1 hop (301) to ${Array.from(finalUrls)[0]}.`,
            zh: `四入口均经单跳 301 规范收敛至 ${Array.from(finalUrls)[0]}。`,
          },
          { finalUrl: Array.from(finalUrls)[0] }
        )
      );
    }
  }

  // 01-06: Core Pages Status & 5xx/Timeout
  const badPages = Array.from(ctx.crawledPages.values()).filter(
    (p) => p.statusCode >= 400 || p.statusCode === 0
  );
  if (!homeRes || homeRes.error || homeRes.statusCode >= 400) {
    results.push(
      makeResult("01-06", "Fail", "reproduced", {
        en: `Homepage failed with status ${homeRes?.statusCode ?? 0} (${homeRes?.error ?? "error"}).`,
        zh: `首页请求失败，状态码 ${homeRes?.statusCode ?? 0}（${homeRes?.error ?? "错误"}）。`,
      })
    );
  } else if (badPages.length > 0) {
    results.push(
      makeResult(
        "01-06",
        "Fail",
        "reproduced",
        {
          en: `${badPages.length}/${ctx.crawledPages.size} crawled pages returned 4xx/5xx.`,
          zh: `抓取的 ${ctx.crawledPages.size} 个页面中有 ${badPages.length} 个返回 4xx/5xx。`,
        },
        { badPages: badPages.map((p) => ({ url: p.url, status: p.statusCode })) },
        { affectedUrls: badPages.map((p) => p.url), denominator: ctx.crawledPages.size }
      )
    );
  } else {
    results.push(
      makeResult(
        "01-06",
        "Pass",
        "reproduced",
        {
          en: `Homepage and all ${ctx.crawledPages.size} crawled core pages returned HTTP 200.`,
          zh: `首页及全部 ${ctx.crawledPages.size} 个已抓取核心页均稳定返回 HTTP 200。`,
        },
        { pagesChecked: ctx.crawledPages.size },
        { denominator: ctx.crawledPages.size }
      )
    );
  }

  // 01-07: Soft 404 Detection
  const randomNotFoundUrl = new URL(
    `/seo-audit-nonexistent-check-${Date.now().toString(36)}`,
    ctx.canonicalOrigin
  ).toString();
  const soft404Res = await fetchWithTrace(randomNotFoundUrl, {
    timeoutMs: config.timeoutMs,
    userAgent: config.userAgent,
    rejectUnauthorized: false,
    maxBodyBytes: 8192,
  });
  if (soft404Res.error) {
    results.push(
      notMeasured("01-07", {
        en: `Soft 404 probe failed to connect (${soft404Res.error}).`,
        zh: `Soft 404 探针请求失败（${soft404Res.error}）。`,
      })
    );
  } else if (soft404Res.statusCode === 404 || soft404Res.statusCode === 410) {
    results.push(
      makeResult(
        "01-07",
        "Pass",
        "reproduced",
        {
          en: `Non-existent probe URL properly returned HTTP ${soft404Res.statusCode}.`,
          zh: `随机不存在测试路径正确返回 HTTP ${soft404Res.statusCode}。`,
        },
        { probeUrl: randomNotFoundUrl, statusCode: soft404Res.statusCode }
      )
    );
  } else {
    results.push(
      makeResult(
        "01-07",
        "Fail",
        "reproduced",
        {
          en: `Soft 404 detected: non-existent URL returned HTTP ${soft404Res.statusCode} (final: ${soft404Res.finalUrl}).`,
          zh: `检测到 Soft 404：不存在路径返回 HTTP ${soft404Res.statusCode}（最终落地：${soft404Res.finalUrl}）。`,
        },
        {
          probeUrl: randomNotFoundUrl,
          statusCode: soft404Res.statusCode,
          finalUrl: soft404Res.finalUrl,
        }
      )
    );
  }

  // 01-08: Sitemap & Internal Link Protocol Consistency
  const nonHttpsSitemap = ctx.sitemapUrls.filter(
    (u) => ctx.canonicalOrigin.startsWith("https://") && u.startsWith("http://")
  );
  const nonHttpsInternal = Array.from(ctx.crawledPages.values()).flatMap((p) =>
    p.links
      .filter(
        (l) =>
          l.isInternal &&
          ctx.canonicalOrigin.startsWith("https://") &&
          l.href.toLowerCase().startsWith("http://")
      )
      .map((l) => l.href)
  );
  if (nonHttpsSitemap.length > 0) {
    results.push(
      makeResult(
        "01-08",
        "Fail",
        "reproduced",
        {
          en: `XML Sitemap contains ${nonHttpsSitemap.length} insecure http:// URL(s).`,
          zh: `XML Sitemap 混入 ${nonHttpsSitemap.length} 条 http:// 非规范链接。`,
        },
        { nonHttpsSitemap: nonHttpsSitemap.slice(0, 20) }
      )
    );
  } else if (nonHttpsInternal.length > 0) {
    results.push(
      makeResult(
        "01-08",
        "Warn",
        "reproduced",
        {
          en: `Found ${nonHttpsInternal.length} internal link(s) hardcoded with http://.`,
          zh: `站内发现 ${nonHttpsInternal.length} 条硬编码为 http:// 的内链。`,
        },
        { sample: nonHttpsInternal.slice(0, 20) }
      )
    );
  } else {
    results.push(
      makeResult("01-08", "Pass", "reproduced", {
        en: "Sitemap and internal links consistently match the canonical protocol.",
        zh: "Sitemap 与站内链接协议与规范版本保持一致。",
      })
    );
  }

  // 01-09: Historical Domain Migration
  const histDomains = site.historicalDomains ?? [];
  if (histDomains.length === 0) {
    results.push(
      notMeasured("01-09", {
        en: "No historical domains configured (N/A).",
        zh: "未配置历史旧域名（不适用，不计入分母）。",
      })
    );
  } else {
    const checks = await Promise.all(
      histDomains.map((d) =>
        fetchWithTrace(d.startsWith("http") ? d : `https://${d}/`, {
          timeoutMs: config.timeoutMs,
          userAgent: config.userAgent,
          rejectUnauthorized: false,
          maxBodyBytes: 4096,
        })
      )
    );
    const bad = checks.filter(
      (c) =>
        c.error ||
        !c.finalUrl.startsWith(ctx.canonicalOrigin) ||
        !c.hops.some((h) => h.statusCode === 301)
    );
    results.push(
      makeResult(
        "01-09",
        bad.length === 0 ? "Pass" : "Fail",
        "reproduced",
        {
          en: `${checks.length - bad.length}/${checks.length} historical domains cleanly 301-redirect to canonical origin.`,
          zh: `${checks.length - bad.length}/${checks.length} 个历史旧域名正常 301 跳转至当前规范域。`,
        },
        { checks: checks.map((c) => ({ url: c.url, finalUrl: c.finalUrl, error: c.error })) }
      )
    );
  }

  // 01-10: Target-Market Reachability (always honest manual/regional probe)
  results.push(
    notMeasured(
      "01-10",
      {
        en: `Only tested from local execution node (${config.networkLabel ?? "local"}); target-market regional probe required.`,
        zh: `仅在当前执行节点（${config.networkLabel ?? "本机"}）完成实测，需在目标市场节点拨测复核。`,
      },
      "insufficient_data",
      { networkLabel: config.networkLabel ?? "local" }
    )
  );

  // 01-11: Primary Document TTFB
  const ttfb = homeRes?.ttfbMs ?? 0;
  if (!homeRes || homeRes.error) {
    results.push(
      makeResult("01-11", "Fail", "reproduced", {
        en: "Homepage unreachable; TTFB could not be measured.",
        zh: "首页不可达，无法测量 TTFB。",
      })
    );
  } else {
    const status =
      ttfb <= config.thresholds.ttfbPassMs
        ? "Pass"
        : ttfb <= config.thresholds.ttfbWarnMs
          ? "Warn"
          : "Fail";
    results.push(
      makeResult(
        "01-11",
        status,
        "reproduced",
        {
          en: `Homepage TTFB from ${config.networkLabel ?? "local"}: ${ttfb} ms.`,
          zh: `当前节点（${config.networkLabel ?? "本机"}）实测首页 TTFB：${ttfb} ms。`,
        },
        { ttfbMs: ttfb, networkLabel: config.networkLabel ?? "local" }
      )
    );
  }

  // 01-12: HTTP Compression
  const enc = (homeRes?.contentEncoding ?? "").toLowerCase();
  const hasComp = enc.includes("br") || enc.includes("gzip") || enc.includes("deflate");
  results.push(
    makeResult(
      "01-12",
      hasComp ? "Pass" : "Warn",
      "reproduced",
      {
        en: hasComp
          ? `HTML response uses ${enc} compression.`
          : "HTML response was not compressed (no br/gzip Content-Encoding header).",
        zh: hasComp
          ? `HTML 主文档已开启 ${enc} 压缩。`
          : "HTML 主文档未开启 Brotli/Gzip 传输压缩。",
      },
      { contentEncoding: enc || "none" }
    )
  );

  // 01-13: Cache-Control & Blocking Scripts
  const cacheControl = headers["cache-control"] ?? "";
  const blocking = homePage?.blockingHeadScripts ?? 0;
  results.push(
    makeResult(
      "01-13",
      blocking <= 3 ? "Pass" : "Warn",
      "tool_signal",
      {
        en: `Homepage Cache-Control: '${cacheControl || "none"}'; render-blocking <head> scripts: ${blocking}.`,
        zh: `首页 Cache-Control：'${cacheControl || "未设置"}'；<head> 阻塞渲染脚本数：${blocking}。`,
      },
      { cacheControl, blockingHeadScripts: blocking }
    )
  );

  // 01-14: Initial HTML Completeness vs CSR Shell
  const words = homePage?.wordCount ?? 0;
  const h1Count = homePage?.h1s.length ?? 0;
  if (words < 30 && tech.csrSignals.length > 0) {
    results.push(
      makeResult("01-14", "Fail", "reproduced", {
        en: `Initial HTML looks like an empty CSR shell (${words} visible words, ${h1Count} H1).`,
        zh: `初始 HTML 疑似客户端渲染空壳（可见词数 ${words}，H1 数 ${h1Count}）。`,
      })
    );
  } else {
    results.push(
      makeResult(
        "01-14",
        words >= 50 ? "Pass" : "Warn",
        "tool_signal",
        {
          en: `Initial HTML contains ${words} visible words and ${h1Count} H1 tag(s); verify rendered mobile DOM with Playwright.`,
          zh: `初始 HTML 包含 ${words} 个可见词与 ${h1Count} 个 H1；建议配合手机浏览器对照渲染后 DOM。`,
        },
        { wordCount: words, h1Count }
      )
    );
  }

  // 01-15: Core Web Vitals (requires Lighthouse / CrUX)
  results.push(
    notMeasured(
      "01-15",
      {
        en: "Core Web Vitals (LCP/INP/CLS) require CrUX/GSC field data or Lighthouse browser run.",
        zh: "Core Web Vitals（LCP/INP/CLS）需结合 CrUX/GSC 真实数据或 Lighthouse 浏览器实测。",
      },
      "needs_gsc"
    )
  );

  // 01-16: Slow-Page Bottleneck Isolation
  const slowPages = Array.from(ctx.crawledPages.values()).filter(
    (p) => p.ttfbMs > 3000 || p.byteLength > 1024 * 1024
  );
  results.push(
    makeResult(
      "01-16",
      slowPages.length === 0 ? "Pass" : "Warn",
      "reproduced",
      {
        en:
          slowPages.length === 0
            ? "No crawled HTML pages exceeded 3s TTFB or 1 MB document size."
            : `${slowPages.length} page(s) showed extreme HTML TTFB (>3s) or size (>1MB) and need waterfall profiling.`,
        zh:
          slowPages.length === 0
            ? "已抓取页面中未出现 TTFB > 3s 或单文档 > 1 MB 的严重慢页。"
            : `发现 ${slowPages.length} 个严重慢页或超大 HTML 文档，建议进行瀑布流根因拆解与复测。`,
      },
      { slowPages: slowPages.map((p) => ({ url: p.url, ttfbMs: p.ttfbMs, byteLength: p.byteLength })) },
      { affectedUrls: slowPages.map((p) => p.url) }
    )
  );

  // 01-17: Runtime JS Console Errors
  results.push(
    notMeasured(
      "01-17",
      {
        en: "Runtime JS console errors and failed XHR/CORS subresources require headless browser execution.",
        zh: "JS 运行时报错与失败子资源需在真实/无头浏览器中渲染验证。",
      },
      "insufficient_data"
    )
  );

  return results;
}
