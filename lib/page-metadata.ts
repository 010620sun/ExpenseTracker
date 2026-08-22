import type { Metadata } from "next";

import type { Language } from "@/lib/language";

export type LedgerPage =
  | "auth"
  | "overview"
  | "transactions"
  | "budgets"
  | "recurring"
  | "reports";

const PAGE_TITLES: Record<Language, Record<LedgerPage, string>> = {
  en: {
    auth: "Account",
    overview: "Overview",
    transactions: "Transactions",
    budgets: "Budgets",
    recurring: "Recurring transactions",
    reports: "Reports",
  },
  ko: {
    auth: "계정",
    overview: "대시보드",
    transactions: "거래 내역",
    budgets: "예산",
    recurring: "반복 거래",
    reports: "리포트",
  },
  ja: {
    auth: "アカウント",
    overview: "ダッシュボード",
    transactions: "取引履歴",
    budgets: "予算",
    recurring: "定期取引",
    reports: "レポート",
  },
  ru: {
    auth: "Аккаунт",
    overview: "Обзор",
    transactions: "Операции",
    budgets: "Бюджеты",
    recurring: "Регулярные операции",
    reports: "Отчёты",
  },
};

export function pageMetadata(page: LedgerPage, language: Language): Metadata {
  return { title: `${PAGE_TITLES[language][page]} · GlobeLedger` };
}
