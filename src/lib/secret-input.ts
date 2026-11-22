import { normalizeBase32Secret } from "./account-validation";
import { parseOtpAuthUri } from "./otp";
import { parseGoogleAuthMigrationPayload } from "./google-auth-migration";
import type { ParsedOtpAuth } from "./types";

export interface ParsedSecretInput {
  secret: string;
  account: ParsedOtpAuth | null;
}

// Only strip an explicit label; never guess a secret from arbitrary prose.
const SECRET_LABEL = /^(?:(?:2fa|totp|hotp)[\s_-]*)?(?:secret|sercet|key|密钥|密鑰)(?:[\s_-]*(?:key|密钥|密鑰))?(?=$|[\s:：=])\s*[:：=]?\s*([\s\S]*)$/i;

export function parseSecretInput(text: string): ParsedSecretInput | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("otpauth://")) {
    const account = parseOtpAuthUri(trimmed);
    return account ? { secret: account.secret, account } : null;
  }

  const labelled = SECRET_LABEL.exec(trimmed);
  const secret = normalizeBase32Secret(labelled ? labelled[1] : trimmed);
  return secret ? { secret, account: null } : null;
}

export function parseSecretReplacement(text: string): { result: ParsedSecretInput | null; error?: string } {
  const trimmed = text.trim();
  if (trimmed.startsWith("otpauth://")) {
    const account = parseOtpAuthUri(trimmed);
    return account
      ? { result: { secret: account.secret, account } }
      : { result: null, error: "无法解析此 OTP 链接" };
  }
  if (trimmed.startsWith("otpauth-migration://")) {
    const migration = parseGoogleAuthMigrationPayload(trimmed);
    if (migration?.accounts?.length === 1) {
      const account = migration.accounts[0]!;
      return { result: { secret: account.secret, account } };
    }
    if ((migration?.accounts && migration.accounts.length > 1) || (migration?.batchSize ?? 0) > 1) {
      return { result: null, error: "迁移码包含多个账户，请单独复制目标账户密钥" };
    }
    return { result: null, error: "无法解析 Google Authenticator 迁移数据" };
  }
  const parsed = parseSecretInput(trimmed);
  return parsed ? { result: parsed } : { result: null, error: "密钥格式不正确 (需要 Base32 编码)" };
}
