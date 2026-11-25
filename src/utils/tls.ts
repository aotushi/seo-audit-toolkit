import crypto from "node:crypto";
import tls from "node:tls";

export interface TlsInspectionResult {
  hostname: string;
  port: number;
  reachable: boolean;
  authorized: boolean;
  authorizationError?: string;
  protocol?: string;
  subjectCN?: string;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysRemaining?: number;
  sans: string[];
  coversApex: boolean;
  coversWww: boolean;
  error?: string;
}

function matchesSan(hostname: string, san: string): boolean {
  const h = hostname.toLowerCase();
  const s = san.toLowerCase().replace(/^dns:/, "").trim();
  if (s === h) return true;
  if (s.startsWith("*.")) {
    const suffix = s.slice(2);
    const parts = h.split(".");
    if (parts.length >= 2 && h.endsWith("." + suffix)) {
      const prefix = h.slice(0, h.length - suffix.length - 1);
      return !prefix.includes(".");
    }
  }
  return false;
}

export function inspectTls(
  hostname: string,
  port = 443,
  timeoutMs = 8000
): Promise<TlsInspectionResult> {
  const apex = hostname.toLowerCase().replace(/^www\./, "");
  const wwwHost = `www.${apex}`;

  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      () => {
        try {
          const peer = socket.getPeerCertificate(true);
          const protocol = socket.getProtocol() ?? undefined;
          const authorized = socket.authorized;
          const authorizationError = socket.authorizationError
            ? String(socket.authorizationError)
            : undefined;

          let issuer: string | undefined;
          let subjectCN: string | undefined;
          let validFrom: string | undefined;
          let validTo: string | undefined;
          let daysRemaining: number | undefined;
          let sans: string[] = [];

          if (peer && peer.raw) {
            const x509 = new crypto.X509Certificate(peer.raw);
            issuer = x509.issuer.replace(/\n/g, ", ");
            subjectCN = x509.subject.replace(/\n/g, ", ");
            validFrom = x509.validFrom;
            validTo = x509.validTo;
            const expiryMs = Date.parse(x509.validTo);
            if (!Number.isNaN(expiryMs)) {
              daysRemaining = Math.floor(
                (expiryMs - Date.now()) / (1000 * 60 * 60 * 24)
              );
            }
            if (x509.subjectAltName) {
              sans = x509.subjectAltName
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.toLowerCase().startsWith("dns:"))
                .map((s) => s.replace(/^DNS:/i, "").trim());
            }
          }

          const coversApex = sans.some((s) => matchesSan(apex, s));
          const coversWww = sans.some((s) => matchesSan(wwwHost, s));

          socket.end();
          resolve({
            hostname,
            port,
            reachable: true,
            authorized,
            authorizationError,
            protocol,
            subjectCN,
            issuer,
            validFrom,
            validTo,
            daysRemaining,
            sans,
            coversApex,
            coversWww,
          });
        } catch (err) {
          socket.destroy();
          resolve({
            hostname,
            port,
            reachable: false,
            authorized: false,
            sans: [],
            coversApex: false,
            coversWww: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    );

    socket.on("timeout", () => {
      socket.destroy();
      resolve({
        hostname,
        port,
        reachable: false,
        authorized: false,
        sans: [],
        coversApex: false,
        coversWww: false,
        error: `TLS timeout after ${timeoutMs}ms`,
      });
    });

    socket.on("error", (err) => {
      resolve({
        hostname,
        port,
        reachable: false,
        authorized: false,
        sans: [],
        coversApex: false,
        coversWww: false,
        error: err.message,
      });
    });
  });
}
