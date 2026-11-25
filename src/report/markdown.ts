import {
  CONFIDENCE_LABELS,
  MODULE_NAMES,
  REPORT_STRINGS,
  t,
  VERDICT_LABELS,
} from "../i18n.js";
import { RULES_BY_ID } from "../rules/registry.js";
import type { AuditDiffReport, AuditReport, Language } from "../types.js";

function esc(val: string): string {
  return val.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function renderMarkdownReport(
  report: AuditReport,
  lang: Language = report.metadata.lang
): string {
  const lines: string[] = [];
  const meta = report.metadata;

  lines.push(`# ${t(REPORT_STRINGS.title, lang)}`);
  lines.push("");
  lines.push(`## ${t(REPORT_STRINGS.metadataHeading, lang)}`);
  lines.push("");
  lines.push(`- **Tool / Version**: \`${meta.toolName} v${meta.toolVersion}\` (Rules \`v${meta.ruleSetVersion}\`)`);
  lines.push(`- **Generated At**: \`${meta.generatedAt}\``);
  lines.push(`- **Execution Node**: \`${meta.networkLabel}\``);
  lines.push(`- **Modules**: \`${meta.modulesRun.join(", ")}\``);
  lines.push(`- **Profiles**: \`${meta.profilesEnabled.join(", ")}\``);
  lines.push(`- **Crawl Limits**: maxPages=\`${meta.maxPages}\`, maxDepth=\`${meta.maxDepth}\``);
  lines.push("");
  lines.push(`> ${t(REPORT_STRINGS.networkDisclaimer, lang)}`);
  lines.push("");

  for (const siteReport of report.sites) {
    lines.push(`---`);
    lines.push("");
    lines.push(
      `## ${siteReport.site.name ? `${siteReport.site.name} (` : ""}${siteReport.canonicalOrigin}${siteReport.site.name ? ")" : ""}`
    );
    lines.push("");
    lines.push(
      lang === "zh"
        ? `- 已抓取页面数：**${siteReport.crawledPages}** · XML Sitemap 链接数：**${siteReport.sitemapUrlsCount}**`
        : `- Crawled Pages: **${siteReport.crawledPages}** · XML Sitemap URLs: **${siteReport.sitemapUrlsCount}**`
    );
    lines.push("");

    // Scorecard
    lines.push(`### ${t(REPORT_STRINGS.scorecardHeading, lang)}`);
    lines.push("");
    lines.push(`> ${t(REPORT_STRINGS.scorecardNote, lang)}`);
    lines.push("");
    if (lang === "zh") {
      lines.push("| 审查模块 | 项数 | Pass | Warn | Fail | Not Measured | P0 阻断 | 已测通过率 |");
    } else {
      lines.push("| Module | Rules | Pass | Warn | Fail | Not Measured | P0 Blockers | Pass Rate |");
    }
    lines.push("| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |");
    for (const sc of siteReport.scorecard) {
      const rate = sc.passRate === null ? "N/A" : `${sc.passRate}%`;
      lines.push(
        `| ${t(MODULE_NAMES[sc.module], lang)} | ${sc.totalRules} | ${sc.pass} | ${sc.warn} | ${sc.fail} | ${sc.notMeasured} | ${sc.p0Failures} | ${rate} |`
      );
    }
    const tot = siteReport.totals;
    const totRate = tot.passRate === null ? "N/A" : `${tot.passRate}%`;
    lines.push(
      `| **${lang === "zh" ? "合计" : "Total"}** | **${tot.totalRules}** | **${tot.pass}** | **${tot.warn}** | **${tot.fail}** | **${tot.notMeasured}** | **${tot.p0Failures}** | **${totRate}** |`
    );
    lines.push("");

    // P0 Blockers
    const p0s = siteReport.results.filter(
      (r) => r.priority === "P0" && r.status === "Fail"
    );
    lines.push(`### ${t(REPORT_STRINGS.p0BlockersHeading, lang)}`);
    lines.push("");
    if (p0s.length === 0) {
      lines.push(t(REPORT_STRINGS.noP0Blockers, lang));
    } else {
      for (const r of p0s) {
        const rule = RULES_BY_ID.get(r.ruleId);
        lines.push(
          `- **${r.ruleId} ${rule ? t(rule.title, lang) : ""}**: ${t(r.summary, lang)}${r.remediation ? ` — *${t(r.remediation, lang)}*` : ""}`
        );
      }
    }
    lines.push("");

    // Detailed table
    lines.push(`### ${t(REPORT_STRINGS.findingsHeading, lang)}`);
    lines.push("");
    if (lang === "zh") {
      lines.push("| 编号 | 级别 | 检查项 | 状态 | 证据可信度 | 实测摘要 | 建议动作 |");
    } else {
      lines.push("| Rule | Priority | Check | Status | Confidence | Summary | Remediation |");
    }
    lines.push("| --- | :---: | --- | :---: | :---: | --- | --- |");
    for (const r of siteReport.results) {
      const rule = RULES_BY_ID.get(r.ruleId);
      const title = rule ? t(rule.title, lang) : r.ruleId;
      const rem = r.remediation ? t(r.remediation, lang) : "-";
      lines.push(
        `| **${r.ruleId}** | ${r.priority} | ${esc(title)} | ${t(VERDICT_LABELS[r.status], lang)} | ${t(CONFIDENCE_LABELS[r.confidence], lang)} | ${esc(t(r.summary, lang))} | ${esc(rem)} |`
      );
    }
    lines.push("");
  }

  if (report.matrixResults.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push(`## ${t(REPORT_STRINGS.matrixHeading, lang)}`);
    lines.push("");
    for (const m of report.matrixResults) {
      lines.push(
        `- **${m.ruleId} (${m.status})**: ${t(m.summary, lang)}`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function renderDiffMarkdown(
  diff: AuditDiffReport,
  lang: Language = "en"
): string {
  const lines: string[] = [];
  lines.push(`# ${t(REPORT_STRINGS.diffTitle, lang)}`);
  lines.push("");
  lines.push(`- **Before**: \`${diff.beforeTimestamp}\``);
  lines.push(`- **After**: \`${diff.afterTimestamp}\``);
  lines.push(
    lang === "zh"
      ? `- 改善项：**${diff.improved.length}** · 退化项：**${diff.regressed.length}** · 其他变更：**${diff.otherChanges.length}** · 未变化：**${diff.unchangedCount}**`
      : `- Improved: **${diff.improved.length}** · Regressed: **${diff.regressed.length}** · Other changes: **${diff.otherChanges.length}** · Unchanged: **${diff.unchangedCount}**`
  );
  lines.push("");

  const renderSection = (heading: string, items: AuditDiffReport["improved"]) => {
    lines.push(`## ${heading}`);
    lines.push("");
    if (items.length === 0) {
      lines.push(lang === "zh" ? "_无_" : "_None_");
      lines.push("");
      return;
    }
    lines.push(
      lang === "zh"
        ? "| 站点 | 规则 | 级别 | 整改前 | 整改后 | 最新摘要 |"
        : "| Site | Rule | Priority | Before | After | Latest Summary |"
    );
    lines.push("| --- | --- | :---: | :---: | :---: | --- |");
    for (const i of items) {
      lines.push(
        `| ${esc(i.siteUrl)} | **${i.ruleId}** | ${i.priority} | ${i.before} | ${i.after} | ${esc(t(i.afterSummary, lang))} |`
      );
    }
    lines.push("");
  };

  renderSection(lang === "zh" ? "已改善项 (Improved)" : "Improved", diff.improved);
  renderSection(lang === "zh" ? "已退化项 (Regressed)" : "Regressed", diff.regressed);
  if (diff.otherChanges.length > 0) {
    renderSection(lang === "zh" ? "状态变化（含未测切换）" : "Other Status Changes", diff.otherChanges);
  }

  return lines.join("\n");
}
