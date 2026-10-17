export interface AccountLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface AccountMeta {
  timezone?: string;
  locale?: string;
  platform?: string;
  location?: AccountLocation;
}

export interface AccountData {
  id: string;
  name: string;
  issuer: string;
  secret: string;
  type: "totp" | "hotp";
  digits: number;
  period: number;
  counter: number;
  algorithm: "SHA-1" | "SHA-256" | "SHA-512";
  createdAt: number;
  meta?: AccountMeta;
  originalName?: string;
  note?: string;
  remark?: string;
  /** 一级分组 id；null/缺省 = 默认（无自定义分组时不单独展示） */
  groupId?: string | null;
  deletedAt?: number;
}

export type NewAccountInput = Omit<AccountData, "id" | "createdAt" | "meta" | "deletedAt">;

export interface ParsedOtpAuth {
  name: string;
  issuer: string;
  secret: string;
  type: "totp" | "hotp";
  digits: number;
  period: number;
  counter: number;
  algorithm: "SHA-1" | "SHA-256" | "SHA-512";
}

/** 用户一级保险柜/分组 */
export interface VaultGroup {
  id: string;
  name: string;
  order: number;
  createdAt: number;
}
