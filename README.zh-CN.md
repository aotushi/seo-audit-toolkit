# SEO Audit Toolkit（通用中英文 SEO & GEO 体检工具）

[English](README.md) | [简体中文](README.zh-CN.md)

一套开源、跨平台、支持**中英文双语**的确定性 **SEO & GEO 标准化检查工具**，内置 **01–05 五大模块、共 80 项统一规则**。

核心设计理念：**“绝不拿大模型当爬虫”**
- **0 Token 确定性采集**：协议、证书、状态码、Sitemap、孤立页、断链、TDK、图片、脏数据、JSON-LD 等确定性规则全部由本地程序直接完成，不把原始网页喂给大模型。
- **严格四态判定**：每条规则输出 `Pass / Warn / Fail / Not Measured`，绝不把未测、受限或需要 GSC 权限的项目伪装成通过；计分卡自动将 `Not Measured` 剔除出分母。
- **一键输出多形态交付物**：中文/英文 Markdown 体检报告（含分模块计分卡与 P0 阻断清单）、完整原始 JSON、供 AI 复核的精简摘要 `ai-digest.json`，以及整改前后自动对比报告（`diff`）。

## 五大模块全覆盖（80 项规则）

- **模块 01（26 项）**：域名生命周期（RDAP）、DNS/邮件解析（MX/SPF/DMARC）、历史快照、TLS 证书与 SAN 覆盖、四入口单跳 301 收敛、Soft 404、安全头、压缩、TTFB、CMS/技术栈指纹。
- **模块 02（14 项）**：`robots.txt`、XML Sitemap 解析与抽样纯净度、Meta Robots / `X-Robots-Tag`、Canonical 规范网址、筛选与分页、多语言 `hreflang`、URL 规范、BFS 点击深度、内链/Sitemap/业务清单三表比对找孤立页、站内断链与面包屑。
- **模块 03（17 项）**：Title/Description 唯一性与长度、H1–H3 层级、Viewport、图片体积/WebP/懒加载/`alt`/破图、HTML `<head>` 完整性、建站模板脏数据扫描（Lorem Ipsum、`localhost`、英文页中文残留）、OG 与 Twitter 卡片、JSON-LD 语法与 Microdata 冲突、基础表单无障碍、隐私政策与 Cookie 合规。
- **模块 04（14 项）**：采购意图摘要、首页定位一致性、主题集群、薄内容字数初筛、B2B HTML 规格表、工厂/资质信任页、询盘表单与 CTA、AI 爬虫策略（`GPTBot`/`OAI-SearchBot`/`ClaudeBot`/`PerplexityBot`）、问句直答块、`/llms.txt` 与语义 HTML、GA4/GTM 统计代码。
- **模块 05（9 项）**：多站矩阵标题重合度（防内耗）、跨站模板克隆与域名/邮箱/统计 ID 泄漏、外部平台对照链接文案查重、官方社交与 `sameAs` 足迹、可选 GSC 汇总数据导入闭环。

## 快速开始

环境要求：**Node.js >= 20**（无需 Python 虚拟环境，Windows / macOS / Linux 通用）。

```bash
npm install
npm run build

# 扫描单个站点（输出中文报告）
node dist/src/cli.js scan https://example.com --lang zh --out ./reports/example

# 扫描单个站点（输出英文报告）
node dist/src/cli.js scan https://example.com --lang en --out ./reports/example

# 使用配置文件批量扫描多站矩阵
node dist/src/cli.js scan --config config.example.json --lang zh --out ./reports/matrix

# 整改前后自动复测对比
node dist/src/cli.js diff ./reports/before/report.json ./reports/after/report.json --lang zh

# 导出全部 80 条中文规则清单
node dist/src/cli.js rules --lang zh
```

## 低 Token AI 协作模式

工具在每次扫描后会自动生成仅几 KB 大小的 `ai-digest.json`，可直接发给任意 AI 助手完成主观内容、E-E-A-T 与整改排期研判。详见 [docs/ai-workflow.zh-CN.md](docs/ai-workflow.zh-CN.md)。

## 合规与免责声明

本工具仅执行**非侵入式、只读公开探查**。请仅对您拥有所有权或已获得明确授权的网站运行扫描，并合理设置抓取上限与请求间隔（`--max-pages`、`--delay`）。

## 开源协议

MIT
