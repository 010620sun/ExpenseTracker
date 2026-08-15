"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { LanguagePicker } from "@/components/language-picker";
import { currencyExponent } from "@/lib/currency";
import {
  isLanguage,
  LANGUAGE_LOCALES,
  type Language,
} from "@/lib/language";

const CATEGORIES = [
  "housing",
  "groceries",
  "dining",
  "transport",
  "utilities",
  "health",
  "education",
  "entertainment",
  "travel",
  "shopping",
  "subscriptions",
  "other",
] as const;
type BudgetCategory = (typeof CATEGORIES)[number];

type BudgetResponse = {
  data?: {
    month: string;
    budgets: Array<{ category: BudgetCategory; amountUsdMinor: number }>;
    spending: Array<{ category: string; spentUsdMinor: number }>;
    totalBudgetUsdMinor: number;
    totalSpentUsdMinor: number;
  };
};

type PreferencesResponse = {
  data?: { baseCurrency?: string; language?: Language };
};

type RatesResponse = {
  data?: {
    baseCurrency?: string;
    direction?: string;
    source?: string;
    rates?: Record<string, string>;
  };
};

const CATEGORY_LABELS: Record<BudgetCategory, Record<Language, string>> = {
  housing: { en: "Housing", ko: "주거", ja: "住居", ru: "Жильё" },
  groceries: { en: "Groceries", ko: "식료품", ja: "食料品", ru: "Продукты" },
  dining: { en: "Food & drink", ko: "식음료", ja: "飲食", ru: "Еда и напитки" },
  transport: { en: "Transport", ko: "교통", ja: "交通", ru: "Транспорт" },
  utilities: { en: "Utilities", ko: "공과금", ja: "光熱費", ru: "Коммунальные услуги" },
  health: { en: "Health", ko: "건강·의료", ja: "健康・医療", ru: "Здоровье" },
  education: { en: "Education", ko: "교육", ja: "教育", ru: "Образование" },
  entertainment: { en: "Entertainment", ko: "문화·여가", ja: "娯楽", ru: "Развлечения" },
  travel: { en: "Travel", ko: "여행", ja: "旅行", ru: "Путешествия" },
  shopping: { en: "Shopping", ko: "쇼핑", ja: "買い物", ru: "Покупки" },
  subscriptions: { en: "Subscriptions", ko: "구독", ja: "サブスクリプション", ru: "Подписки" },
  other: { en: "Other", ko: "기타", ja: "その他", ru: "Другое" },
};

const COPY = {
  en: {
    overview: "Overview", recurring: "Recurring transactions", budgets: "Budgets",
    title: "Monthly budgets", subtitle: "Give every category a clear spending limit.",
    language: "Language", save: "Save budgets", saving: "Saving…",
    previous: "Previous month", next: "Next month", current: "This month",
    copyPrevious: "Copy previous month", copied: "Previous month copied. Review and save when ready.",
    totalBudget: "Total budget", spent: "Spent", remaining: "Remaining", used: "used",
    plan: "Category plan", planHint: "Set only the categories you want to track.",
    budget: "Budget", noBudget: "Not set", over: "over budget",
    loadFailed: "We couldn’t load this month’s budget.",
    saveFailed: "We couldn’t save these budgets.", invalid: "Enter valid positive budget amounts.",
    saved: "Monthly budgets saved.", privateLedger: "Your private global ledger", logout: "Log out",
    baseNote: "Amounts shown in your base currency", noPlan: "No budget set",
  },
  ko: {
    overview: "대시보드", recurring: "반복 거래 관리", budgets: "예산 관리",
    title: "월간 예산", subtitle: "카테고리마다 명확한 지출 한도를 설정하세요.",
    language: "언어", save: "예산 저장", saving: "저장 중…",
    previous: "이전 달", next: "다음 달", current: "이번 달",
    copyPrevious: "지난달 예산 복사", copied: "지난달 예산을 복사했습니다. 확인 후 저장하세요.",
    totalBudget: "총 예산", spent: "사용 금액", remaining: "남은 금액", used: "사용",
    plan: "카테고리별 계획", planHint: "관리할 카테고리에만 예산을 입력하세요.",
    budget: "예산", noBudget: "설정 안 됨", over: "예산 초과",
    loadFailed: "이번 달 예산을 불러오지 못했습니다.",
    saveFailed: "예산을 저장하지 못했습니다.", invalid: "올바른 양수 금액을 입력하세요.",
    saved: "월간 예산을 저장했습니다.", privateLedger: "나만의 글로벌 가계부", logout: "로그아웃",
    baseNote: "기본 통화로 표시된 금액", noPlan: "예산 미설정",
  },
  ja: {
    overview: "概要", recurring: "繰り返し取引", budgets: "予算管理",
    title: "月間予算", subtitle: "カテゴリーごとに明確な支出上限を設定します。",
    language: "言語", save: "予算を保存", saving: "保存中…",
    previous: "前の月", next: "次の月", current: "今月",
    copyPrevious: "前月の予算をコピー", copied: "前月の予算をコピーしました。確認して保存してください。",
    totalBudget: "総予算", spent: "支出済み", remaining: "残額", used: "使用",
    plan: "カテゴリー別プラン", planHint: "管理したいカテゴリーだけ予算を入力できます。",
    budget: "予算", noBudget: "未設定", over: "予算超過",
    loadFailed: "今月の予算を読み込めませんでした。",
    saveFailed: "予算を保存できませんでした。", invalid: "有効な正の金額を入力してください。",
    saved: "月間予算を保存しました。", privateLedger: "自分だけのグローバル家計簿", logout: "ログアウト",
    baseNote: "基本通貨で表示", noPlan: "予算未設定",
  },
  ru: {
    overview: "Обзор", recurring: "Регулярные операции", budgets: "Бюджеты",
    title: "Месячный бюджет", subtitle: "Задайте понятный лимит для каждой категории.",
    language: "Язык", save: "Сохранить бюджеты", saving: "Сохранение…",
    previous: "Предыдущий месяц", next: "Следующий месяц", current: "Текущий месяц",
    copyPrevious: "Копировать прошлый месяц", copied: "Бюджет прошлого месяца скопирован. Проверьте и сохраните.",
    totalBudget: "Общий бюджет", spent: "Потрачено", remaining: "Осталось", used: "использовано",
    plan: "План по категориям", planHint: "Укажите бюджет только для нужных категорий.",
    budget: "Бюджет", noBudget: "Не задан", over: "сверх бюджета",
    loadFailed: "Не удалось загрузить бюджет за этот месяц.",
    saveFailed: "Не удалось сохранить бюджеты.", invalid: "Введите корректные положительные суммы.",
    saved: "Месячные бюджеты сохранены.", privateLedger: "Ваш личный глобальный бюджет", logout: "Выйти",
    baseNote: "Суммы в основной валюте", noPlan: "Бюджет не задан",
  },
} as const;

const GLYPHS: Record<BudgetCategory, string> = {
  housing: "🏠", groceries: "🛒", dining: "🍽️", transport: "🚆",
  utilities: "💡", health: "🩺", education: "🎓", entertainment: "🎬",
  travel: "✈️", shopping: "🛍️", subscriptions: "↻", other: "•••",
};

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + amount, 1))
    .toISOString()
    .slice(0, 7);
}

function monthLabel(month: string, language: Language) {
  return new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

function formatMoney(value: number, currency: string, language: Language) {
  const exponent = currencyExponent(currency) ?? 2;
  try {
    return new Intl.NumberFormat(LANGUAGE_LOCALES[language], {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(exponent)}`;
  }
}

function inputAmount(usdMinor: number, baseCurrency: string, rate: number) {
  const exponent = currencyExponent(baseCurrency) ?? 2;
  return (usdMinor / 100 / rate).toFixed(exponent);
}

export function BudgetManager({ today }: { today: string }) {
  const [language, setLanguage] = useState<Language>("en");
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [ratesToUsd, setRatesToUsd] = useState<Record<string, number>>({ USD: 1 });
  const [month, setMonth] = useState(today.slice(0, 7));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [spending, setSpending] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const copy = COPY[language];
  const rate = ratesToUsd[baseCurrency] ?? 1;

  useEffect(() => {
    const controller = new AbortController();
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem("globeledger-language");
      if (isLanguage(stored)) setLanguage(stored);
    });
    async function bootstrap() {
      try {
        const [preferencesResponse, ratesResponse] = await Promise.all([
          fetch("/api/preferences", { cache: "no-store", signal: controller.signal }),
          fetch("/api/rates", { cache: "no-store", signal: controller.signal }),
        ]);
        if (!preferencesResponse.ok || !ratesResponse.ok) throw new Error();
        const preferences = (await preferencesResponse.json()) as PreferencesResponse;
        const ratesPayload = (await ratesResponse.json()) as RatesResponse;
        const rates = ratesPayload.data?.rates;
        const parsedRates: Record<string, number> = { USD: 1 };
        if (rates && ratesPayload.data?.baseCurrency === "USD") {
          for (const [currency, rawRate] of Object.entries(rates)) {
            const parsed = Number(rawRate);
            if (/^[A-Z]{3}$/u.test(currency) && Number.isFinite(parsed) && parsed > 0) {
              parsedRates[currency] = parsed;
            }
          }
        }
        const preferredBase = preferences.data?.baseCurrency;
        setRatesToUsd(parsedRates);
        setBaseCurrency(
          preferredBase && parsedRates[preferredBase] ? preferredBase : "USD",
        );
        if (isLanguage(preferences.data?.language)) setLanguage(preferences.data.language);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) setReady(true);
      }
    }
    void bootstrap();
    return () => {
      controller.abort();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("globeledger-language", language);
  }, [language]);

  const applyBudget = useCallback((payload: BudgetResponse, currency: string, currencyRate: number) => {
    const nextDrafts: Record<string, string> = {};
    const nextSpending: Record<string, number> = {};
    for (const item of payload.data?.budgets ?? []) {
      nextDrafts[item.category] = inputAmount(item.amountUsdMinor, currency, currencyRate);
    }
    for (const item of payload.data?.spending ?? []) {
      nextSpending[item.category] = Number(item.spentUsdMinor) || 0;
    }
    setDrafts(nextDrafts);
    setSpending(nextSpending);
  }, []);

  const loadMonth = useCallback(async (targetMonth: string, signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const materializeResponse = await fetch(
        `/api/transactions?month=${encodeURIComponent(targetMonth)}&limit=1`,
        { cache: "no-store", signal },
      );
      if (!materializeResponse.ok) throw new Error();
      const response = await fetch(`/api/budgets?month=${encodeURIComponent(targetMonth)}`, {
        cache: "no-store",
        signal,
      });
      const payload = (await response.json()) as BudgetResponse;
      if (!response.ok || !payload.data) throw new Error();
      applyBudget(payload, baseCurrency, rate);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(COPY[language].loadFailed);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [applyBudget, baseCurrency, language, rate]);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const frame = window.requestAnimationFrame(() => {
      void loadMonth(month, controller.signal);
    });
    return () => {
      controller.abort();
      window.cancelAnimationFrame(frame);
    };
  }, [loadMonth, month, ready]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const totals = useMemo(() => {
    let budgetUsdMinor = 0;
    let spentUsdMinor = 0;
    for (const category of CATEGORIES) {
      const value = Number(drafts[category]);
      if (Number.isFinite(value) && value > 0) budgetUsdMinor += Math.round(value * rate * 100);
      spentUsdMinor += spending[category] ?? 0;
    }
    return { budgetUsdMinor, spentUsdMinor, remainingUsdMinor: budgetUsdMinor - spentUsdMinor };
  }, [drafts, rate, spending]);

  const overallProgress = totals.budgetUsdMinor > 0
    ? Math.round((totals.spentUsdMinor / totals.budgetUsdMinor) * 100)
    : 0;
  const toBase = (usdMinor: number) => usdMinor / 100 / rate;

  async function saveBudgets() {
    setSaving(true);
    setError("");
    try {
      const budgets: Array<{ category: BudgetCategory; amountUsdMinor: number }> = [];
      for (const category of CATEGORIES) {
        const raw = drafts[category]?.trim();
        if (!raw) continue;
        const amount = Number(raw);
        const amountUsdMinor = Math.round(amount * rate * 100);
        if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(amountUsdMinor) || amountUsdMinor > 9_000_000_000_000) {
          throw new Error("INVALID");
        }
        budgets.push({ category, amountUsdMinor });
      }
      const response = await fetch("/api/budgets", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ month, budgets }),
      });
      if (!response.ok) throw new Error("SAVE");
      await loadMonth(month);
      setToast(copy.saved);
    } catch (caught) {
      setError(caught instanceof Error && caught.message === "INVALID" ? copy.invalid : copy.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function copyPreviousMonth() {
    setLoading(true);
    setError("");
    try {
      const previousMonth = shiftMonth(month, -1);
      await fetch(`/api/transactions?month=${previousMonth}&limit=1`, { cache: "no-store" });
      const response = await fetch(`/api/budgets?month=${previousMonth}`, { cache: "no-store" });
      const payload = (await response.json()) as BudgetResponse;
      if (!response.ok || !payload.data) throw new Error();
      const nextDrafts: Record<string, string> = {};
      for (const item of payload.data.budgets) {
        nextDrafts[item.category] = inputAmount(item.amountUsdMinor, baseCurrency, rate);
      }
      setDrafts(nextDrafts);
      setToast(copy.copied);
    } catch {
      setError(copy.loadFailed);
    } finally {
      setLoading(false);
    }
  }

  function chooseLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    void fetch("/api/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language: nextLanguage }),
    }).catch(() => undefined);
  }

  return (
    <div className="budget-page-shell">
      <main className="budget-main">
        <header className="budget-topbar">
          <div><span className="eyebrow">GlobeLedger</span><h1>{copy.title}</h1><p>{copy.subtitle}</p></div>
          <div className="budget-top-actions">
            <LanguagePicker value={language} label={copy.language} onChange={chooseLanguage} />
            <button className="primary-button budget-save" type="button" onClick={() => void saveBudgets()} disabled={saving || loading}>
              {saving ? copy.saving : copy.save}
            </button>
          </div>
        </header>

        <section className="budget-period-bar" aria-label={monthLabel(month, language)}>
          <div className="budget-month-nav">
            <button type="button" aria-label={copy.previous} onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
            <strong>{monthLabel(month, language)}</strong>
            <button type="button" aria-label={copy.next} onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
          </div>
          <div className="budget-period-actions">
            <span>{copy.baseNote}: <strong>{baseCurrency}</strong></span>
            {month !== today.slice(0, 7) && <button type="button" onClick={() => setMonth(today.slice(0, 7))}>{copy.current}</button>}
            <button type="button" onClick={() => void copyPreviousMonth()} disabled={loading}>{copy.copyPrevious}</button>
          </div>
        </section>

        <section className="budget-summary-grid">
          <article><span>{copy.totalBudget}</span><strong>{totals.budgetUsdMinor > 0 ? formatMoney(toBase(totals.budgetUsdMinor), baseCurrency, language) : "—"}</strong><small>{totals.budgetUsdMinor > 0 ? `${overallProgress}% ${copy.used}` : copy.noPlan}</small></article>
          <article className="budget-spent"><span>{copy.spent}</span><strong>{formatMoney(toBase(totals.spentUsdMinor), baseCurrency, language)}</strong><small>{monthLabel(month, language)}</small></article>
          <article className={totals.remainingUsdMinor < 0 ? "budget-over" : "budget-remaining"}><span>{copy.remaining}</span><strong>{formatMoney(toBase(totals.remainingUsdMinor), baseCurrency, language)}</strong><small>{totals.remainingUsdMinor < 0 ? copy.over : copy.baseNote}</small></article>
          <article className="budget-utilization"><span>{copy.used}</span><strong>{totals.budgetUsdMinor > 0 ? `${overallProgress}%` : "—"}</strong><div className="budget-progress"><span style={{ width: `${Math.min(overallProgress, 100)}%` }} /></div></article>
        </section>

        <section className="budget-plan-panel">
          <div className="budget-plan-heading"><div><h2>{copy.plan}</h2><p>{copy.planHint}</p></div><strong>{baseCurrency}</strong></div>
          {error && <p className="recurring-error" role="alert">{error}</p>}
          <div className={loading ? "budget-category-list loading" : "budget-category-list"} aria-busy={loading}>
            {CATEGORIES.map((category) => {
              const spentUsdMinor = spending[category] ?? 0;
              const rawBudget = Number(drafts[category]);
              const budgetUsdMinor = Number.isFinite(rawBudget) && rawBudget > 0 ? Math.round(rawBudget * rate * 100) : 0;
              const remaining = budgetUsdMinor - spentUsdMinor;
              const progress = budgetUsdMinor > 0 ? Math.round((spentUsdMinor / budgetUsdMinor) * 100) : 0;
              return (
                <article className="budget-category-row" key={category}>
                  <span className="budget-category-icon" aria-hidden="true">{GLYPHS[category]}</span>
                  <div className="budget-category-copy">
                    <strong>{CATEGORY_LABELS[category][language]}</strong>
                    <span>{copy.spent} {formatMoney(toBase(spentUsdMinor), baseCurrency, language)} · {budgetUsdMinor > 0 ? `${Math.max(0, progress)}% ${copy.used}` : copy.noBudget}</span>
                    <div className={progress > 100 ? "budget-progress over" : "budget-progress"}><span style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} /></div>
                  </div>
                  <label className="budget-amount-field">
                    <span>{copy.budget}</span>
                    <div><b>{baseCurrency}</b><input type="number" min="0" step={10 ** -(currencyExponent(baseCurrency) ?? 2)} inputMode="decimal" placeholder="0" value={drafts[category] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [category]: event.target.value }))} /></div>
                  </label>
                  <div className={remaining < 0 ? "budget-category-balance over" : "budget-category-balance"}>
                    <span>{copy.remaining}</span>
                    <strong>{budgetUsdMinor > 0 ? formatMoney(toBase(remaining), baseCurrency, language) : "—"}</strong>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
      <div className={toast ? "toast visible" : "toast"} aria-live="polite">{toast}</div>
    </div>
  );
}
