import type { AccountData, NewAccountInput, VaultGroup } from "../types";

export interface ExportPayload {
  version: 2;
  app: "goose-2fa";
  exported_at: string;
  groups: VaultGroup[];
  accounts: NewAccountInput[];
}

// ---- Export ----

export function exportAsJson(accounts: AccountData[], groups: VaultGroup[] = []): string {
  const payload: ExportPayload = {
    version: 2,
    app: "goose-2fa",
    exported_at: new Date().toISOString(),
    groups: groups.map(({ id, name, order, createdAt }) => ({ id, name, order, createdAt })),
    accounts: accounts.map(({ id: _id, createdAt: _createdAt, meta: _meta, deletedAt: _deletedAt, ...rest }) => rest),
  };
  return JSON.stringify(payload, null, 2);
}

export function accountToOtpAuthUri(account: AccountData): string {
  const label = account.issuer
    ? `${encodeURIComponent(account.issuer)}:${encodeURIComponent(account.name)}`
    : encodeURIComponent(account.name);
  const params = new URLSearchParams();
  params.set("secret", account.secret);
  if (account.issuer) params.set("issuer", account.issuer);
  params.set("algorithm", account.algorithm.replace("-", ""));
  params.set("digits", String(account.digits));
  if (account.type === "totp") params.set("period", String(account.period));
  if (account.type === "hotp") params.set("counter", String(account.counter));
  return `otpauth://${account.type}/${label}?${params.toString()}`;
}

export function exportAsUris(accounts: AccountData[]): string {
  return accounts.map(accountToOtpAuthUri).join("\n");
}
