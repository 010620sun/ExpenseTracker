"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { isLanguage, type Language } from "@/lib/language";

const COPY = {
  en: {
    navigation: "Primary navigation",
    overview: "Overview",
    recurring: "Recurring transactions",
    transactions: "Transactions",
    budgets: "Budgets",
    reports: "Reports",
    settings: "Settings",
    comingSoon: "Coming soon",
    privateLedger: "Your private global ledger",
    logout: "Log out",
    helpTitle: "Built for borderless lives",
    helpBody: "Original amounts stay intact while one base view keeps your plan clear.",
  },
  ko: {
    navigation: "주요 메뉴",
    overview: "대시보드",
    recurring: "반복 거래 관리",
    transactions: "거래 내역",
    budgets: "예산 관리",
    reports: "리포트",
    settings: "설정",
    comingSoon: "준비 중",
    privateLedger: "나만의 글로벌 가계부",
    logout: "로그아웃",
    helpTitle: "국경 없는 일상을 위해",
    helpBody: "원 결제 금액은 그대로 유지하고 기준 통화로 계획을 명확하게 관리하세요.",
  },
  ja: {
    navigation: "メインナビゲーション",
    overview: "概要",
    recurring: "繰り返し取引",
    transactions: "取引履歴",
    budgets: "予算管理",
    reports: "レポート",
    settings: "設定",
    comingSoon: "準備中",
    privateLedger: "自分だけのグローバル家計簿",
    logout: "ログアウト",
    helpTitle: "国境を越える暮らしのために",
    helpBody: "元の金額を保ちながら、基準通貨で計画を明確に管理できます。",
  },
  ru: {
    navigation: "Основная навигация",
    overview: "Обзор",
    recurring: "Регулярные операции",
    transactions: "Операции",
    budgets: "Бюджеты",
    reports: "Отчёты",
    settings: "Настройки",
    comingSoon: "Скоро",
    privateLedger: "Ваш личный глобальный бюджет",
    logout: "Выйти",
    helpTitle: "Для жизни без границ",
    helpBody: "Исходные суммы сохраняются, а основная валюта делает план понятным.",
  },
} as const;

type MemberResponse = {
  data?: { displayName?: string; email?: string };
};

export function LedgerNavigation({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLedgerRoute = pathname === "/" || pathname === "/recurring" || pathname === "/budgets";
  const [language, setLanguage] = useState<Language>("en");
  const [firstName, setFirstName] = useState<string | null>(null);
  const [hash, setHash] = useState("");
  const copy = COPY[language];

  useEffect(() => {
    if (!isLedgerRoute) return;
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem("globeledger-language");
      if (isLanguage(stored)) setLanguage(stored);
      setHash(window.location.hash);
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
    const syncHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", syncHash);

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
      window.removeEventListener("hashchange", syncHash);
    };
  }, [isLedgerRoute]);

  if (!isLedgerRoute) return children;

  const overviewActive = pathname === "/" && hash !== "#transactions";
  const transactionsActive = pathname === "/" && hash === "#transactions";

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/auth");
  }

  const primaryLinks = [
    { href: "/", label: copy.overview, glyph: "●", active: overviewActive },
    { href: "/recurring", label: copy.recurring, glyph: "↻", active: pathname === "/recurring" },
    { href: "/#transactions", label: copy.transactions, glyph: "≡", active: transactionsActive },
    { href: "/budgets", label: copy.budgets, glyph: "◎", active: pathname === "/budgets" },
  ];

  return (
    <div className="ledger-layout">
      <aside className="sidebar ledger-sidebar" aria-label={copy.navigation}>
        <Link href="/" className="brand-lockup ledger-brand">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-name">GlobeLedger</span>
        </Link>
        <nav className="primary-nav">
          {primaryLinks.map((item) => (
            <Link
              href={item.href}
              className={item.active ? "nav-item active" : "nav-item"}
              aria-current={item.active ? "page" : undefined}
              key={item.href}
            >
              <span aria-hidden="true">{item.glyph}</span>{item.label}
            </Link>
          ))}
          <button className="nav-item pending" type="button" disabled title={copy.comingSoon}><span aria-hidden="true">◫</span>{copy.reports}<small>{copy.comingSoon}</small></button>
          <button className="nav-item pending" type="button" disabled title={copy.comingSoon}><span aria-hidden="true">⚙</span>{copy.settings}<small>{copy.comingSoon}</small></button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="borderless-note">
          <span className="note-orbit" aria-hidden="true">◎</span>
          <strong>{copy.helpTitle}</strong>
          <p>{copy.helpBody}</p>
        </div>
        <div className="account-chip">
          <span className="avatar">{firstName?.[0]?.toUpperCase() ?? "G"}</span>
          <span><strong>{firstName ?? "Global citizen"}</strong><small>{copy.privateLedger}</small></span>
          <button type="button" className="account-logout" onClick={() => void logout()}>{copy.logout}</button>
        </div>
      </aside>

      <div className="ledger-route">{children}</div>

      <nav className="ledger-mobile-nav" aria-label={copy.navigation}>
        {primaryLinks.filter((item) => item.href !== "/#transactions").map((item) => (
          <Link href={item.href} className={item.active ? "active" : ""} aria-current={item.active ? "page" : undefined} key={item.href}>
            <span aria-hidden="true">{item.glyph}</span><small>{item.label}</small>
          </Link>
        ))}
      </nav>
    </div>
  );
}
