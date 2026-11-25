#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { diffAuditReports } from "./engine/diff.js";
import { buildAiDigest, runAudit, TOOL_VERSION } from "./engine/runner.js";
import { MODULE_NAMES, t } from "./i18n.js";
import { RULES, RULE_SET_VERSION } from "./rules/registry.js";
import { renderDiffMarkdown, renderMarkdownReport } from "./report/markdown.js";
import {
  DEFAULT_THRESHOLDS,
  DEFAULT_USER_AGENT,
  type AuditConfig,
  type AuditReport,
  type Language,
  type ModuleId,
  type ProfileId,
  type SiteConfig,
} from "./types.js";

const program = new Command();

program
  .name("seo-audit")
  .description(
    "Open-source bilingual (EN/ZH) deterministic SEO & GEO audit toolkit (80 rules across Modules 01-05)"
  )
  .version(TOOL_VERSION);

program
  .command("scan")
  .description("Run a deterministic SEO & GEO audit against one or more URLs or a config file")
  .argument("[urls...]", "Target website URL(s) to scan")
  .option("-c, --config <path>", "Path to JSON config file")
  .option("-m, --modules <list>", "Comma-separated modules (01,02,03,04,05)", "01,02,03,04,05")
  .option("-p, --profiles <list>", "Comma-separated profiles (core,b2b,matrix,compliance)", "core,b2b,matrix")
  .option("-l, --lang <lang>", "Report language: en | zh", "en")
  .option("--max-pages <n>", "Max HTML pages to crawl per site", "30")
  .option("--max-depth <n>", "Max BFS click depth per site", "3")
  .option("--delay <ms>", "Delay in ms between crawl requests", "100")
  .option("--timeout <ms>", "HTTP/TLS request timeout in ms", "12000")
  .option("--network <label>", "Label for execution network node", "local")
  .option("--no-external-lookups", "Skip external RDAP/Wayback lookups")
  .option("--ignore-robots", "Ignore robots.txt Disallow rules during crawl")
  .option("-o, --out <dir>", "Output directory for JSON, Markdown, and AI digest files", "./audit-output")
  .option("--compare <prevJson>", "Compare against a previous report.json and output diff.md")
  .action(async (urls: string[], opts) => {
    const lang: Language = opts.lang === "zh" ? "zh" : "en";
    let sites: SiteConfig[] = [];
    let fileCfg: Partial<AuditConfig> = {};

    if (opts.config) {
      const raw = JSON.parse(fs.readFileSync(opts.config, "utf8")) as Partial<AuditConfig>;
      fileCfg = raw;
      if (Array.isArray(raw.sites)) sites = raw.sites;
    }

    for (const u of urls) {
      sites.push({ url: u });
    }

    if (sites.length === 0) {
      console.error(
        lang === "zh"
          ? "错误：请提供至少一个目标网址或使用 --config 指定配置文件。"
          : "Error: Provide at least one target URL or pass --config <file>."
      );
      process.exit(1);
    }

    const modules = String(opts.modules)
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is ModuleId => ["01", "02", "03", "04", "05"].includes(s));

    const profiles = String(opts.profiles)
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is ProfileId =>
        ["core", "b2b", "matrix", "compliance"].includes(s)
      );

    const config: AuditConfig = {
      sites,
      modules: fileCfg.modules ?? (modules.length > 0 ? modules : ["01", "02", "03", "04", "05"]),
      profiles: fileCfg.profiles ?? (profiles.length > 0 ? profiles : ["core", "b2b", "matrix"]),
      lang,
      maxPages: Number(opts.maxPages) || fileCfg.maxPages || 30,
      maxDepth: Number(opts.maxDepth) || fileCfg.maxDepth || 3,
      concurrency: fileCfg.concurrency ?? 4,
      delayMs: Number(opts.delay) ?? fileCfg.delayMs ?? 100,
      timeoutMs: Number(opts.timeout) || fileCfg.timeoutMs || 12000,
      userAgent: fileCfg.userAgent ?? DEFAULT_USER_AGENT,
      respectRobots: !opts.ignoreRobots,
      skipExternalNetworkLookups: opts.externalLookups === false,
      networkLabel: opts.network ?? fileCfg.networkLabel ?? "local",
      thresholds: { ...DEFAULT_THRESHOLDS, ...(fileCfg.thresholds ?? {}) },
    };

    console.log(
      lang === "zh"
        ? `开始扫描 ${config.sites.length} 个站点（模块：${config.modules.join(",")}，语言：${lang}）...`
        : `Scanning ${config.sites.length} site(s) (modules: ${config.modules.join(",")}, lang: ${lang})...`
    );

    const report = await runAudit(config);

    fs.mkdirSync(opts.out, { recursive: true });
    const jsonPath = path.join(opts.out, "report.json");
    const mdPath = path.join(opts.out, `report.${lang}.md`);
    const digestPath = path.join(opts.out, "ai-digest.json");

    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
    fs.writeFileSync(mdPath, renderMarkdownReport(report, lang), "utf8");
    fs.writeFileSync(
      digestPath,
      JSON.stringify(buildAiDigest(report), null, 2),
      "utf8"
    );

    console.log(
      lang === "zh"
        ? `扫描完成！已输出：\n  - ${mdPath}\n  - ${jsonPath}\n  - ${digestPath}`
        : `Audit complete! Outputs written to:\n  - ${mdPath}\n  - ${jsonPath}\n  - ${digestPath}`
    );

    if (opts.compare) {
      const prev = JSON.parse(fs.readFileSync(opts.compare, "utf8")) as AuditReport;
      const diff = diffAuditReports(prev, report);
      const diffPath = path.join(opts.out, `diff.${lang}.md`);
      fs.writeFileSync(diffPath, renderDiffMarkdown(diff, lang), "utf8");
      console.log(`  - ${diffPath}`);
    }
  });

program
  .command("diff")
  .description("Compare two audit report.json files (before vs after)")
  .argument("<beforeJson>", "Path to baseline report.json")
  .argument("<afterJson>", "Path to retest report.json")
  .option("-l, --lang <lang>", "Report language: en | zh", "en")
  .option("-o, --out <file>", "Optional output Markdown file path")
  .action((beforePath: string, afterPath: string, opts) => {
    const lang: Language = opts.lang === "zh" ? "zh" : "en";
    const before = JSON.parse(fs.readFileSync(beforePath, "utf8")) as AuditReport;
    const after = JSON.parse(fs.readFileSync(afterPath, "utf8")) as AuditReport;
    const diff = diffAuditReports(before, after);
    const md = renderDiffMarkdown(diff, lang);
    if (opts.out) {
      fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
      fs.writeFileSync(opts.out, md, "utf8");
      console.log(`Diff report written to ${opts.out}`);
    } else {
      console.log(md);
    }
  });

program
  .command("rules")
  .description("List all 80 bilingual rules from the single-source-of-truth registry")
  .option("-l, --lang <lang>", "Output language: en | zh", "en")
  .option("-m, --module <id>", "Filter by module (01..05)")
  .option("--json", "Output raw JSON")
  .action((opts) => {
    const lang: Language = opts.lang === "zh" ? "zh" : "en";
    const list = opts.module
      ? RULES.filter((r) => r.module === opts.module)
      : RULES;
    if (opts.json) {
      console.log(JSON.stringify({ version: RULE_SET_VERSION, count: list.length, rules: list }, null, 2));
      return;
    }
    console.log(
      `# SEO Audit Toolkit Rules (v${RULE_SET_VERSION}, total: ${list.length})\n`
    );
    let currentMod = "";
    for (const r of list) {
      if (r.module !== currentMod) {
        currentMod = r.module;
        console.log(`\n## ${t(MODULE_NAMES[r.module], lang)}\n`);
      }
      console.log(
        `- **${r.id}** [${r.priority} | ${r.automation} | ${r.profile}] ${t(r.title, lang)}`
      );
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
