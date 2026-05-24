/**
 * Google Authenticator migration format decoder.
 *
 * URI: otpauth-migration://offline?data=BASE64_PROTOBUF
 *
 * Protobuf schema (MigrationPayload):
 *   field 1 (repeated, embedded): OtpParameters
 *
 * OtpParameters:
 *   field 1 (bytes):  secret
 *   field 2 (string): name
 *   field 3 (string): issuer
 *   field 4 (varint): algorithm  (0=unspecified/SHA1, 1=SHA1, 2=SHA256, 3=SHA512, 4=MD5)
 *   field 5 (varint): digits     (0=unspecified/6, 1=six, 2=eight)
 *   field 6 (varint): type       (0=unspecified/TOTP, 1=HOTP, 2=TOTP)
 *   field 7 (varint): counter
 */

import type { NewAccountInput } from "./types";

// ---- protobuf primitives ----

function decodeVarint(buf: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length) {
    const byte = buf[pos]!;
    result |= (byte & 0x7f) << shift;
    pos++;
    if (!(byte & 0x80)) break;
    shift += 7;
    if (shift > 35) break; // safety
  }
  return [result >>> 0, pos];
}

// ---- base32 encode raw bytes ----

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function bytesToBase32(bytes: Uint8Array): string {
  let result = "";
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += B32[(value >> bits) & 31];
    }
  }
  if (bits > 0) {
    result += B32[(value << (5 - bits)) & 31];
  }
  return result;
}

// ---- parse one OtpParameters message ----

function parseOtpEntry(buf: Uint8Array): NewAccountInput | null {
  let secret: Uint8Array | null = null;
  let name = "";
  let issuer = "";
  let algorithm = 0;
  let digits = 0;
  let otpType = 0;
  let counter = 0;

  let pos = 0;
  while (pos < buf.length) {
    const [tag, p1] = decodeVarint(buf, pos);
    pos = p1;
    const field = tag >> 3;
    const wire = tag & 0x7;

    if (wire === 2) {
      const [len, p2] = decodeVarint(buf, pos);
      pos = p2;
      const data = buf.slice(pos, pos + len);
      pos += len;
      if (field === 1) secret = data;
      else if (field === 2) name = new TextDecoder().decode(data);
      else if (field === 3) issuer = new TextDecoder().decode(data);
    } else if (wire === 0) {
      const [val, p2] = decodeVarint(buf, pos);
      pos = p2;
      if (field === 4) algorithm = val;
      else if (field === 5) digits = val;
      else if (field === 6) otpType = val;
      else if (field === 7) counter = val;
    } else {
      // skip unknown wire types
      if (wire === 1) pos += 8;
      else if (wire === 5) pos += 4;
      else break;
    }
  }

  if (!secret || secret.length === 0) return null;

  const algMap: Record<number, "SHA-1" | "SHA-256" | "SHA-512"> = {
    0: "SHA-1",
    1: "SHA-1",
    2: "SHA-256",
    3: "SHA-512",
    4: "SHA-1", // MD5 fallback
  };
  const digitMap: Record<number, number> = { 0: 6, 1: 6, 2: 8 };
  const typeMap: Record<number, "totp" | "hotp"> = { 0: "totp", 1: "hotp", 2: "totp" };

  // Handle label format "Issuer:account" when issuer is empty
  if (!issuer && name.includes(":")) {
    const idx = name.indexOf(":");
    issuer = name.slice(0, idx).trim();
    name = name.slice(idx + 1).trim();
  }

  return {
    name: name || issuer || "Unknown",
    issuer,
    secret: bytesToBase32(secret),
    type: typeMap[otpType] ?? "totp",
    digits: digitMap[digits] ?? 6,
    period: 30,
    counter,
    algorithm: algMap[algorithm] ?? "SHA-1",
  };
}

// ---- parse the outer MigrationPayload ----

function parseMigrationPayload(buf: Uint8Array): NewAccountInput[] {
  const entries: NewAccountInput[] = [];
  let pos = 0;
  while (pos < buf.length) {
    const [tag, p1] = decodeVarint(buf, pos);
    pos = p1;
    const field = tag >> 3;
    const wire = tag & 0x7;

    if (wire === 2) {
      const [len, p2] = decodeVarint(buf, pos);
      pos = p2;
      if (field === 1) {
        const entry = parseOtpEntry(buf.slice(pos, pos + len));
        if (entry) entries.push(entry);
      }
      pos += len;
    } else if (wire === 0) {
      const [, p2] = decodeVarint(buf, pos);
      pos = p2;
    } else {
      break;
    }
  }
  return entries;
}

// ---- public API ----

/**
 * Parse a Google Authenticator migration URI.
 * Format: otpauth-migration://offline?data=BASE64
 */
export function parseGoogleAuthMigration(uri: string): NewAccountInput[] | null {
  const trimmed = uri.trim();
  if (!trimmed.startsWith("otpauth-migration://")) return null;

  try {
    const dataMatch = trimmed.match(/[?&]data=([^&]+)/);
    if (!dataMatch) return null;

    const b64 = decodeURIComponent(dataMatch[1]!);
    const raw = atob(b64);
    const buf = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      buf[i] = raw.charCodeAt(i);
    }

    const entries = parseMigrationPayload(buf);
    return entries.length > 0 ? entries : null;
  } catch {
    return null;
  }
}
