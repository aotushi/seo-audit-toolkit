export type Language = "en" | "zh";

export type ModuleId = "01" | "02" | "03" | "04" | "05";

export type Priority = "P0" | "P1" | "P2";

export type Verdict = "Pass" | "Warn" | "Fail" | "Not Measured";

export type EvidenceConfidence =
  | "reproduced"
  | "tool_signal"
  | "needs_gsc"
  | "insufficient_data";

export type AutomationMode = "auto" | "semi-auto" | "manual";

export type ProfileId = "core" | "b2b" | "matrix" | "compliance";

export interface LocalizedText {
  en: string;
  zh: string;
}

export interface RuleDefinition {
  id: string;
  module: ModuleId;
  priority: Priority;
  automation: AutomationMode;
  profile: ProfileId;
  title: LocalizedText;
  description: LocalizedText;
  remediation: LocalizedText;
}

export interface CheckResult {
  ruleId: string;
  module: ModuleId;
  priority: Priority;
  status: Verdict;
  confidence: EvidenceConfidence;
  summary: LocalizedText;
  evidence: Record<string, unknown>;
  affectedUrls?: string[];
  denominator?: number;
  remediation?: LocalizedText;
  notMeasuredReason?: LocalizedText;
}

export interface SiteConfig {
  url: string;
  name?: string;
  expectedBrand?: string;
  language?: string;
  isMultilingual?: boolean;
  isComplianceVertical?: boolean;
  historicalDomains?: string[];
  knownUrls?: string[];
  externalComparisonUrls?: string[];
  gscSummaryFile?: string;
}

export interface AuditThresholds {
  sslWarnDays: number;
  domainWarnDays: number;
  ttfbPassMs: number;
  ttfbWarnMs: number;
  titleMinLen: number;
  titleMaxLen: number;
  titleWarnMaxLen: number;
  descMinLen: number;
  descMaxLen: number;
  imagePassKb: number;
  imageWarnKb: number;
  thinContentWords: number;
  maxClickDepthPass: number;
  maxClickDepthWarn: number;
}

export interface AuditConfig {
  sites: SiteConfig[];
  modules: ModuleId[];
  profiles: ProfileId[];
  lang: Language;
  maxPages: number;
  maxDepth: number;
  concurrency: number;
  delayMs: number;
  timeoutMs: number;
  userAgent: string;
  respectRobots: boolean;
  skipExternalNetworkLookups?: boolean;
  networkLabel?: string;
  thresholds: AuditThresholds;
}

export interface ModuleScorecard {
  module: ModuleId;
  totalRules: number;
  pass: number;
  warn: number;
  fail: number;
  notMeasured: number;
  p0Failures: number;
  passRate: number | null; // Pass / (Pass + Warn + Fail), null when denominator is 0
}

export interface SiteAuditReport {
  site: SiteConfig;
  canonicalOrigin: string;
  crawledPages: number;
  sitemapUrlsCount: number;
  results: CheckResult[];
  scorecard: ModuleScorecard[];
  totals: Omit<ModuleScorecard, "module">;
}

export interface AuditMetadata {
  toolName: string;
  toolVersion: string;
  ruleSetVersion: string;
  generatedAt: string;
  networkLabel: string;
  modulesRun: ModuleId[];
  profilesEnabled: ProfileId[];
  maxPages: number;
  maxDepth: number;
  lang: Language;
}

export interface AuditReport {
  metadata: AuditMetadata;
  sites: SiteAuditReport[];
  matrixResults: CheckResult[];
}

export interface RuleDiffItem {
  siteUrl: string;
  ruleId: string;
  module: ModuleId;
  priority: Priority;
  before: Verdict;
  after: Verdict;
  change: "improved" | "regressed" | "changed" | "unchanged";
  beforeSummary: LocalizedText;
  afterSummary: LocalizedText;
}

export interface AuditDiffReport {
  beforeTimestamp: string;
  afterTimestamp: string;
  improved: RuleDiffItem[];
  regressed: RuleDiffItem[];
  otherChanges: RuleDiffItem[];
  unchangedCount: number;
}

export const DEFAULT_THRESHOLDS: AuditThresholds = {
  sslWarnDays: 30,
  domainWarnDays: 60,
  ttfbPassMs: 800,
  ttfbWarnMs: 1800,
  titleMinLen: 30,
  titleMaxLen: 60,
  titleWarnMaxLen: 65,
  descMinLen: 70,
  descMaxLen: 160,
  imagePassKb: 200,
  imageWarnKb: 500,
  thinContentWords: 150,
  maxClickDepthPass: 3,
  maxClickDepthWarn: 5,
};

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; SEOAuditToolkit/1.0; +https://github.com/seo-audit-toolkit)";
