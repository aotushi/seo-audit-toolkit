import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";

export interface HttpHop {
  url: string;
  statusCode: number;
  location?: string;
  ttfbMs: number;
  headers: Record<string, string>;
}

export interface HttpResponse {
  url: string;
  finalUrl: string;
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  byteLength: number;
  ttfbMs: number;
  totalMs: number;
  contentEncoding: string;
  hops: HttpHop[];
  error?: string;
}

export interface RequestOptions {
  method?: "GET" | "HEAD";
  timeoutMs?: number;
  maxRedirects?: number;
  userAgent?: string;
  rejectUnauthorized?: boolean;
  maxBodyBytes?: number;
}

function normalizeHeaders(
  raw: http.IncomingHttpHeaders
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : String(v);
  }
  return out;
}

function decompressBuffer(buf: Buffer, encoding: string): Buffer {
  const enc = encoding.toLowerCase().trim();
  try {
    if (enc.includes("br")) return zlib.brotliDecompressSync(buf);
    if (enc.includes("gzip")) return zlib.gunzipSync(buf);
    if (enc.includes("deflate")) return zlib.inflateSync(buf);
  } catch {
    return buf;
  }
  return buf;
}

function singleRequest(
  targetUrl: string,
  opts: RequestOptions
): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  byteLength: number;
  ttfbMs: number;
  totalMs: number;
  contentEncoding: string;
}> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const isHttps = parsed.protocol === "https:";
    const mod = isHttps ? https : http;
    const method = opts.method ?? "GET";
    const timeoutMs = opts.timeoutMs ?? 12000;
    const maxBodyBytes = opts.maxBodyBytes ?? 2 * 1024 * 1024;
    const started = Date.now();

    const req = mod.request(
      parsed,
      {
        method,
        timeout: timeoutMs,
        rejectUnauthorized: opts.rejectUnauthorized ?? true,
        headers: {
          "User-Agent":
            opts.userAgent ??
            "Mozilla/5.0 (compatible; SEOAuditToolkit/1.0)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Encoding": "br, gzip, deflate",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
      (res) => {
        const ttfbMs = Date.now() - started;
        const headers = normalizeHeaders(res.headers);
        const contentEncoding = headers["content-encoding"] ?? "";
        const chunks: Buffer[] = [];
        let received = 0;

        res.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received <= maxBodyBytes) {
            chunks.push(chunk);
          }
        });

        res.on("end", () => {
          const rawBuf = Buffer.concat(chunks);
          const decoded =
            method === "HEAD"
              ? Buffer.alloc(0)
              : decompressBuffer(rawBuf, contentEncoding);
          resolve({
            statusCode: res.statusCode ?? 0,
            headers,
            body: decoded.toString("utf8"),
            byteLength: rawBuf.length,
            ttfbMs,
            totalMs: Date.now() - started,
            contentEncoding,
          });
        });

        res.on("error", reject);
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Request timeout after ${timeoutMs}ms`));
    });
    req.on("error", reject);
    req.end();
  });
}

export async function fetchWithTrace(
  targetUrl: string,
  opts: RequestOptions = {}
): Promise<HttpResponse> {
  const maxRedirects = opts.maxRedirects ?? 8;
  const hops: HttpHop[] = [];
  let currentUrl = targetUrl;
  const visited = new Set<string>();

  for (let i = 0; i <= maxRedirects; i++) {
    if (visited.has(currentUrl)) {
      return {
        url: targetUrl,
        finalUrl: currentUrl,
        statusCode: 0,
        headers: {},
        body: "",
        byteLength: 0,
        ttfbMs: 0,
        totalMs: 0,
        contentEncoding: "",
        hops,
        error: "Redirect loop detected",
      };
    }
    visited.add(currentUrl);

    try {
      const res = await singleRequest(currentUrl, opts);
      const location = res.headers["location"];
      hops.push({
        url: currentUrl,
        statusCode: res.statusCode,
        location,
        ttfbMs: res.ttfbMs,
        headers: res.headers,
      });

      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        location &&
        i < maxRedirects
      ) {
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      return {
        url: targetUrl,
        finalUrl: currentUrl,
        statusCode: res.statusCode,
        headers: res.headers,
        body: res.body,
        byteLength: res.byteLength,
        ttfbMs: res.ttfbMs,
        totalMs: res.totalMs,
        contentEncoding: res.contentEncoding,
        hops,
      };
    } catch (err) {
      return {
        url: targetUrl,
        finalUrl: currentUrl,
        statusCode: 0,
        headers: {},
        body: "",
        byteLength: 0,
        ttfbMs: 0,
        totalMs: 0,
        contentEncoding: "",
        hops,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    url: targetUrl,
    finalUrl: currentUrl,
    statusCode: 0,
    headers: {},
    body: "",
    byteLength: 0,
    ttfbMs: 0,
    totalMs: 0,
    contentEncoding: "",
    hops,
    error: `Exceeded max redirects (${maxRedirects})`,
  };
}

export function normalizeUrl(raw: string, base?: string): string | null {
  try {
    const u = base ? new URL(raw, base) : new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

export function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
}

export function isLocalOrIpHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]") {
    return true;
  }
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(h);
}

export function getApexDomain(hostname: string): string {
  const clean = hostname.toLowerCase().replace(/^www\./, "");
  return clean;
}
