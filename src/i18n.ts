import type {
  EvidenceConfidence,
  Language,
  LocalizedText,
  ModuleId,
  Verdict,
} from "./types.js";

export function t(text: LocalizedText, lang: Language): string {
  return lang === "zh" ? text.zh : text.en;
}

export const MODULE_NAMES: Record<ModuleId, LocalizedText> = {
  "01": {
    en: "01 Domain, Tech Stack, Access, Security & Performance",
    zh: "01 域名、技术栈、准入、安全与性能",
  },
  "02": {
    en: "02 Crawling, Indexing & Site Architecture",
    zh: "02 抓取、索引控制与网站架构",
  },
  "03": {
    en: "03 On-Page, Media, HTML, Social, Schema & Compliance",
    zh: "03 On-Page、媒体、HTML、社交卡片、Schema 与合规",
  },
  "04": {
    en: "04 B2B Content, E-E-A-T, Conversion & GEO",
    zh: "04 B2B 内容、E-E-A-T、转化与 GEO 基础",
  },
  "05": {
    en: "05 Multi-Site Matrix, Off-Page & GSC Verification",
    zh: "05 多站矩阵、站外线索与 GSC 验证闭环",
  },
};

export const VERDICT_LABELS: Record<Verdict, LocalizedText> = {
  Pass: { en: "Pass", zh: "通过 (Pass)" },
  Warn: { en: "Warn", zh: "警告 (Warn)" },
  Fail: { en: "Fail", zh: "失败 (Fail)" },
  "Not Measured": { en: "Not Measured", zh: "未测/不适用 (Not Measured)" },
};

export const CONFIDENCE_LABELS: Record<EvidenceConfidence, LocalizedText> = {
  reproduced: { en: "Reproduced", zh: "已复现" },
  tool_signal: { en: "Tool Signal", zh: "仅工具提示" },
  needs_gsc: { en: "Needs GSC", zh: "需 GSC 验证" },
  insufficient_data: { en: "Insufficient Data", zh: "数据不足" },
};

export const REPORT_STRINGS = {
  title: {
    en: "SEO & GEO Deterministic Audit Report",
    zh: "SEO & GEO 标准化体检报告",
  },
  metadataHeading: {
    en: "Audit Environment & Scope",
    zh: "体检环境与范围说明",
  },
  networkDisclaimer: {
    en: "Note: Latency and reachability measurements reflect the local execution node only, not target-market user vantage points unless explicitly run from that region.",
    zh: "说明：响应耗时与可达性结果仅代表当前执行节点实测，未在目标市场节点拨测前，不等同于海外/目标地区真实访客体验。",
  },
  scorecardHeading: {
    en: "Module Scorecard",
    zh: "分模块计分卡",
  },
  scorecardNote: {
    en: "`Not Measured` items are strictly excluded from the pass-rate denominator: `Pass / (Pass + Warn + Fail)`.",
    zh: "`未测/不适用` 项绝不计入通过率分母，参考通过率公式为 `Pass / (Pass + Warn + Fail)`。",
  },
  p0BlockersHeading: {
    en: "P0 Blockers (Fix Immediately)",
    zh: "P0 阻断项（优先排障）",
  },
  noP0Blockers: {
    en: "No P0 blocking issues detected in automated checks.",
    zh: "本次自动检查未发现 P0 级阻断问题。",
  },
  findingsHeading: {
    en: "Detailed Rule Findings",
    zh: "全量检查项明细",
  },
  matrixHeading: {
    en: "Cross-Site Matrix & External Checks",
    zh: "跨站矩阵与外部协同检查",
  },
  diffTitle: {
    en: "SEO Audit Before / After Diff Report",
    zh: "SEO 复测前后对比报告",
  },
};
