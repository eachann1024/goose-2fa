import { parseOtpAuthUri } from "./otp";
import { parseGoogleAuthMigration } from "./google-auth-migration";
import type { AccountData, NewAccountInput } from "./types";

export interface ExportPayload {
  version: 1;
  app: "goose-2fa";
  exported_at: string;
  accounts: Omit<AccountData, "id" | "createdAt">[];
}

// ---- Export ----

export function exportAsJson(accounts: AccountData[]): string {
  const payload: ExportPayload = {
    version: 1,
    app: "goose-2fa",
    exported_at: new Date().toISOString(),
    accounts: accounts.map(({ id, createdAt, ...rest }) => rest),
  };
  return JSON.stringify(payload, null, 2);
}

export function exportAsUris(accounts: AccountData[]): string {
  return accounts
    .map((a) => {
      const label = a.issuer
        ? `${encodeURIComponent(a.issuer)}:${encodeURIComponent(a.name)}`
        : encodeURIComponent(a.name);
      const params = new URLSearchParams();
      params.set("secret", a.secret);
      if (a.issuer) params.set("issuer", a.issuer);
      params.set("algorithm", a.algorithm.replace("-", ""));
      params.set("digits", String(a.digits));
      if (a.type === "totp") params.set("period", String(a.period));
      if (a.type === "hotp") params.set("counter", String(a.counter));
      return `otpauth://${a.type}/${label}?${params.toString()}`;
    })
    .join("\n");
}

// ---- Algorithm normalization ----

const ALGORITHM_MAP: Record<string, "SHA-1" | "SHA-256" | "SHA-512"> = {
  SHA1: "SHA-1",
  "SHA-1": "SHA-1",
  "sha-1": "SHA-1",
  sha1: "SHA-1",
  SHA256: "SHA-256",
  "SHA-256": "SHA-256",
  sha256: "SHA-256",
  "sha-256": "SHA-256",
  SHA512: "SHA-512",
  "SHA-512": "SHA-512",
  sha512: "SHA-512",
  "sha-512": "SHA-512",
};

function normalizeAlgorithm(alg: string | undefined | null): "SHA-1" | "SHA-256" | "SHA-512" {
  if (!alg) return "SHA-1";
  return ALGORITHM_MAP[alg.trim()] ?? "SHA-1";
}

function normalizeType(t: string | undefined | null): "totp" | "hotp" {
  if (!t) return "totp";
  return t.toLowerCase() === "hotp" ? "hotp" : "totp";
}

// ---- Base32 detection ----

const BASE32_RE = /^[A-Z2-7]+=*$/i;

export function isBase32Secret(text: string): boolean {
  const clean = text.replace(/[\s-]/g, "");
  return clean.length >= 16 && clean.length <= 128 && BASE32_RE.test(clean);
}

// ---- Format parsers ----

/** Our own goose-2fa backup */
function tryGoose2fa(json: Record<string, unknown>): NewAccountInput[] | null {
  if (json.app === "goose-2fa" && Array.isArray(json.accounts)) {
    return parseAccountArray(json.accounts);
  }
  return null;
}

/** 2FAS Authenticator backup: { "services": [...], "updatedAt": ..., "schemaVersion": ... } */
function try2FAS(json: Record<string, unknown>): NewAccountInput[] | null {
  if (!Array.isArray(json.services)) return null;
  const results: NewAccountInput[] = [];
  for (const svc of json.services as Record<string, unknown>[]) {
    const otp = svc.otp as Record<string, unknown> | undefined;
    const secret = (otp?.secret ?? svc.secret) as string | undefined;
    if (!secret) continue;

    results.push({
      name: ((otp?.account ?? otp?.label ?? svc.name ?? "Unknown") as string),
      issuer: ((otp?.issuer ?? svc.name ?? "") as string),
      secret: String(secret).replace(/\s/g, "").toUpperCase(),
      type: normalizeType((otp?.tokenType ?? otp?.type ?? "TOTP") as string),
      digits: parseInt(String(otp?.digits ?? 6)) || 6,
      period: parseInt(String(otp?.period ?? 30)) || 30,
      counter: parseInt(String(otp?.counter ?? 0)) || 0,
      algorithm: normalizeAlgorithm((otp?.algorithm ?? "SHA1") as string),
    });
  }
  return results.length > 0 ? results : null;
}

/** Aegis Authenticator backup: { "version": N, "db": { "entries": [...] } } */
function tryAegis(json: Record<string, unknown>): NewAccountInput[] | null {
  const db = json.db as Record<string, unknown> | undefined;
  if (!db || !Array.isArray(db.entries)) return null;
  const results: NewAccountInput[] = [];
  for (const entry of db.entries as Record<string, unknown>[]) {
    const info = entry.info as Record<string, unknown> | undefined;
    const secret = (info?.secret ?? entry.secret) as string | undefined;
    if (!secret) continue;

    results.push({
      name: (entry.name as string) || "Unknown",
      issuer: (entry.issuer as string) || "",
      secret: String(secret).replace(/\s/g, "").toUpperCase(),
      type: normalizeType((entry.type ?? "totp") as string),
      digits: parseInt(String(info?.digits ?? 6)) || 6,
      period: parseInt(String(info?.period ?? 30)) || 30,
      counter: parseInt(String(info?.counter ?? 0)) || 0,
      algorithm: normalizeAlgorithm((info?.algo ?? info?.algorithm ?? "SHA1") as string),
    });
  }
  return results.length > 0 ? results : null;
}

/** andOTP backup: plain JSON array with { secret, issuer, label, type, algorithm, digits, period } */
function tryAndOTP(arr: unknown[]): NewAccountInput[] | null {
  if (arr.length === 0) return null;
  const first = arr[0] as Record<string, unknown>;
  // andOTP entries have "secret" and usually "type" fields
  if (!("secret" in first)) return null;

  const results: NewAccountInput[] = [];
  for (const entry of arr as Record<string, unknown>[]) {
    const secret = entry.secret as string | undefined;
    if (!secret) continue;

    let name = ((entry.label ?? entry.name ?? entry.account ?? "") as string);
    let issuer = ((entry.issuer ?? entry.issuerExt ?? "") as string);

    // andOTP uses "Issuer:Account" format in label
    if (!issuer && name.includes(":")) {
      const idx = name.indexOf(":");
      issuer = name.slice(0, idx).trim();
      name = name.slice(idx + 1).trim();
    }

    results.push({
      name: name || issuer || "Unknown",
      issuer,
      secret: String(secret).replace(/\s/g, "").toUpperCase(),
      type: normalizeType((entry.type ?? "TOTP") as string),
      digits: parseInt(String(entry.digits ?? 6)) || 6,
      period: parseInt(String(entry.period ?? entry.timer ?? 30)) || 30,
      counter: parseInt(String(entry.counter ?? 0)) || 0,
      algorithm: normalizeAlgorithm((entry.algorithm ?? entry.algo ?? "SHA1") as string),
    });
  }
  return results.length > 0 ? results : null;
}

/** Raivo OTP backup: JSON array with { issuer, account, secret, algorithm, digits, kind, timer, counter } */
function tryRaivo(arr: unknown[]): NewAccountInput[] | null {
  if (arr.length === 0) return null;
  const first = arr[0] as Record<string, unknown>;
  if (!("secret" in first) || !("kind" in first || "timer" in first)) return null;

  const results: NewAccountInput[] = [];
  for (const entry of arr as Record<string, unknown>[]) {
    const secret = entry.secret as string | undefined;
    if (!secret) continue;

    results.push({
      name: ((entry.account ?? entry.name ?? entry.label ?? "") as string) || (entry.issuer as string) || "Unknown",
      issuer: (entry.issuer as string) || "",
      secret: String(secret).replace(/\s/g, "").toUpperCase(),
      type: normalizeType((entry.kind ?? entry.type ?? "TOTP") as string),
      digits: parseInt(String(entry.digits ?? 6)) || 6,
      period: parseInt(String(entry.timer ?? entry.period ?? 30)) || 30,
      counter: parseInt(String(entry.counter ?? 0)) || 0,
      algorithm: normalizeAlgorithm((entry.algorithm ?? "SHA1") as string),
    });
  }
  return results.length > 0 ? results : null;
}

/**
 * FreeOTP+ backup: JSON array with { issuerExt, label, secret (byte array or base32), algo, digits, period, type }
 * FreeOTP+ may encode secret as a JSON number array instead of base32 string.
 */
function tryFreeOTP(arr: unknown[]): NewAccountInput[] | null {
  if (arr.length === 0) return null;
  const first = arr[0] as Record<string, unknown>;
  if (!("secret" in first) || !("issuerExt" in first || "issuerInt" in first)) return null;

  const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  function numArrayToBase32(nums: number[]): string {
    let result = "";
    let bits = 0;
    let value = 0;
    for (const byte of nums) {
      value = (value << 8) | (byte & 0xff);
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        result += B32[(value >> bits) & 31];
      }
    }
    if (bits > 0) result += B32[(value << (5 - bits)) & 31];
    return result;
  }

  const results: NewAccountInput[] = [];
  for (const entry of arr as Record<string, unknown>[]) {
    let secret = "";
    if (Array.isArray(entry.secret)) {
      secret = numArrayToBase32(entry.secret as number[]);
    } else if (typeof entry.secret === "string") {
      secret = (entry.secret as string).replace(/\s/g, "").toUpperCase();
    }
    if (!secret) continue;

    results.push({
      name: ((entry.label ?? entry.name ?? "") as string) || ((entry.issuerExt ?? entry.issuerInt ?? "") as string) || "Unknown",
      issuer: ((entry.issuerExt ?? entry.issuerInt ?? entry.issuer ?? "") as string),
      secret,
      type: normalizeType((entry.type ?? "TOTP") as string),
      digits: parseInt(String(entry.digits ?? 6)) || 6,
      period: parseInt(String(entry.period ?? 30)) || 30,
      counter: parseInt(String(entry.counter ?? 0)) || 0,
      algorithm: normalizeAlgorithm((entry.algo ?? entry.algorithm ?? "SHA1") as string),
    });
  }
  return results.length > 0 ? results : null;
}

/** Generic fallback: any JSON array or object with accounts that have a "secret" field */
function parseAccountArray(arr: unknown[]): NewAccountInput[] {
  const results: NewAccountInput[] = [];
  for (const a of arr as Record<string, unknown>[]) {
    const secret = a.secret as string | undefined;
    if (!secret) continue;

    let name = ((a.name ?? a.label ?? a.account ?? "") as string);
    let issuer = ((a.issuer ?? a.issuerExt ?? "") as string);

    if (!issuer && name.includes(":")) {
      const idx = name.indexOf(":");
      issuer = name.slice(0, idx).trim();
      name = name.slice(idx + 1).trim();
    }

    results.push({
      name: name || issuer || "Unknown",
      issuer,
      secret: String(secret).replace(/\s/g, "").toUpperCase(),
      type: normalizeType((a.type ?? a.tokenType ?? a.kind ?? "totp") as string),
      digits: parseInt(String(a.digits ?? 6)) || 6,
      period: parseInt(String(a.period ?? a.timer ?? 30)) || 30,
      counter: parseInt(String(a.counter ?? 0)) || 0,
      algorithm: normalizeAlgorithm((a.algorithm ?? a.algo ?? "SHA1") as string),
    });
  }
  return results;
}

// ---- Main import parser ----

export function parseImportData(text: string): NewAccountInput[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 1. Google Authenticator migration URI
  if (trimmed.startsWith("otpauth-migration://")) {
    const entries = parseGoogleAuthMigration(trimmed);
    if (entries && entries.length > 0) return entries;
  }

  // 2. Single or multi-line otpauth:// URIs
  if (trimmed.startsWith("otpauth://")) {
    const lines = trimmed.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);
    const parsed: NewAccountInput[] = [];
    for (const line of lines) {
      if (line.startsWith("otpauth-migration://")) {
        const migrated = parseGoogleAuthMigration(line);
        if (migrated) parsed.push(...migrated);
      } else if (line.startsWith("otpauth://")) {
        const p = parseOtpAuthUri(line);
        if (p) parsed.push({ ...p });
      }
    }
    if (parsed.length > 0) return parsed;
  }

  // 3. JSON formats
  try {
    const json = JSON.parse(trimmed);

    if (typeof json === "object" && json !== null && !Array.isArray(json)) {
      // Try named formats in order of specificity
      const obj = json as Record<string, unknown>;
      const goose = tryGoose2fa(obj);
      if (goose && goose.length > 0) return goose;

      const twofas = try2FAS(obj);
      if (twofas && twofas.length > 0) return twofas;

      const aegis = tryAegis(obj);
      if (aegis && aegis.length > 0) return aegis;

      // Object with "accounts" or "entries" array (generic)
      const arr = (obj.accounts ?? obj.entries ?? obj.otp_parameters) as unknown[] | undefined;
      if (Array.isArray(arr)) {
        const generic = parseAccountArray(arr);
        if (generic.length > 0) return generic;
      }
    }

    if (Array.isArray(json) && json.length > 0) {
      // Try array-based formats
      const andotp = tryAndOTP(json);
      if (andotp && andotp.length > 0) return andotp;

      const raivo = tryRaivo(json);
      if (raivo && raivo.length > 0) return raivo;

      const freeotp = tryFreeOTP(json);
      if (freeotp && freeotp.length > 0) return freeotp;

      // Generic array fallback
      const generic = parseAccountArray(json);
      if (generic.length > 0) return generic;
    }
  } catch {
    // not JSON
  }

  // 4. Mixed text: lines that are otpauth:// URIs or otpauth-migration:// URIs
  const lines = trimmed.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);
  const fromUris: NewAccountInput[] = [];
  for (const line of lines) {
    if (line.startsWith("otpauth-migration://")) {
      const migrated = parseGoogleAuthMigration(line);
      if (migrated) fromUris.push(...migrated);
    } else if (line.startsWith("otpauth://")) {
      const p = parseOtpAuthUri(line);
      if (p) fromUris.push({ ...p });
    }
  }
  if (fromUris.length > 0) return fromUris;

  // 5. Single base32 secret (one per line)
  const base32Lines = lines.filter((l) => isBase32Secret(l));
  if (base32Lines.length > 0) {
    return base32Lines.map((s, i) => ({
      name: `Account ${i + 1}`,
      issuer: "",
      secret: s.replace(/[\s-]/g, "").toUpperCase(),
      type: "totp" as const,
      digits: 6,
      period: 30,
      counter: 0,
      algorithm: "SHA-1" as const,
    }));
  }

  return null;
}

// ---- Deduplication ----

export function deduplicateImports(
  incoming: NewAccountInput[],
  existing: AccountData[],
): { newAccounts: NewAccountInput[]; dupeCount: number } {
  const existingSecrets = new Set(existing.map((a) => a.secret));
  const newAccounts = incoming.filter((a) => !existingSecrets.has(a.secret));
  return { newAccounts, dupeCount: incoming.length - newAccounts.length };
}
