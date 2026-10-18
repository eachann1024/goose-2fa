import { normalizeBase32Secret } from "./account-validation";
import { parseOtpAuthUri } from "./otp";
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
