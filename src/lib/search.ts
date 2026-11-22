import type { AccountData } from "./types";

const searchText = new WeakMap<AccountData, string>();

function searchTerms(query: string): string[] {
  const normalized = query.trim().toLowerCase();
  return normalized ? normalized.split(/\s+/) : [];
}

function matchesTerms(account: AccountData, terms: string[]): boolean {
  let text = searchText.get(account);
  if (text === undefined) {
    text = [account.issuer, account.name, account.remark ?? "", account.note ?? ""]
      .join(" ")
      .toLowerCase();
    searchText.set(account, text);
  }
  return terms.every((term) => text.includes(term));
}

/** 发行方、账户名、备注和显示名需要命中所有关键字。 */
export function matchAccount(account: AccountData, query: string): boolean {
  const terms = searchTerms(query);
  return terms.length === 0 || matchesTerms(account, terms);
}

export function filterAccounts(accounts: AccountData[], query: string): AccountData[] {
  const terms = searchTerms(query);
  return terms.length === 0 ? accounts : accounts.filter((account) => matchesTerms(account, terms));
}
