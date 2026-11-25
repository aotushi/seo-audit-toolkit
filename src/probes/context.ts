import { RULES_BY_ID } from "../rules/registry.js";
import type {
  AuditConfig,
  CheckResult,
  EvidenceConfidence,
  LocalizedText,
  SiteConfig,
  Verdict,
} from "../types.js";
import type { HttpResponse } from "../utils/http.js";
import type { ParsedPage } from "../utils/html.js";

export interface RobotsInfo {
  url: string;
  statusCode: number;
  body: string;
  sitemaps: string[];
  disallowsAll: boolean;
  rulesByAgent: Record<string, { allow: string[]; disallow: string[] }>;
}

export interface SiteCrawlContext {
  site: SiteConfig;
  config: AuditConfig;
  startUrl: URL;
  canonicalOrigin: string;
  homepageResponse?: HttpResponse;
  homepage?: ParsedPage;
  robots?: RobotsInfo;
  sitemapUrls: string[];
  sitemapErrors: string[];
  crawledPages: Map<string, ParsedPage>;
  clickDepth: Map<string, number>;
  brokenInternalLinks: Array<{
    source: string;
    target: string;
    statusCode: number;
    error?: string;
  }>;
  redirectInternalLinks: Array<{
    source: string;
    target: string;
    hops: number;
    finalUrl: string;
  }>;
}

export function makeResult(
  ruleId: string,
  status: Verdict,
  confidence: EvidenceConfidence,
  summary: LocalizedText,
  evidence: Record<string, unknown> = {},
  extra: {
    affectedUrls?: string[];
    denominator?: number;
    notMeasuredReason?: LocalizedText;
  } = {}
): CheckResult {
  const rule = RULES_BY_ID.get(ruleId);
  if (!rule) {
    throw new Error(`Unknown ruleId: ${ruleId}`);
  }
  return {
    ruleId,
    module: rule.module,
    priority: rule.priority,
    status,
    confidence,
    summary,
    evidence,
    affectedUrls: extra.affectedUrls,
    denominator: extra.denominator,
    remediation: status === "Pass" || status === "Not Measured" ? undefined : rule.remediation,
    notMeasuredReason: extra.notMeasuredReason,
  };
}

export function notMeasured(
  ruleId: string,
  reason: LocalizedText,
  confidence: EvidenceConfidence = "insufficient_data",
  evidence: Record<string, unknown> = {}
): CheckResult {
  return makeResult(ruleId, "Not Measured", confidence, reason, evidence, {
    notMeasuredReason: reason,
  });
}

export function isProfileEnabled(
  ruleId: string,
  config: AuditConfig
): boolean {
  const rule = RULES_BY_ID.get(ruleId);
  if (!rule) return false;
  return config.profiles.includes(rule.profile);
}
