import type { ModuleId, RuleDefinition } from "../types.js";

export const RULE_SET_VERSION = "1.0.0";

/**
 * Single-source-of-truth bilingual rule registry covering 80 rules across Modules 01-05:
 * - Module 01: 26 rules (01-D1..01-D4, 01-T1..01-T5, 01-01..01-17)
 * - Module 02: 14 rules (02-01..02-14)
 * - Module 03: 17 rules (03-01..03-17)
 * - Module 04: 14 rules (04-01..04-14)
 * - Module 05: 9 rules  (05-01..05-09)
 */
export const RULES: RuleDefinition[] = [
  // ======================== MODULE 01 (26) ========================
  {
    id: "01-D1",
    module: "01",
    priority: "P0",
    automation: "auto",
    profile: "core",
    title: {
      en: "Domain Registrar, Lifecycle & Expiry Warning",
      zh: "域名注册商、生命周期与到期预警",
    },
    description: {
      en: "Verify domain registration age, registrar, and remaining validity (> 60 days pass, <= 60 days warn, expired fail).",
      zh: "核查域名注册商、注册年龄与剩余有效期（> 60 天通过，≤ 60 天预警，过期失败）。",
    },
    remediation: {
      en: "Enable auto-renewal at your registrar and assign an explicit renewal owner.",
      zh: "在域名注册商开启自动续费，并在内部台账明确续费责任人。",
    },
  },
  {
    id: "01-D2",
    module: "01",
    priority: "P0",
    automation: "auto",
    profile: "core",
    title: {
      en: "EPP Domain Status & DNS Resolution Health",
      zh: "EPP 域名状态码与 DNS 解析健康",
    },
    description: {
      en: "Check EPP lock/hold statuses (clientHold/serverHold/pendingDelete) and DNS NS/A/AAAA/CNAME resolution.",
      zh: "核查 EPP 状态码（防转移锁或异常 Hold）及 NS/A/AAAA/CNAME 解析稳定性。",
    },
    remediation: {
      en: "Resolve any Hold statuses immediately, enable transfer lock, and clean stale DNS records.",
      zh: "立即解除异常 Hold 状态，开启防转移锁并清理冗余 DNS 记录。",
    },
  },
  {
    id: "01-D3",
    module: "01",
    priority: "P1",
    automation: "semi-auto",
    profile: "core",
    title: {
      en: "Domain Historical Snapshots & Spam History",
      zh: "域名历史快照与不良前科排查",
    },
    description: {
      en: "Query public archive snapshots (Wayback Machine) to review prior domain usage and spam risk.",
      zh: "通过历史档案（Wayback Machine）排查域名过往用途与灰产/垃圾站前科。",
    },
    remediation: {
      en: "Review archived snapshots for spam/hijack history and check Manual Actions in Search Console.",
      zh: "复核历史快照是否存在异常用途，获得 GSC 权限后核查人工操作与外链。",
    },
  },
  {
    id: "01-D4",
    module: "01",
    priority: "P2",
    automation: "auto",
    profile: "b2b",
    title: {
      en: "Email Deliverability DNS (MX / SPF / DMARC)",
      zh: "询盘邮件 DNS 配置（MX / SPF / DMARC）",
    },
    description: {
      en: "Check MX, SPF, and DMARC TXT records to protect inquiry emails from spam filters.",
      zh: "核查域名的 MX、SPF 与 DMARC 解析，防止外贸询盘与企业邮箱进入垃圾箱。",
    },
    remediation: {
      en: "Configure valid MX, a strict SPF record, DKIM, and a DMARC policy.",
      zh: "配置规范的 MX、SPF、DKIM 与 DMARC 记录。",
    },
  },
  {
    id: "01-T1",
    module: "01",
    priority: "P1",
    automation: "semi-auto",
    profile: "core",
    title: {
      en: "Hosting Infrastructure, Server Header & Origin",
      zh: "主机托管基础设施与 Web 服务器识别",
    },
    description: {
      en: "Identify resolved IPs, Web Server header, and hosting signals to assess origin stability and target-market latency.",
      zh: "识别解析 IP、Web 服务器响应头与托管特征，评估源站稳定性与目标市场延迟。",
    },
    remediation: {
      en: "Host near target markets or front the origin with a reliable global CDN.",
      zh: "面向目标市场采用就近机房或配置稳定的全球 CDN 加速。",
    },
  },
  {
    id: "01-T2",
    module: "01",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "CDN, WAF Protection & Edge Caching",
      zh: "CDN、WAF 防护与边缘缓存策略",
    },
    description: {
      en: "Detect CDN/WAF headers, edge cache hit signals, and potential bot-challenge interference.",
      zh: "核查 CDN/WAF 响应头、边缘缓存命中情况以及是否出现误拦爬虫的质询页。",
    },
    remediation: {
      en: "Enable edge caching for static assets and allow verified search/AI crawlers through WAF.",
      zh: "为静态资源开启边缘缓存，并确保 WAF 不误拦搜索引擎及目标 AI 爬虫。",
    },
  },
  {
    id: "01-T3",
    module: "01",
    priority: "P0",
    automation: "auto",
    profile: "core",
    title: {
      en: "SSL Certificate Issuer (CA) & Renewal Cycle",
      zh: "SSL 证书签发商（CA）与续期机制",
    },
    description: {
      en: "Inspect certificate issuer and validity window to spot manual/short-lived cert expiry risks.",
      zh: "记录证书颁发机构与签发周期，识别依赖人工替换导致的集中过期风险。",
    },
    remediation: {
      en: "Use automated ACME/CDN SSL renewal with expiration alerts.",
      zh: "启用平台/CDN 或 ACME 自动续期并配置到期告警。",
    },
  },
  {
    id: "01-T4",
    module: "01",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "CMS Platform, Backend Stack & Version Exposure",
      zh: "CMS 建站体系、后端语言与版本暴露检查",
    },
    description: {
      en: "Fingerprint CMS/platform and flag exposed backend versions (e.g., X-Powered-By or meta generator).",
      zh: "识别底层建站平台/CMS 与后端线索，排查是否暴露老旧具体版本号。",
    },
    remediation: {
      en: "Hide sensitive version headers (X-Powered-By, Server version) and document CMS SEO capabilities.",
      zh: "隐藏敏感后端版本号响应头，并梳理后台可修改的 SEO 权限边界。",
    },
  },
  {
    id: "01-T5",
    module: "01",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "Frontend Rendering Mode & Third-Party Scripts",
      zh: "前端渲染架构与第三方脚本盘点",
    },
    description: {
      en: "Detect SSR vs CSR-SPA indicators and inventory external third-party script domains.",
      zh: "识别服务端渲染/客户端渲染特征，并盘点外部统计、字体、客服等第三方脚本域名。",
    },
    remediation: {
      en: "Ensure critical content renders in initial HTML and remove slow or region-blocked third-party scripts.",
      zh: "确保核心内容在初始 HTML 中可抓取，移除在目标市场超时或无用的第三方脚本。",
    },
  },
  {
    id: "01-01",
    module: "01",
    priority: "P0",
    automation: "auto",
    profile: "core",
    title: {
      en: "SSL Certificate Validity & Expiry Threshold",
      zh: "SSL 证书有效性与过期预警",
    },
    description: {
      en: "Verify TLS handshake succeeds with a trusted, non-expired certificate (> 30 days remaining).",
      zh: "核查证书有效、信任链完整且剩余有效期 > 30 天。",
    },
    remediation: {
      en: "Renew or reissue the TLS certificate immediately and verify the full certificate chain.",
      zh: "立即更新或重签 SSL 证书，确保中间证书链完整。",
    },
  },
  {
    id: "01-02",
    module: "01",
    priority: "P0",
    automation: "auto",
    profile: "core",
    title: {
      en: "SSL Hostname & SAN Coverage (Apex + www)",
      zh: "证书域名与 SAN 覆盖（裸域与 www）",
    },
    description: {
      en: "Verify the TLS certificate SAN covers both apex and www hostnames without mismatch.",
      zh: "核查证书同时覆盖带 www 与不带 www 的主机名，无域名不匹配错误。",
    },
    remediation: {
      en: "Issue a certificate covering both the apex domain and www subdomain.",
      zh: "重新签发同时包含裸域与 www 的多域名或通配符证书。",
    },
  },
  {
    id: "01-03",
    module: "01",
    priority: "P0",
    automation: "auto",
    profile: "core",
    title: {
      en: "HTTPS Enforcement & Mixed Content",
      zh: "HTTPS 强制收敛与混合内容检查",
    },
    description: {
      en: "Ensure pages serve over HTTPS and contain no insecure HTTP scripts, stylesheets, iframes, or images.",
      zh: "核查全站通过 HTTPS 提供服务，无 HTTP 脚本/样式/图片等混合内容。",
    },
    remediation: {
      en: "Update all internal asset references to HTTPS or protocol-relative/root-relative paths.",
      zh: "将页面内所有 HTTP 资源引用改为 HTTPS 或相对路径。",
    },
  },
  {
    id: "01-04",
    module: "01",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "Security Headers & Basic Web Hygiene",
      zh: "安全响应头与基础安全卫生",
    },
    description: {
      en: "Check HSTS, X-Content-Type-Options, CSP/X-Frame-Options, rel=noopener on target=_blank links, and secret leaks.",
      zh: "核查 HSTS、X-Content-Type-Options、新窗口外链 rel=noopener 及源码敏感泄露。",
    },
    remediation: {
      en: "Add HSTS and X-Content-Type-Options: nosniff headers and add rel='noopener' to external target=_blank links.",
      zh: "配置 HSTS 与 nosniff 响应头，为新窗口外链补齐 rel='noopener'。",
    },
  },
  {
    id: "01-05",
    module: "01",
    priority: "P0",
    automation: "auto",
    profile: "core",
    title: {
      en: "Four-Entry Single-Hop 301 Consolidation",
      zh: "四入口单跳 301 收敛检查",
    },
    description: {
      en: "Test http/https × apex/www entries to verify 3 non-canonical entries 301-redirect in 1 hop to the single canonical HTTPS URL.",
      zh: "测试 http/https × 裸域/www 四个入口，确认 3 个非规范入口经 1 次 301 收敛至唯一规范 HTTPS 首页。",
    },
    remediation: {
      en: "Configure server/CDN rules so all non-canonical host/scheme variants 301-redirect in a single hop.",
      zh: "在服务器或 CDN 配置单跳 301 规则，统一收敛协议与 www 前缀。",
    },
  },
  {
    id: "01-06",
    module: "01",
    priority: "P0",
    automation: "auto",
    profile: "core",
    title: {
      en: "Core Pages HTTP Status & 5xx/Timeout Stability",
      zh: "核心页状态码与 5xx/超时稳定性",
    },
    description: {
      en: "Verify the homepage and crawled core pages consistently return HTTP 200 without 5xx or timeouts.",
      zh: "核查首页及核心页面稳定返回 HTTP 200，无 5xx 报错或连接超时。",
    },
    remediation: {
      en: "Investigate server error logs and stabilize upstream availability for all core URLs.",
      zh: "排查服务器错误日志与源站超时原因，确保核心页面稳定返回 200。",
    },
  },
  {
    id: "01-07",
    module: "01",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "Soft 404 Detection",
      zh: "Soft 404（假 200 失效页）检测",
    },
    description: {
      en: "Request a guaranteed non-existent URL and verify it returns HTTP 404/410 instead of HTTP 200 or redirecting to homepage.",
      zh: "请求随机不存在路径，确认真实返回 404/410，而非返回 200 或直接跳回首页。",
    },
    remediation: {
      en: "Return a genuine HTTP 404 or 410 status code for non-existent URLs.",
      zh: "对不存在的网址返回真实 HTTP 404 或 410 状态码。",
    },
  },
  {
    id: "01-08",
    module: "01",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "Sitemap & Internal Link Protocol Consistency",
      zh: "Sitemap 与站内链接协议一致性",
    },
    description: {
      en: "Check that XML Sitemap entries and internal links consistently point to the canonical HTTPS origin.",
      zh: "核查 XML Sitemap 与站内链接全部直指规范 HTTPS 域名，无混入 http:// 链接。",
    },
    remediation: {
      en: "Regenerate Sitemap and update internal links to use the canonical HTTPS host.",
      zh: "重新生成规范 HTTPS 的 Sitemap，并批量替换站内残留的 http:// 内链。",
    },
  },
  {
    id: "01-09",
    module: "01",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "Historical Domain & Migration Redirect Verification",
      zh: "历史域名与站点迁移跳转核对",
    },
    description: {
      en: "If historical domains are configured, verify they properly 301-redirect to the active canonical domain.",
      zh: "若配置了历史旧域名，核查其是否通过 301 正确跳转至当前正式域名。",
    },
    remediation: {
      en: "Map historical domains via 301 redirects to equivalent pages on the current canonical domain.",
      zh: "为仍归属企业的旧域名配置按页面/分类对应的 301 跳转。",
    },
  },
  {
    id: "01-10",
    module: "01",
    priority: "P0",
    automation: "manual",
    profile: "core",
    title: {
      en: "Target-Market Reachability Verification",
      zh: "目标市场海外可达性复现",
    },
    description: {
      en: "Verify reachability from target buyer regions (cannot be proven solely from a single local node).",
      zh: "验证从目标采购市场网络访问核心入口是否稳定（单靠本机节点无法替代目标地区实测）。",
    },
    remediation: {
      en: "Test from target-region vantage points (e.g., PageSpeed Insights, WebPageTest, or regional probes).",
      zh: "使用目标市场节点拨测或 PageSpeed Insights 海外抓取验证可达性。",
    },
  },
  {
    id: "01-11",
    module: "01",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "Primary Document TTFB",
      zh: "主文档首字节耗时（TTFB）",
    },
    description: {
      en: "Measure primary HTML TTFB from the current execution node (<= 800 ms pass, 800-1800 ms warn, > 1800 ms fail).",
      zh: "测量当前节点访问主文档的 TTFB（≤ 800 ms 通过，800–1800 ms 警告，> 1800 ms 失败）。",
    },
    remediation: {
      en: "Optimize backend response time, enable full-page/edge caching, and locate servers closer to buyers.",
      zh: "优化后端响应、启用页面/边缘缓存，并将节点靠近目标市场。",
    },
  },
  {
    id: "01-12",
    module: "01",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "HTTP Compression (Brotli / Gzip) & Protocol",
      zh: "文本传输压缩（Brotli / Gzip）与协议",
    },
    description: {
      en: "Check Content-Encoding (br/gzip) on HTML documents and server protocol capabilities.",
      zh: "核查 HTML 响应是否开启 Brotli 或 Gzip 压缩及传输协议支持情况。",
    },
    remediation: {
      en: "Enable Brotli or Gzip compression and HTTP/2+ on your web server or CDN.",
      zh: "在服务器或 CDN 开启 Brotli/Gzip 压缩并升级至 HTTP/2 以上协议。",
    },
  },
  {
    id: "01-13",
    module: "01",
    priority: "P2",
    automation: "auto",
    profile: "core",
    title: {
      en: "Cache-Control Headers & Asset Hygiene",
      zh: "浏览器缓存头与资源精简检查",
    },
    description: {
      en: "Check Cache-Control headers on sampled static assets and detect render-blocking script counts.",
      zh: "抽查静态资源 Cache-Control 缓存头配置及头部阻塞脚本数量。",
    },
    remediation: {
      en: "Configure long-lived Cache-Control for versioned static assets and defer non-critical scripts.",
      zh: "为带版本号的静态资源配置长缓存，并为非关键脚本增加 defer/async。",
    },
  },
  {
    id: "01-14",
    module: "01",
    priority: "P1",
    automation: "semi-auto",
    profile: "core",
    title: {
      en: "Initial HTML Content vs JS Rendering Dependency",
      zh: "初始 HTML 内容完整性与 JS 渲染依赖评估",
    },
    description: {
      en: "Inspect initial raw HTML for meaningful headings, body copy, and links to flag empty CSR shells.",
      zh: "检查初始 HTML 是否包含核心标题、正文与链接，识别纯客户端空壳页面。",
    },
    remediation: {
      en: "Render critical content server-side (SSR/SSG) and verify rendered DOM in a real mobile browser.",
      zh: "将核心内容改为服务端直出，并用真实手机浏览器对照渲染后 DOM。",
    },
  },
  {
    id: "01-15",
    module: "01",
    priority: "P1",
    automation: "manual",
    profile: "core",
    title: {
      en: "Core Web Vitals (LCP / INP / CLS)",
      zh: "Core Web Vitals 核心网页指标评估",
    },
    description: {
      en: "Evaluate field CrUX P75 or lab Lighthouse LCP, INP, and CLS metrics.",
      zh: "评估真实用户（CrUX/GSC）或实验室的 LCP、INP、CLS 达标情况。",
    },
    remediation: {
      en: "Run PageSpeed Insights / Lighthouse and check Search Console Core Web Vitals report.",
      zh: "通过 PageSpeed Insights 与 GSC 核心网页指标报告定位 LCP/INP/CLS 瓶颈。",
    },
  },
  {
    id: "01-16",
    module: "01",
    priority: "P1",
    automation: "semi-auto",
    profile: "core",
    title: {
      en: "Slow-Page Bottleneck Isolation & Retest",
      zh: "慢页根因定位与复测验证",
    },
    description: {
      en: "Flag pages with extreme server wait (> 3s) or multi-megabyte HTML/images for waterfall profiling.",
      zh: "标记严重慢页（主文档超慢或单页资源过大），提示进行瀑布流拆解与同条件复测。",
    },
    remediation: {
      en: "Profile slow pages with DevTools Network waterfall and retest under identical conditions after fixes.",
      zh: "用浏览器 Network 时间线拆解服务器等待、大图与脚本耗时，整改后同条件复测。",
    },
  },
  {
    id: "01-17",
    module: "01",
    priority: "P1",
    automation: "manual",
    profile: "core",
    title: {
      en: "Runtime JS Console Errors & Failed Subresources",
      zh: "JS 运行时报错与失败子资源检查",
    },
    description: {
      en: "Verify zero uncaught JS exceptions and failed CSS/JS/API requests during real browser rendering.",
      zh: "在真实浏览器渲染核心页面时核查 Console 未捕获报错与失败子资源。",
    },
    remediation: {
      en: "Run a headless Playwright/Chrome console check on key templates and fix broken scripts or CORS errors.",
      zh: "使用 Playwright 或浏览器控制台检查核心模板页，修复报错脚本与失效第三方插件。",
    },
  },

  // ======================== MODULE 02 (14) ========================
  {
    id: "02-01",
    module: "02",
    priority: "P0",
    automation: "auto",
    profile: "core",
    title: {
      en: "robots.txt Reachability & Directive Validity",
      zh: "robots.txt 可达性与规则正确性",
    },
    description: {
      en: "Verify /robots.txt returns HTTP 200, does not block entire site (Disallow: /), and declares a Sitemap.",
      zh: "核查 /robots.txt 返回 200、未误屏蔽整站且声明了规范 Sitemap 地址。",
    },
    remediation: {
      en: "Publish a valid /robots.txt allowing core pages and CSS/JS assets, and include the canonical Sitemap URL.",
      zh: "修复 /robots.txt，放行核心目录及渲染必需静态资源，并补充规范 Sitemap 声明。",
    },
  },
  {
    id: "02-02",
    module: "02",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "XML Sitemap Validity, Purity & Coverage",
      zh: "XML Sitemap 有效性、纯净度与覆盖率",
    },
    description: {
      en: "Parse XML Sitemap (including index files) and sample listed URLs for HTTP 200 canonical HTTPS cleanliness.",
      zh: "解析 XML Sitemap（含索引文件），抽样校验所列 URL 是否均为 200 规范 HTTPS 可索引页。",
    },
    remediation: {
      en: "Remove 4xx/3xx/noindex/non-canonical URLs from XML Sitemaps and ensure all core pages are included.",
      zh: "从 Sitemap 剔除 4xx/3xx/noindex 及非规范链接，确保主推分类和核心页完整覆盖。",
    },
  },
  {
    id: "02-03",
    module: "02",
    priority: "P2",
    automation: "auto",
    profile: "core",
    title: {
      en: "IndexNow Discovery Readiness (Optional)",
      zh: "IndexNow 辅助收录协议评估（可选项）",
    },
    description: {
      en: "Check whether IndexNow key signals or configuration are present (non-blocking optional check).",
      zh: "核查站点是否配置 IndexNow 推送支持（面向 Bing/Yandex 的可选加分项）。",
    },
    remediation: {
      en: "If supported by your CMS, enable IndexNow to accelerate indexing on Bing and Yandex.",
      zh: "若 CMS 支持，可开启 IndexNow 插件以加速 Bing 等搜索引擎收录。",
    },
  },
  {
    id: "02-04",
    module: "02",
    priority: "P0",
    automation: "auto",
    profile: "core",
    title: {
      en: "Meta Robots & X-Robots-Tag Directives",
      zh: "Meta Robots 与 X-Robots-Tag 索引指令核查",
    },
    description: {
      en: "Ensure indexable core pages are not accidentally blocked with noindex/none via HTML meta or HTTP header.",
      zh: "核查首页与核心可索引页面未误加 noindex / none 指令（含 HTML Meta 与 HTTP 响应头）。",
    },
    remediation: {
      en: "Remove unintended noindex directives from indexable landing pages.",
      zh: "移除核心着陆页上误配的 noindex 指令。",
    },
  },
  {
    id: "02-05",
    module: "02",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "Canonical Tag Completeness & Validity",
      zh: "Canonical 规范网址完整性与有效性",
    },
    description: {
      en: "Verify absolute HTTPS canonical tags exist, are unique per page, and do not point to broken/conflicting URLs.",
      zh: "核查核心页具备唯一、绝对路径 HTTPS 的规范网址，无相对路径或冲突指向。",
    },
    remediation: {
      en: "Output a single absolute HTTPS self-referencing rel='canonical' on every indexable page.",
      zh: "为每个可索引页面输出唯一且为绝对 HTTPS 路径的自引用 Canonical 标签。",
    },
  },
  {
    id: "02-06",
    module: "02",
    priority: "P1",
    automation: "semi-auto",
    profile: "core",
    title: {
      en: "Faceted Filter & Sort URL Indexation Control",
      zh: "筛选与排序参数 URL 收录边界控制",
    },
    description: {
      en: "Detect crawled URLs with sort/filter query parameters and check whether canonical or noindex controls are present.",
      zh: "排查抓取中出现的筛选/排序参数 URL，核查是否具备 Canonical 或 noindex 防止索引膨胀。",
    },
    remediation: {
      en: "Prevent sort/filter query combinations from entering Sitemaps and canonicalize or noindex low-value facets.",
      zh: "禁止纯排序/低价值筛选参数进入 Sitemap，并通过 Canonical 或 noindex 控制收录边界。",
    },
  },
  {
    id: "02-07",
    module: "02",
    priority: "P1",
    automation: "semi-auto",
    profile: "core",
    title: {
      en: "Pagination Crawlability & Canonical Handling",
      zh: "分页可发现性与规范网址处理",
    },
    description: {
      en: "Check discovered pagination links use standard <a href> and do not mistakenly canonicalize page 2+ back to page 1.",
      zh: "核查分页是否使用标准 <a href> 链接，且第 2 页及后续分页未错误 Canonical 回第 1 页。",
    },
    remediation: {
      en: "Use crawlable <a href> pagination links and self-referencing canonicals on each paginated page.",
      zh: "确保分页使用标准 <a href> 链接，且各分页自引用 Canonical。",
    },
  },
  {
    id: "02-08",
    module: "02",
    priority: "P2",
    automation: "semi-auto",
    profile: "b2b",
    title: {
      en: "Product Variant Duplication Control",
      zh: "同系列规格变体重复度控制",
    },
    description: {
      en: "Detect near-duplicate product/variant pages with almost identical titles and copy.",
      zh: "排查同系列不同规格/颜色变体是否产生大量文案几乎雷同的重复 URL。",
    },
    remediation: {
      en: "Consolidate trivial color/size variants onto a single page or differentiate unique specs and copy.",
      zh: "将无差异小变体合并展示或规范归并，独立成页的型号需补充差异化规格与文案。",
    },
  },
  {
    id: "02-09",
    module: "02",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "Multilingual & hreflang Validation",
      zh: "多语言与 hreflang 校验（适用多语站）",
    },
    description: {
      en: "Validate ISO language codes, self-referencing hreflang, and x-default on multilingual sites (Not Measured on monolingual sites).",
      zh: "核查多语站的 hreflang 语言代码规范、自引用与 x-default（纯单语站自动记为不适用）。",
    },
    remediation: {
      en: "Ensure valid ISO codes, bidirectional reciprocal hreflang links, x-default, and same-language canonicals.",
      zh: "补齐标准 ISO 语言代码、双向互指 hreflang、x-default，并确保各语种 Canonical 指向同语种自身。",
    },
  },
  {
    id: "02-10",
    module: "02",
    priority: "P2",
    automation: "auto",
    profile: "core",
    title: {
      en: "URL Structure Readability & Consistency",
      zh: "URL 结构可读性与一致性",
    },
    description: {
      en: "Check for uppercase characters, spaces, underscores, excessive depth, or session/tracking parameters in URLs.",
      zh: "核查 URL 是否统一小写、使用连字符、层级合理且不含多余追踪参数或乱码。",
    },
    remediation: {
      en: "Standardize lowercase hyphen-separated URLs and enforce consistent trailing-slash rules.",
      zh: "统一使用小写与连字符 URL，规范尾部斜杠并清理无意义参数。",
    },
  },
  {
    id: "02-11",
    module: "02",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "Navigation Hierarchy & Click Depth",
      zh: "导航层级与点击深度分布",
    },
    description: {
      en: "Compute BFS click depth from homepage across crawled pages (<= 3 hops pass, 4-5 warn, > 5 fail).",
      zh: "从首页按广度优先统计站内点击深度分布（核心页 ≤ 3 跳通过，4–5 跳警告，> 5 跳失败）。",
    },
    remediation: {
      en: "Flatten site architecture so core categories are <= 2 clicks and key detail pages <= 3 clicks from homepage.",
      zh: "扁平化站内导航层级，确保主推分类 ≤ 2 跳、核心详情页 ≤ 3 跳可达。",
    },
  },
  {
    id: "02-12",
    module: "02",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "Orphan Pages (Crawl vs Sitemap vs Known URLs)",
      zh: "孤立页排查（内链 / Sitemap / 业务清单三表比对）",
    },
    description: {
      en: "Cross-check crawled internal links against XML Sitemap and optional known URLs to identify orphan pages.",
      zh: "交叉比对内链抓取清单、Sitemap 与业务已知清单，找出缺乏站内进入链接的孤立页。",
    },
    remediation: {
      en: "Add contextual internal <a href> links from relevant category pages or guides to every valuable orphan page.",
      zh: "从相关分类页或采购指南页使用准确锚文本链接至有价值的孤立页。",
    },
  },
  {
    id: "02-13",
    module: "02",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "Internal Broken Links (4xx/5xx) & Redirect Chains",
      zh: "站内断链（4xx/5xx）与多跳内链排查",
    },
    description: {
      en: "Detect internal links pointing to 4xx/5xx errors or redirect chains and report source -> target pairs.",
      zh: "抽取指向 4xx/5xx 或跳转链的站内链接，输出“来源页 → 目标页”明细。",
    },
    remediation: {
      en: "Fix or remove broken internal links and update redirected links to point directly to final 200 URLs.",
      zh: "修复或移除站内死链，将指向旧跳转址的内链直接改为最终 200 规范地址。",
    },
  },
  {
    id: "02-14",
    module: "02",
    priority: "P2",
    automation: "auto",
    profile: "core",
    title: {
      en: "Breadcrumbs & Descriptive Internal Anchor Text",
      zh: "面包屑导航与内链锚文本质量",
    },
    description: {
      en: "Check for breadcrumb markup/navigation and flag excessive generic anchors ('click here', 'read more').",
      zh: "核查页面是否具备面包屑导航，并排查过多泛泛锚文本（如 Click here / View more）。",
    },
    remediation: {
      en: "Implement visible breadcrumbs with BreadcrumbList schema and use descriptive keyword-rich anchor text.",
      zh: "补齐可见面包屑与 BreadcrumbList 标记，将泛泛锚文本改为描述品类/规格的文字链接。",
    },
  },

  // ======================== MODULE 03 (17) ========================
  {
    id: "03-01",
    module: "03",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "Title Tag Uniqueness & Length",
      zh: "Title 标签唯一性与长度规范",
    },
    description: {
      en: "Check all crawled indexable pages for missing, duplicate, default ('Home'/'Untitled'), or overly long/short titles.",
      zh: "核查可索引页面的 Title 是否唯一、长度适中（约 30–60 字符），无缺失、重复或默认标题。",
    },
    remediation: {
      en: "Write unique, descriptive 50-60 character titles with primary keywords front-loaded for every page.",
      zh: "为每页撰写唯一、约 50–60 字符且核心词前置的 Title。",
    },
  },
  {
    id: "03-02",
    module: "03",
    priority: "P2",
    automation: "auto",
    profile: "core",
    title: {
      en: "Meta Description Presence, Uniqueness & Length",
      zh: "Meta Description 质量与唯一性",
    },
    description: {
      en: "Check meta descriptions for presence, uniqueness across pages, and optimal length (70-160 chars).",
      zh: "核查核心着陆页 Meta Description 是否唯一且长度合理（70–160 字符）。",
    },
    remediation: {
      en: "Craft unique 120-160 character meta descriptions highlighting concrete value propositions.",
      zh: "撰写唯一且突出卖点/规格的 120–160 字符 Meta Description。",
    },
  },
  {
    id: "03-03",
    module: "03",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "Heading Hierarchy (Single H1 & Logical H2-H3)",
      zh: "Heading 标题层级（唯一 H1 与逻辑嵌套）",
    },
    description: {
      en: "Verify each page has exactly one meaningful <h1> (not a site logo) and avoids heading level skips.",
      zh: "核查每页严格存在 1 个有效 <h1>（非全站 Logo 占用），且 H2/H3 嵌套合理无跳级。",
    },
    remediation: {
      en: "Use one unique H1 matching the main page topic and reserve H2-H3 for structured section hierarchy.",
      zh: "确保每页仅 1 个与主内容一致的 H1，并将 Logo 改为普通链接或 div。",
    },
  },
  {
    id: "03-04",
    module: "03",
    priority: "P1",
    automation: "manual",
    profile: "core",
    title: {
      en: "Mobile vs Desktop Content Parity",
      zh: "移动端与桌面端主内容等价性",
    },
    description: {
      en: "Compare rendered mobile and desktop DOMs to ensure specs, links, and schema are not stripped on mobile.",
      zh: "对照桌面与手机渲染 DOM，确认移动端未隐藏核心规格、正文、内链或结构化数据。",
    },
    remediation: {
      en: "Use responsive CSS rather than removing critical DOM content on mobile viewports.",
      zh: "在移动端完整保留规格参数、正文、面包屑与询盘按钮（可折叠但不可从 DOM 删除）。",
    },
  },
  {
    id: "03-05",
    module: "03",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "Mobile Viewport Meta Declaration",
      zh: "Viewport 声明与移动端基础适配",
    },
    description: {
      en: "Check that pages declare a valid responsive <meta name='viewport' content='width=device-width, initial-scale=1'>.",
      zh: "核查页面具备标准响应式 viewport meta 声明，无禁止缩放等不良配置。",
    },
    remediation: {
      en: "Add <meta name='viewport' content='width=device-width, initial-scale=1'> to the document <head>.",
      zh: "在 <head> 中添加标准 viewport 声明并确保手机端无横向溢出。",
    },
  },
  {
    id: "03-06",
    module: "03",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "Image File Size & Modern Formats (WebP/AVIF)",
      zh: "图片体积与现代格式（WebP/AVIF）",
    },
    description: {
      en: "Sample page images via HEAD/GET to check transfer size (<= 200 KB pass, > 500 KB fail) and WebP/AVIF usage.",
      zh: "抽样探测页面图片体积（≤ 200 KB 通过，> 500 KB 警告/失败）及现代格式使用情况。",
    },
    remediation: {
      en: "Compress oversized images, convert to WebP/AVIF, and serve responsive srcset sizes.",
      zh: "压缩超大原图，优先转换为 WebP/AVIF 并提供响应式 srcset 尺寸。",
    },
  },
  {
    id: "03-07",
    module: "03",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "Hero Image Lazy-Load & Explicit Dimensions (CLS)",
      zh: "首屏主图懒加载策略与显式宽高声明",
    },
    description: {
      en: "Check that the first hero image is not loading='lazy' and images declare explicit width/height.",
      zh: "核查首屏主图未被错误设置 loading='lazy'，且图片具备显式 width/height 防止版面抖动。",
    },
    remediation: {
      en: "Remove loading='lazy' from above-the-fold hero images and add explicit width and height attributes.",
      zh: "取消首屏主图的懒加载（可加 fetchpriority='high'），为图片补充显式宽高。",
    },
  },
  {
    id: "03-08",
    module: "03",
    priority: "P2",
    automation: "auto",
    profile: "core",
    title: {
      en: "Image Alt Text, Filenames & Broken Images",
      zh: "图片 alt 文本、可读文件名与破图检测",
    },
    description: {
      en: "Audit <img> tags for missing alt attributes, generic numeric filenames, and HTTP 4xx/5xx broken images.",
      zh: "扫描 <img> 标签的 alt 缺失率、无意义数字文件名及 404 破图情况。",
    },
    remediation: {
      en: "Write descriptive alt text for all meaningful images, use semantic filenames, and fix broken image URLs.",
      zh: "为核心产品与内容图补充准确 alt 描述、语义化文件名并修复破图。",
    },
  },
  {
    id: "03-09",
    module: "03",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "HTML Document Hygiene & <head> Integrity",
      zh: "HTML 基础规范与 <head> 完整性",
    },
    description: {
      en: "Verify <!DOCTYPE html>, <html lang='...'>, UTF-8 charset, and absence of stray body elements inside <head>.",
      zh: "核查标准 DOCTYPE、<html lang>、UTF-8 编码及 <head> 内无误置的 <body> 可见标签。",
    },
    remediation: {
      en: "Ensure valid HTML5 doctype, lang attribute, UTF-8 charset, and clean <head> markup.",
      zh: "补齐标准 HTML5 声明、lang 与 UTF-8 编码，清理 <head> 内的非法可见标签。",
    },
  },
  {
    id: "03-10",
    module: "03",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "Template Dirty Data Scan (Lorem / Localhost / Untranslated Text)",
      zh: "建站模板“脏数据”检测（占位词/本地链接/未译残留）",
    },
    description: {
      en: "Scan visible text and links for Lorem Ipsum placeholders, localhost/127.0.0.1 URLs, and untranslated CJK text on English pages.",
      zh: "扫描正文与链接中的 Lorem Ipsum 占位符、localhost 测试链接及英文页未翻译中文残留。",
    },
    remediation: {
      en: "Remove all placeholder copy, test/localhost links, and untranslated template strings.",
      zh: "清理所有占位英文、测试环境链接与未翻译的模板残留文案。",
    },
  },
  {
    id: "03-11",
    module: "03",
    priority: "P2",
    automation: "auto",
    profile: "core",
    title: {
      en: "Open Graph (OG) Tags & Share Image Validity",
      zh: "Open Graph（OG）基础与分享图规范",
    },
    description: {
      en: "Verify og:title, og:description, og:url, og:type, and an absolute HTTPS HTTP-200 og:image.",
      zh: "核查核心页具备完整 OG 字段，且 og:image 为可正常访问的绝对 HTTPS 图片链接。",
    },
    remediation: {
      en: "Add complete unique Open Graph metadata with a valid absolute HTTPS og:image (1200x630 recommended).",
      zh: "补全各核心页唯一的 OG 字段，并确保 og:image 为清晰可访问的 HTTPS 图片。",
    },
  },
  {
    id: "03-12",
    module: "03",
    priority: "P2",
    automation: "auto",
    profile: "core",
    title: {
      en: "Twitter / X Card Attributes",
      zh: "Twitter/X Card 分享卡片规范",
    },
    description: {
      en: "Check twitter:card, twitter:title, and twitter:image tags and proper name= attribute usage.",
      zh: "核查 twitter:card 等属性完整性及是否正确使用 name= 属性。",
    },
    remediation: {
      en: "Add standard <meta name='twitter:card' content='summary_large_image'> and matching title/image tags.",
      zh: "使用标准 name= 属性补充完整的 Twitter Card 字段。",
    },
  },
  {
    id: "03-13",
    module: "03",
    priority: "P1",
    automation: "auto",
    profile: "core",
    title: {
      en: "JSON-LD Structured Data Syntax Validity",
      zh: "JSON-LD 结构化数据语法有效性",
    },
    description: {
      en: "Extract and parse all <script type='application/ld+json'> blocks for valid JSON and @context/@type.",
      zh: "提取并解析全站 JSON-LD 块，校验 JSON 语法、@context 与 @type 完整性。",
    },
    remediation: {
      en: "Fix malformed JSON-LD blocks and validate with Schema Markup Validator and Rich Results Test.",
      zh: "修复 JSON-LD 语法错误，并通过 Google 富媒体测试与 Schema 校验工具复核。",
    },
  },
  {
    id: "03-14",
    module: "03",
    priority: "P2",
    automation: "semi-auto",
    profile: "b2b",
    title: {
      en: "Core Business / B2B Schema Coverage",
      zh: "核心业务 / B2B Schema 适配检查",
    },
    description: {
      en: "Check presence of Organization, BreadcrumbList, Product, or FAQPage schema without fabricated pricing/ratings.",
      zh: "核查 Organization、BreadcrumbList、Product、FAQPage 等核心 Schema 覆盖情况及字段合理性。",
    },
    remediation: {
      en: "Implement Organization, BreadcrumbList, and accurate Product schema aligned with visible page content.",
      zh: "按页面真实内容补齐 Organization、BreadcrumbList 与不虚构价格/评分的 Product Schema。",
    },
  },
  {
    id: "03-15",
    module: "03",
    priority: "P2",
    automation: "auto",
    profile: "core",
    title: {
      en: "Deprecated Schema Types & Multi-Format Conflicts",
      zh: "Schema 废弃类型与多格式冲突检查",
    },
    description: {
      en: "Flag deprecated schema types (e.g., HowTo) and simultaneous JSON-LD + Microdata/RDFa Product conflicts.",
      zh: "排查已废弃类型（如 HowTo）及同页 JSON-LD 与 Microdata 重复冲突问题。",
    },
    remediation: {
      en: "Remove deprecated schema types and consolidate duplicate Microdata/JSON-LD markup into clean JSON-LD.",
      zh: "移除废弃 Schema 类型，并清理模板自带的冲突 Microdata 标记。",
    },
  },
  {
    id: "03-16",
    module: "03",
    priority: "P2",
    automation: "semi-auto",
    profile: "core",
    title: {
      en: "Basic Accessibility (Form Labels & Button Semantics)",
      zh: "基础无障碍（表单语义与按钮可读性）",
    },
    description: {
      en: "Audit form inputs for labels/aria-labels/placeholders and buttons for accessible text.",
      zh: "检查表单输入框标签、按钮语义文本等基础无障碍 HTML 属性。",
    },
    remediation: {
      en: "Ensure every input has a visible <label> or aria-label and icon buttons include accessible text.",
      zh: "为所有表单输入框配齐 label 或 aria-label，避免无文字纯图标按钮。",
    },
  },
  {
    id: "03-17",
    module: "03",
    priority: "P2",
    automation: "auto",
    profile: "core",
    title: {
      en: "Privacy Policy & Cookie Notice Compliance",
      zh: "隐私政策与 Cookie 告知基础合规",
    },
    description: {
      en: "Check for a reachable Privacy Policy link and cookie-consent notice indicators when tracking scripts exist.",
      zh: "核查页脚是否存在可访问的 Privacy Policy，以及在部署追踪脚本时是否具备 Cookie 告知线索。",
    },
    remediation: {
      en: "Publish a clear Privacy Policy page and add a cookie consent banner when using analytics/ad trackers.",
      zh: "在页脚补充真实完整的隐私政策页，如使用 GA4/像素追踪则增加基础 Cookie 告知条。",
    },
  },

  // ======================== MODULE 04 (14) ========================
  {
    id: "04-01",
    module: "04",
    priority: "P2",
    automation: "manual",
    profile: "b2b",
    title: {
      en: "Core Buyer Search Intent Coverage",
      zh: "核心采购搜索意图覆盖度",
    },
    description: {
      en: "Verify landing pages cover supplier selection, specification selection, and process/comparison buyer intents.",
      zh: "核查主推品类是否分别承接供应商选择、规格选型与工艺对比三类核心采购搜索意图。",
    },
    remediation: {
      en: "Map top buyer queries per category against SERP page types and build missing category or guide pages.",
      zh: "按目标市场 SERP 偏好对照着陆页形态，补齐缺失的细分分类页或采购选型指南。",
    },
  },
  {
    id: "04-02",
    module: "04",
    priority: "P2",
    automation: "semi-auto",
    profile: "core",
    title: {
      en: "Homepage & Primary Category Positioning Alignment",
      zh: "首页与主推分类口径一致性",
    },
    description: {
      en: "Extract homepage title, H1, and top navigation labels to verify clear positioning and direct category links.",
      zh: "抽取首页 Title、H1 与主导航文案，核查站点定位是否清晰且可直达主推分类。",
    },
    remediation: {
      en: "Align homepage H1, meta title, and main navigation with your primary revenue categories.",
      zh: "统一首页标题、H1 与主导航口径，并确保分类页提供清晰的文字链接直达代表产品。",
    },
  },
  {
    id: "04-03",
    module: "04",
    priority: "P2",
    automation: "manual",
    profile: "compliance",
    title: {
      en: "Regulated / Sensitive Vertical Compliance Copy",
      zh: "合规/敏感垂直品类专项文案核查",
    },
    description: {
      en: "For regulated verticals, verify accurate compliance terminology and verifiable certification claims (N/A for standard sites).",
      zh: "针对受监管/合规垂直品类，核查合规检索词与认证承诺是否真实可核（普通站点自动记不适用）。",
    },
    remediation: {
      en: "Use accurate target-market compliance standards and substantiate every certification claim.",
      zh: "准确使用目标市场合规术语，确保所有认证与合规说明真实可验证。",
    },
  },
  {
    id: "04-04",
    module: "04",
    priority: "P2",
    automation: "semi-auto",
    profile: "core",
    title: {
      en: "Pillar + Cluster Topical Authority Architecture",
      zh: "Pillar + Cluster 主题集群布局",
    },
    description: {
      en: "Check for supporting guide/blog/resource sections and bidirectional internal linking with category/product pages.",
      zh: "检查是否具备指南/博客等支撑内容栏目，并与核心分类/产品页形成双向内链。",
    },
    remediation: {
      en: "Build buyer guides and FAQ clusters linked bidirectionally with your primary category pillars.",
      zh: "围绕核心品类建设选型指南与工艺科普集群，并与支柱分类页双向互链。",
    },
  },
  {
    id: "04-05",
    module: "04",
    priority: "P2",
    automation: "auto",
    profile: "core",
    title: {
      en: "Thin Content & Boilerplate Detection",
      zh: "薄内容（Thin Content）与模板套话初筛",
    },
    description: {
      en: "Measure visible word counts across crawled pages and flag thin pages (< 150 words) or high boilerplate similarity.",
      zh: "统计各页可见正文字数与页面相似度，识别字数极少（< 150 词）或高度雷同的薄页。",
    },
    remediation: {
      en: "Enrich thin pages with unique specifications, use cases, FAQs, or consolidate redundant pages.",
      zh: "为薄内容页补充独有规格、应用场景与常见问题，或合并无价值重复页。",
    },
  },
  {
    id: "04-06",
    module: "04",
    priority: "P1",
    automation: "semi-auto",
    profile: "b2b",
    title: {
      en: "Structured HTML Specification Tables (Anti-Image-Only Specs)",
      zh: "核心产品规格 HTML 文本/表格化（避免纯图参数）",
    },
    description: {
      en: "Check whether product/detail pages present structured HTML <table> or specification lists rather than image-only posters.",
      zh: "核查产品/详情页是否使用可抓取的 HTML <table> 或规格文本，避免将参数全做进海报长图。",
    },
    remediation: {
      en: "Convert image-only spec sheets into crawlable HTML tables covering dimensions, materials, MOQ, and customization.",
      zh: "将图片里的材质、尺寸、工艺、MOQ 与打样周期等核心参数改为清晰 HTML 表格或文本。",
    },
  },
  {
    id: "04-07",
    module: "04",
    priority: "P2",
    automation: "semi-auto",
    profile: "b2b",
    title: {
      en: "Company, Factory & Trust Pages Completeness (E-E-A-T)",
      zh: "工厂与资质信任页完备度（E-E-A-T）",
    },
    description: {
      en: "Discover key trust pages (About, Contact, FAQ, Quality/Factory/Certification) from site navigation and crawl.",
      zh: "从导航与站内抓取中盘点 About、Contact、FAQ、质检/工厂/资质等核心信任页覆盖情况。",
    },
    remediation: {
      en: "Publish dedicated, indexable About, Factory/Process, Quality/Certifications, Contact, and FAQ pages with real proof.",
      zh: "补齐独立可收录的 About、工厂产线、定制流程、质检资质、Contact 与 FAQ 信任页。",
    },
  },
  {
    id: "04-08",
    module: "04",
    priority: "P0",
    automation: "semi-auto",
    profile: "b2b",
    title: {
      en: "Inquiry / Contact Form & CTA Presence",
      zh: "询盘表单与转化入口闭环检查",
    },
    description: {
      en: "Detect inquiry forms, CTA buttons, and fallback contact methods (email/phone/WhatsApp); full mobile submission requires browser test.",
      zh: "检测站内询盘表单、转化按钮与备用联系方式（邮箱/电话/WhatsApp）；手机端提交体验需结合浏览器手测。",
    },
    remediation: {
      en: "Provide accessible inquiry forms with auto-filled product context plus visible email/WhatsApp fallbacks, verified on mobile.",
      zh: "确保核心页具备醒目询盘入口、简洁表单与备用联系方式，并在手机端实测提交流程。",
    },
  },
  {
    id: "04-09",
    module: "04",
    priority: "P2",
    automation: "auto",
    profile: "core",
    title: {
      en: "AI Crawler Access Policy (robots.txt)",
      zh: "AI 搜索爬虫访问策略核查",
    },
    description: {
      en: "Inspect robots.txt rules for major AI search/training crawlers (OAI-SearchBot, GPTBot, ClaudeBot, PerplexityBot, Google-Extended).",
      zh: "核查 robots.txt 对主流 AI 爬虫（OAI-SearchBot、GPTBot、ClaudeBot、PerplexityBot、Google-Extended）的放行或屏蔽规则。",
    },
    remediation: {
      en: "Define an explicit AI crawler policy in robots.txt so desired AI search bots are not unintentionally blocked.",
      zh: "在 robots.txt 中明确对 AI 检索爬虫与训练爬虫的策略，避免无意间屏蔽获客型 AI 搜索。",
    },
  },
  {
    id: "04-10",
    module: "04",
    priority: "P2",
    automation: "semi-auto",
    profile: "core",
    title: {
      en: "Passage Citability & Concise Q&A Blocks (GEO)",
      zh: "段落可引用性（Passage Citability）与问答块",
    },
    description: {
      en: "Check for question-style H2/H3 headings, concise direct-answer paragraphs, and structured tables/lists suitable for AI citation.",
      zh: "核查页面是否具备问句式 H2/H3 标题、精炼直答段落及对比表/列表，便于 AI 搜索引擎引用。",
    },
    remediation: {
      en: "Add question-led headings followed by crisp 40-60 word direct answers and comparison tables.",
      zh: "针对高频采购问题增加问句式标题 + 40–60 词首句直答块 + 规格对比表。",
    },
  },
  {
    id: "04-11",
    module: "04",
    priority: "P2",
    automation: "semi-auto",
    profile: "core",
    title: {
      en: "Brand & Organization Entity Consistency",
      zh: "品牌与公司实体表述一致性",
    },
    description: {
      en: "Compare organization names, emails, and contact entities across footer, About/Contact pages, and Organization Schema.",
      zh: "对照页脚、About/Contact 页与 Organization Schema 中的公司全称、品牌名与联系信息是否一致。",
    },
    remediation: {
      en: "Standardize your legal company name, brand name, address, and contact details across footer, About page, and Schema.",
      zh: "在全站页脚、About 页与结构化数据中统一公司英文全称、品牌名与官方联系方式。",
    },
  },
  {
    id: "04-12",
    module: "04",
    priority: "P2",
    automation: "auto",
    profile: "core",
    title: {
      en: "llms.txt & Semantic HTML Readability (Optional)",
      zh: "llms.txt 与语义 HTML 可读性评估（可选项）",
    },
    description: {
      en: "Check presence of /llms.txt and semantic landmark tags (<main>, <article>, <nav>, <table>).",
      zh: "核查根目录 /llms.txt 及 <main>、<article>、<table> 等语义化 HTML 结构。",
    },
    remediation: {
      en: "Use semantic HTML landmarks and optionally publish a concise /llms.txt index of key pages.",
      zh: "优化语义化 HTML 标签，条件允许时可在根目录提供简洁清晰的 /llms.txt。",
    },
  },
  {
    id: "04-13",
    module: "04",
    priority: "P2",
    automation: "manual",
    profile: "core",
    title: {
      en: "AI Search Visibility Baseline & Competitor Citations",
      zh: "AI 搜索可见度基线实测与竞品引用分析",
    },
    description: {
      en: "Track brand mentions and citations across AI Overviews, ChatGPT, and Perplexity for 10-20 high-intent queries.",
      zh: "按核心品类选取 10–20 个高意图问句，定期在主流 AI 搜索引擎抽测品牌提及与引用基线。",
    },
    remediation: {
      en: "Run a repeatable 10-20 query benchmark across AI search engines and log cited competitor pages.",
      zh: "建立 10–20 个高意图问句抽测表，记录提及率并拆解被引用竞品的内容优势。",
    },
  },
  {
    id: "04-14",
    module: "04",
    priority: "P2",
    automation: "auto",
    profile: "core",
    title: {
      en: "Analytics & Conversion Tracking Presence (GA4 / GTM)",
      zh: "流量统计与询盘转化追踪部署（GA4 / GTM）",
    },
    description: {
      en: "Detect GA4 (G-...), GTM (GTM-...), or legacy analytics tags and flag missing or duplicate redundant tags.",
      zh: "检测页面是否部署 GA4 / GTM 统计代码，排查完全缺失或重复冗余加载问题。",
    },
    remediation: {
      en: "Deploy a single clean GA4/GTM container and verify conversion events for form submissions and contact clicks.",
      zh: "部署单一规范的 GA4/GTM 容器，并在后台配置询盘提交与联系方式点击转化事件。",
    },
  },

  // ======================== MODULE 05 (9) ========================
  {
    id: "05-01",
    module: "05",
    priority: "P2",
    automation: "auto",
    profile: "matrix",
    title: {
      en: "Multi-Site Positioning & Keyword Cannibalization Risk",
      zh: "多站矩阵定位与关键词内耗风险",
    },
    description: {
      en: "When auditing multiple sites, compare homepage/category titles and top keywords for overlap.",
      zh: "当同时审计多个站点时，比对各站标题与核心品类词重合度，识别站群内耗风险。",
    },
    remediation: {
      en: "Differentiate target segments, primary keyword clusters, and copy across overlapping sites.",
      zh: "为重叠品类的独立站明确区分目标客群、主打词库与页面文案，避免互抢核心词。",
    },
  },
  {
    id: "05-02",
    module: "05",
    priority: "P1",
    automation: "auto",
    profile: "matrix",
    title: {
      en: "Cross-Site Template Cloning & Brand/Email Leakage",
      zh: "站群模板克隆与跨站域名/邮箱残留风险",
    },
    description: {
      en: "Check whether one site accidentally leaks another site's domain, email, or tracking ID, or clones body copy.",
      zh: "排查多站之间是否残留其他站点的域名、错误邮箱、错配统计 ID 或大段照搬文案。",
    },
    remediation: {
      en: "Replace all cloned footers, emails, links, and tracking IDs so each site has a clean independent footprint.",
      zh: "彻底替换共享模板中的页脚版权、联系邮箱、跨站残留链接与独立统计 ID。",
    },
  },
  {
    id: "05-03",
    module: "05",
    priority: "P2",
    automation: "semi-auto",
    profile: "b2b",
    title: {
      en: "Standalone Site vs B2B Marketplace Copy Duplication",
      zh: "独立站 vs 第三方 B2B 平台核心文案查重",
    },
    description: {
      en: "If external marketplace/comparison URLs are configured, compute text overlap against standalone site pages.",
      zh: "若配置了第三方平台对照链接，比对独立站与平台店铺文案重合度，防止被高权重平台压制。",
    },
    remediation: {
      en: "Rewrite core standalone product titles and descriptions with deeper buyer-oriented specifications.",
      zh: "对独立站主推分类与核心型号进行独立改写与选型深化，避免整段照搬平台文案。",
    },
  },
  {
    id: "05-04",
    module: "05",
    priority: "P2",
    automation: "manual",
    profile: "b2b",
    title: {
      en: "Cross-Channel Brand & Company Entity Alignment",
      zh: "跨渠道品牌与公司实体一致性",
    },
    description: {
      en: "Verify consistent English company names and active storefront URLs across standalone sites and B2B platforms.",
      zh: "核对独立站与 B2B 平台公开店铺的公司英文名、主营品类与店铺入口有效性。",
    },
    remediation: {
      en: "Unify company/brand naming across all official channels and fix broken marketplace links.",
      zh: "统一各渠道英文公司名与品牌口径，并修复失效的外部平台店铺入口。",
    },
  },
  {
    id: "05-05",
    module: "05",
    priority: "P2",
    automation: "manual",
    profile: "matrix",
    title: {
      en: "External Directory & Partner Catalog Attribution",
      zh: "外部补充目录与合作站点归属界定",
    },
    description: {
      en: "Verify ownership and linking boundaries for third-party or partner catalog domains.",
      zh: "核清外部补充目录/合作站点的归属关系，防止无序互链或混用企业主体信息。",
    },
    remediation: {
      en: "Document ownership of external catalogs and avoid unvetted sitewide cross-linking.",
      zh: "在资产台账明确外部目录归属，未核清前不与独立站大面积互链。",
    },
  },
  {
    id: "05-06",
    module: "05",
    priority: "P2",
    automation: "manual",
    profile: "core",
    title: {
      en: "Legacy Domain & Broken Backlink Reclamation",
      zh: "历史旧域与失效产品外部引链回收",
    },
    description: {
      en: "Identify external backlinks pointing to legacy domains or 404 product URLs for 301 reclamation.",
      zh: "排查外部网站仍指向旧域名或已下架 404 页面的引链资产并规划 301 回收。",
    },
    remediation: {
      en: "Export broken backlink targets from GSC/backlink tools and configure 301 redirects to equivalent pages.",
      zh: "结合 GSC 或外链工具导出失效引链目标，配置 301 跳转至等价新页面。",
    },
  },
  {
    id: "05-07",
    module: "05",
    priority: "P2",
    automation: "manual",
    profile: "core",
    title: {
      en: "Competitor Link-Worthy Asset Analysis",
      zh: "同市场竞品获链内容资产抽查",
    },
    description: {
      en: "Inspect top natural link-earning pages of target-market competitors to inform content asset strategy.",
      zh: "抽查同市场竞品获得自然外链的品类页或选型指南，提炼可借鉴的内容资产形态。",
    },
    remediation: {
      en: "Audit referring pages of competing guides/spec handbooks and build superior linkable resources.",
      zh: "实地核查竞品获链页面上下文，规划更具实用价值的行业手册或选型工具页。",
    },
  },
  {
    id: "05-08",
    module: "05",
    priority: "P2",
    automation: "semi-auto",
    profile: "core",
    title: {
      en: "Off-Page Brand Footprint & Social/Directory Signals",
      zh: "站外第三方共识与官方社交足迹",
    },
    description: {
      en: "Extract linked official social/external profiles (LinkedIn, YouTube, etc.) and sameAs Schema links.",
      zh: "抽取站点关联的官方外部渠道（LinkedIn、YouTube 等）及 Schema sameAs 声明，辅助验证站外共识。",
    },
    remediation: {
      en: "Maintain active, consistently named profiles on LinkedIn, YouTube, and industry directories linked via sameAs.",
      zh: "完善 LinkedIn、YouTube 等官方渠道的品牌实体描述，并在 Organization Schema 中通过 sameAs 关联。",
    },
  },
  {
    id: "05-09",
    module: "05",
    priority: "P1",
    automation: "semi-auto",
    profile: "core",
    title: {
      en: "Google Search Console (GSC) Index, Crawl & Quick-Wins Loop",
      zh: "GSC 真实数据闭环核验与 8–20 名快赢排查",
    },
    description: {
      en: "Ingest optional GSC JSON summary (indexed counts, crawl errors, striking-distance 8-20 queries, low-CTR pages); otherwise mark Not Measured.",
      zh: "支持导入可选 GSC 汇总数据（收录、抓取报错、8–20 名机会词与低点击页）；未接入权限时记为未测。",
    },
    remediation: {
      en: "Connect Google Search Console data to validate true indexation, Core Web Vitals, and striking-distance keywords.",
      zh: "接入 GSC 权限后核对真实收录、抓取统计、CWV 报告，并优先优化第 8–20 名高展示机会词。",
    },
  },
];

export const RULES_BY_ID: Map<string, RuleDefinition> = new Map(
  RULES.map((r) => [r.id, r])
);

export function getRulesByModule(moduleId: ModuleId): RuleDefinition[] {
  return RULES.filter((r) => r.module === moduleId);
}
