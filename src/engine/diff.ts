import type {
  AuditDiffReport,
  AuditReport,
  RuleDiffItem,
  Verdict,
} from "../types.js";

const VERDICT_RANK: Record<Verdict, number> = {
  Fail: 0,
  Warn: 1,
  Pass: 2,
  "Not Measured": -1,
};

export function diffAuditReports(
  before: AuditReport,
  after: AuditReport
): AuditDiffReport {
  const improved: RuleDiffItem[] = [];
  const regressed: RuleDiffItem[] = [];
  const otherChanges: RuleDiffItem[] = [];
  let unchangedCount = 0;

  const beforeMap = new Map<
    string,
    Map<string, AuditReport["sites"][number]["results"][number]>
  >();
  for (const s of before.sites) {
    const m = new Map<string, AuditReport["sites"][number]["results"][number]>();
    for (const r of s.results) {
      m.set(r.ruleId, r);
    }
    beforeMap.set(s.canonicalOrigin, m);
  }

  for (const afterSite of after.sites) {
    const prevSiteMap = beforeMap.get(afterSite.canonicalOrigin);
    if (!prevSiteMap) continue;

    for (const r of afterSite.results) {
      const prev = prevSiteMap.get(r.ruleId);
      if (!prev) continue;

      if (prev.status === r.status) {
        unchangedCount++;
        continue;
      }

      const prevRank = VERDICT_RANK[prev.status];
      const afterRank = VERDICT_RANK[r.status];
      let change: RuleDiffItem["change"] = "changed";
      if (prevRank >= 0 && afterRank >= 0) {
        change = afterRank > prevRank ? "improved" : "regressed";
      }

      const item: RuleDiffItem = {
        siteUrl: afterSite.canonicalOrigin,
        ruleId: r.ruleId,
        module: r.module,
        priority: r.priority,
        before: prev.status,
        after: r.status,
        change,
        beforeSummary: prev.summary,
        afterSummary: r.summary,
      };

      if (change === "improved") improved.push(item);
      else if (change === "regressed") regressed.push(item);
      else otherChanges.push(item);
    }
  }

  return {
    beforeTimestamp: before.metadata.generatedAt,
    afterTimestamp: after.metadata.generatedAt,
    improved,
    regressed,
    otherChanges,
    unchangedCount,
  };
}
