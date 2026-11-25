import dns from "node:dns/promises";
import { fetchWithTrace, isLocalOrIpHost } from "./http.js";

export interface DnsSummary {
  domain: string;
  a: string[];
  aaaa: string[];
  ns: string[];
  cname: string[];
  mx: Array<{ exchange: string; priority: number }>;
  txt: string[];
  spf: string | null;
  dmarc: string | null;
}

export interface RdapSummary {
  available: boolean;
  registrar?: string;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
  daysUntilExpiry?: number;
  eppStatuses: string[];
  error?: string;
}

export interface WaybackSummary {
  available: boolean;
  snapshotCount: number;
  firstYear?: string;
  lastYear?: string;
  error?: string;
}

async function safeResolve<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function inspectDns(domain: string): Promise<DnsSummary> {
  if (isLocalOrIpHost(domain)) {
    return {
      domain,
      a: [domain],
      aaaa: [],
      ns: [],
      cname: [],
      mx: [],
      txt: [],
      spf: null,
      dmarc: null,
    };
  }

  const [a, aaaa, ns, cname, mx, txtRaw, dmarcRaw] = await Promise.all([
    safeResolve(() => dns.resolve4(domain), [] as string[]),
    safeResolve(() => dns.resolve6(domain), [] as string[]),
    safeResolve(() => dns.resolveNs(domain), [] as string[]),
    safeResolve(() => dns.resolveCname(domain), [] as string[]),
    safeResolve(() => dns.resolveMx(domain), []),
    safeResolve(() => dns.resolveTxt(domain), [] as string[][]),
    safeResolve(() => dns.resolveTxt(`_dmarc.${domain}`), [] as string[][]),
  ]);

  const txt = txtRaw.map((parts) => parts.join(""));
  const dmarcTxts = dmarcRaw.map((parts) => parts.join(""));
  const spf = txt.find((t) => t.toLowerCase().startsWith("v=spf1")) ?? null;
  const dmarc =
    dmarcTxts.find((t) => t.toLowerCase().startsWith("v=dmarc1")) ?? null;

  return { domain, a, aaaa, ns, cname, mx, txt, spf, dmarc };
}

export async function inspectRdap(
  domain: string,
  timeoutMs = 8000
): Promise<RdapSummary> {
  if (isLocalOrIpHost(domain)) {
    return {
      available: false,
      eppStatuses: [],
      error: "Localhost or IP target",
    };
  }

  const res = await fetchWithTrace(
    `https://rdap.org/domain/${encodeURIComponent(domain)}`,
    { timeoutMs, maxRedirects: 4 }
  );

  if (res.error || res.statusCode !== 200) {
    return {
      available: false,
      eppStatuses: [],
      error: res.error ?? `RDAP HTTP ${res.statusCode}`,
    };
  }

  try {
    const data = JSON.parse(res.body) as Record<string, unknown>;
    const events = Array.isArray(data.events)
      ? (data.events as Array<{ eventAction?: string; eventDate?: string }>)
      : [];
    const findEvent = (action: string) =>
      events.find((e) => e.eventAction?.toLowerCase() === action)?.eventDate;

    const createdAt = findEvent("registration");
    const updatedAt = findEvent("last changed");
    const expiresAt = findEvent("expiration");
    let daysUntilExpiry: number | undefined;
    if (expiresAt) {
      const ms = Date.parse(expiresAt);
      if (!Number.isNaN(ms)) {
        daysUntilExpiry = Math.floor((ms - Date.now()) / (1000 * 60 * 60 * 24));
      }
    }

    const eppStatuses = Array.isArray(data.status)
      ? data.status.map(String)
      : [];

    let registrar: string | undefined;
    if (Array.isArray(data.entities)) {
      for (const ent of data.entities as Array<Record<string, unknown>>) {
        const roles = Array.isArray(ent.roles) ? ent.roles.map(String) : [];
        if (roles.includes("registrar") && Array.isArray(ent.vcardArray)) {
          const vcard = ent.vcardArray[1];
          if (Array.isArray(vcard)) {
            const fnEntry = vcard.find(
              (item: unknown) => Array.isArray(item) && item[0] === "fn"
            );
            if (Array.isArray(fnEntry) && typeof fnEntry[3] === "string") {
              registrar = fnEntry[3];
              break;
            }
          }
        }
      }
    }

    return {
      available: true,
      registrar,
      createdAt,
      updatedAt,
      expiresAt,
      daysUntilExpiry,
      eppStatuses,
    };
  } catch (err) {
    return {
      available: false,
      eppStatuses: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function inspectWayback(
  domain: string,
  timeoutMs = 8000
): Promise<WaybackSummary> {
  if (isLocalOrIpHost(domain)) {
    return { available: false, snapshotCount: 0, error: "Localhost/IP target" };
  }

  const url = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(
    domain
  )}&output=json&fl=timestamp&collapse=timestamp:4&limit=50`;
  const res = await fetchWithTrace(url, { timeoutMs, maxRedirects: 3 });
  if (res.error || res.statusCode !== 200) {
    return {
      available: false,
      snapshotCount: 0,
      error: res.error ?? `Wayback HTTP ${res.statusCode}`,
    };
  }

  try {
    const rows = JSON.parse(res.body) as string[][];
    const years = rows
      .slice(1)
      .map((r) => (r[0] ? r[0].slice(0, 4) : ""))
      .filter(Boolean)
      .sort();
    return {
      available: true,
      snapshotCount: years.length,
      firstYear: years[0],
      lastYear: years[years.length - 1],
    };
  } catch (err) {
    return {
      available: false,
      snapshotCount: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
