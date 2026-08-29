"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation is the reliable fallback for the current vinext Workers runtime. */

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import {
  DEFAULT_LANGUAGE,
  isLanguage,
  LANGUAGE_STORAGE_KEY,
  type Language,
} from "@/lib/language";

const COPY = {
  en: {
    navigation: "Primary navigation",
    overview: "Overview",
    overviewShort: "Home",
    recurring: "Recurring transactions",
    recurringShort: "Repeat",
    transactions: "Transactions",
    transactionsShort: "History",
    budgets: "Budgets",
    budgetsShort: "Budget",
    reports: "Reports",
    reportsShort: "Reports",
    guide: "Guide",
    guideShort: "Guide",
    track: "Track",
    planAndReview: "Plan & review",
    help: "Help",
    privateLedger: "Your private global ledger",
    guestName: "Global citizen",
    logout: "Log out",
  },
  ko: {
    navigation: "주요 메뉴",
    overview: "대시보드",
    overviewShort: "홈",
    recurring: "반복 거래 관리",
    recurringShort: "반복",
    transactions: "거래 내역",
    transactionsShort: "거래",
    budgets: "예산 관리",
    budgetsShort: "예산",
    reports: "리포트",
    reportsShort: "분석",
    guide: "사용법",
    guideShort: "사용법",
    track: "기록",
    planAndReview: "계획 및 분석",
    help: "도움말",
    privateLedger: "나만의 글로벌 가계부",
    guestName: "글로벌 사용자",
    logout: "로그아웃",
  },
  ja: {
    navigation: "メインナビゲーション",
    overview: "ダッシュボード",
    overviewShort: "ホーム",
    recurring: "定期取引",
    recurringShort: "定期",
    transactions: "取引履歴",
    transactionsShort: "取引",
    budgets: "予算管理",
    budgetsShort: "予算",
    reports: "レポート",
    reportsShort: "分析",
    guide: "使い方",
    guideShort: "使い方",
    track: "記録",
    planAndReview: "計画と分析",
    help: "ヘルプ",
    privateLedger: "自分だけのグローバル家計簿",
    guestName: "グローバルユーザー",
    logout: "ログアウト",
  },
  ru: {
    navigation: "Основная навигация",
    overview: "Обзор",
    overviewShort: "Дом",
    recurring: "Регулярные операции",
    recurringShort: "Повтор",
    transactions: "Операции",
    transactionsShort: "Список",
    budgets: "Бюджеты",
    budgetsShort: "Бюджет",
    reports: "Отчёты",
    reportsShort: "Отчёт",
    guide: "Справка",
    guideShort: "Справка",
    track: "Учёт",
    planAndReview: "Планирование и анализ",
    help: "Помощь",
    privateLedger: "Ваш личный глобальный учёт финансов",
    guestName: "Пользователь GlobeLedger",
    logout: "Выйти",
  },
} as const;

type MemberResponse = {
  data?: { displayName?: string; email?: string };
};

export function LedgerNavigation({
  children,
  initialLanguage = DEFAULT_LANGUAGE,
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) {
  const pathname = usePathname();
  const isLedgerRoute = pathname === "/" || pathname === "/transactions" || pathname === "/recurring" || pathname === "/budgets" || pathname === "/reports" || pathname === "/guide";
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [firstName, setFirstName] = useState<string | null>(null);
  const copy = COPY[language];

  useEffect(() => {
    if (!isLedgerRoute) return;
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (isLanguage(stored)) setLanguage(stored);
    });
    const syncLanguage = () => {
      if (isLanguage(document.documentElement.lang)) {
        setLanguage(document.documentElement.lang);
      }
    };
    const languageObserver = new MutationObserver(syncLanguage);
    languageObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
    const controller = new AbortController();
    async function loadMember() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as MemberResponse;
        const identity = payload.data?.displayName?.trim() || payload.data?.email;
        setFirstName(identity?.split(/\s+/)[0] ?? null);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    void loadMember();

    return () => {
      controller.abort();
      languageObserver.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [isLedgerRoute]);

  if (!isLedgerRoute) return children;

  const overviewActive = pathname === "/";
  const transactionsActive = pathname === "/transactions";

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/auth");
  }

  const trackingLinks = [
    { href: "/", label: copy.overview, mobileLabel: copy.overviewShort, glyph: "●", active: overviewActive },
    { href: "/transactions", label: copy.transactions, mobileLabel: copy.transactionsShort, glyph: "≡", active: transactionsActive },
  ];
  const planningLinks = [
    { href: "/recurring", label: copy.recurring, mobileLabel: copy.recurringShort, glyph: "↻", active: pathname === "/recurring" },
    { href: "/budgets", label: copy.budgets, mobileLabel: copy.budgetsShort, glyph: "◎", active: pathname === "/budgets" },
    { href: "/reports", label: copy.reports, mobileLabel: copy.reportsShort, glyph: "◫", active: pathname === "/reports" },
  ];
  const helpLinks = [
    { href: "/guide", label: copy.guide, mobileLabel: copy.guideShort, glyph: "?", active: pathname === "/guide" },
  ];
  const primaryLinks = [...trackingLinks, ...planningLinks, ...helpLinks];

  const renderLinks = (links: typeof primaryLinks) =>
    links.map((item) => (
      <a
        href={item.href}
        className={item.active ? "nav-item active" : "nav-item"}
        aria-current={item.active ? "page" : undefined}
        key={item.href}
      >
        <span aria-hidden="true">{item.glyph}</span>{item.label}
      </a>
    ));

  return (
    <div className="ledger-layout">
      <aside className="sidebar ledger-sidebar" aria-label={copy.navigation}>
        <a href="/" className="brand-lockup ledger-brand">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-name">GlobeLedger</span>
        </a>
        <nav className="primary-nav">
          <span className="nav-section-label">{copy.track}</span>
          {renderLinks(trackingLinks)}
          <span className="nav-section-label">{copy.planAndReview}</span>
          {renderLinks(planningLinks)}
          <span className="nav-section-label">{copy.help}</span>
          {renderLinks(helpLinks)}
        </nav>
        <div className="sidebar-spacer" />
        <div className="account-chip">
          <span className="avatar">{firstName?.[0]?.toUpperCase() ?? "G"}</span>
          <span><strong>{firstName ?? copy.guestName}</strong><small>{copy.privateLedger}</small></span>
          <button type="button" className="account-logout" onClick={() => void logout()}>{copy.logout}</button>
        </div>
      </aside>

      <div className="ledger-route">{children}</div>

      <nav className="ledger-mobile-nav" aria-label={copy.navigation}>
        {primaryLinks.map((item) => (
          <a href={item.href} className={item.active ? "active" : ""} aria-current={item.active ? "page" : undefined} key={item.href}>
            <span aria-hidden="true">{item.glyph}</span><small>{item.mobileLabel}</small>
          </a>
        ))}
      </nav>
    </div>
  );
}
