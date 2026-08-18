"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { LanguagePicker } from "@/components/language-picker";
import { currencyExponent } from "@/lib/currency";
import {
  isLanguage,
  LANGUAGE_LOCALES,
  type Language,
} from "@/lib/language";

type ReportData = {
  month: string;
  baseCurrency: "USD";
  summary: ReportSummary;
  previous: ReportSummary & { month: string };
  categories: Array<{
    category: string;
    expenseUsdMinor: number;
    transactionCount: number;
  }>;
  daily: Array<{
    occurredOn: string;
    incomeUsdMinor: number;
    expenseUsdMinor: number;
    transactionCount: number;
  }>;
  currencies: Array<{
    currency: string;
    currencyExponent: number;
    originalAmountMinor: number;
    expenseUsdMinor: number;
    transactionCount: number;
  }>;
  merchants: Array<{
    description: string;
    category: string;
    expenseUsdMinor: number;
    transactionCount: number;
  }>;
};

type ReportSummary = {
  incomeUsdMinor: number;
  expenseUsdMinor: number;
  netUsdMinor: number;
  incomeCount: number;
  expenseCount: number;
  transactionCount: number;
  activeDays: number;
};

type ReportResponse = { data?: ReportData };
type PreferencesResponse = { data?: { baseCurrency?: string; language?: Language } };
type RatesResponse = {
  data?: { baseCurrency?: string; rates?: Record<string, string> };
};

const COPY = {
  en: {
    title: "Monthly report",
    subtitle: "See where your money moved and what changed from last month.",
    language: "Language",
    previous: "Previous month",
    next: "Next month",
    current: "This month",
    baseNote: "Shown in your base currency",
    income: "Income",
    expenses: "Expenses",
    net: "Net cash flow",
    savingsRate: "Savings rate",
    transactions: "transactions",
    activeDays: "active days",
    comparedWith: "vs. previous month",
    noComparison: "No previous-month baseline",
    dailyFlow: "Daily cash flow",
    dailyHint: "Income and expenses by calendar day",
    expenseLegend: "Expense",
    incomeLegend: "Income",
    categoryBreakdown: "Spending by category",
    categoryHint: "Share of this month’s total expenses",
    currencyBreakdown: "Spending by currency",
    currencyHint: "Original totals and base-currency value",
    topMerchants: "Top spending destinations",
    topMerchantsHint: "Grouped by transaction description",
    ofExpenses: "of expenses",
    entries: "entries",
    emptyTitle: "No activity for this month",
    emptyBody: "Add a transaction or choose another month to generate a report.",
    loadFailed: "We couldn’t load this report. Try again.",
    retry: "Retry",
    loading: "Building your report…",
    more: "more",
    less: "less",
    unchanged: "No change",
    topCategory: "Top category",
    averageDay: "Average per active day",
    noExpenses: "No expenses recorded this month.",
  },
  ko: {
    title: "월간 리포트",
    subtitle: "돈의 흐름과 지난달 대비 변화를 한눈에 확인하세요.",
    language: "언어",
    previous: "이전 달",
    next: "다음 달",
    current: "이번 달",
    baseNote: "기본 통화 기준으로 표시",
    income: "수입",
    expenses: "지출",
    net: "순현금흐름",
    savingsRate: "저축률",
    transactions: "건의 거래",
    activeDays: "일 사용",
    comparedWith: "지난달 대비",
    noComparison: "지난달 비교 기준 없음",
    dailyFlow: "일별 현금흐름",
    dailyHint: "날짜별 수입과 지출",
    expenseLegend: "지출",
    incomeLegend: "수입",
    categoryBreakdown: "카테고리별 지출",
    categoryHint: "이번 달 총지출에서 차지하는 비중",
    currencyBreakdown: "통화별 지출",
    currencyHint: "원 통화 합계와 기본 통화 환산액",
    topMerchants: "주요 사용처",
    topMerchantsHint: "거래 설명을 기준으로 합산",
    ofExpenses: "지출 비중",
    entries: "건",
    emptyTitle: "이번 달 거래가 없습니다",
    emptyBody: "거래를 추가하거나 다른 달을 선택하면 리포트가 생성됩니다.",
    loadFailed: "리포트를 불러오지 못했습니다. 다시 시도해 주세요.",
    retry: "다시 시도",
    loading: "리포트 생성 중…",
    more: "증가",
    less: "감소",
    unchanged: "변화 없음",
    topCategory: "최다 지출 카테고리",
    averageDay: "사용일 평균 지출",
    noExpenses: "이번 달에 기록된 지출이 없습니다.",
  },
  ja: {
    title: "月間レポート",
    subtitle: "お金の流れと前月からの変化をひと目で確認できます。",
    language: "言語",
    previous: "前の月",
    next: "次の月",
    current: "今月",
    baseNote: "基本通貨で表示",
    income: "収入",
    expenses: "支出",
    net: "純キャッシュフロー",
    savingsRate: "貯蓄率",
    transactions: "件の取引",
    activeDays: "日利用",
    comparedWith: "前月比",
    noComparison: "前月の比較基準なし",
    dailyFlow: "日別キャッシュフロー",
    dailyHint: "日付ごとの収入と支出",
    expenseLegend: "支出",
    incomeLegend: "収入",
    categoryBreakdown: "カテゴリー別支出",
    categoryHint: "今月の総支出に占める割合",
    currencyBreakdown: "通貨別支出",
    currencyHint: "元通貨の合計と基本通貨換算額",
    topMerchants: "主な利用先",
    topMerchantsHint: "取引の説明ごとに集計",
    ofExpenses: "支出の割合",
    entries: "件",
    emptyTitle: "今月の取引はありません",
    emptyBody: "取引を追加するか、別の月を選ぶとレポートが作成されます。",
    loadFailed: "レポートを読み込めませんでした。もう一度お試しください。",
    retry: "再試行",
    loading: "レポートを作成中…",
    more: "増加",
    less: "減少",
    unchanged: "変化なし",
    topCategory: "最大支出カテゴリー",
    averageDay: "利用日あたりの平均",
    noExpenses: "今月の支出は記録されていません。",
  },
  ru: {
    title: "Месячный отчёт",
    subtitle: "Следите за движением денег и изменениями относительно прошлого месяца.",
    language: "Язык",
    previous: "Предыдущий месяц",
    next: "Следующий месяц",
    current: "Текущий месяц",
    baseNote: "Суммы в основной валюте",
    income: "Доходы",
    expenses: "Расходы",
    net: "Чистый денежный поток",
    savingsRate: "Доля сбережений",
    transactions: "операций",
    activeDays: "активных дней",
    comparedWith: "к прошлому месяцу",
    noComparison: "Нет базы за прошлый месяц",
    dailyFlow: "Денежный поток по дням",
    dailyHint: "Доходы и расходы по датам",
    expenseLegend: "Расход",
    incomeLegend: "Доход",
    categoryBreakdown: "Расходы по категориям",
    categoryHint: "Доля в общих расходах месяца",
    currencyBreakdown: "Расходы по валютам",
    currencyHint: "Исходная сумма и эквивалент в основной валюте",
    topMerchants: "Основные места расходов",
    topMerchantsHint: "Сгруппировано по описанию операции",
    ofExpenses: "от расходов",
    entries: "операций",
    emptyTitle: "В этом месяце операций нет",
    emptyBody: "Добавьте операцию или выберите другой месяц, чтобы создать отчёт.",
    loadFailed: "Не удалось загрузить отчёт. Попробуйте снова.",
    retry: "Повторить",
    loading: "Формируем отчёт…",
    more: "больше",
    less: "меньше",
    unchanged: "Без изменений",
    topCategory: "Главная категория",
    averageDay: "Среднее за активный день",
    noExpenses: "В этом месяце расходов не зафиксировано.",
  },
} as const;

const CATEGORY_META: Record<string, { color: string; glyph: string; labels: Record<Language, string> }> = {
  housing: { color: "#4d6fdd", glyph: "🏠", labels: { en: "Housing", ko: "주거", ja: "住居", ru: "Жильё" } },
  groceries: { color: "#4f8f6f", glyph: "🛒", labels: { en: "Groceries", ko: "식료품", ja: "食料品", ru: "Продукты" } },
  dining: { color: "#ee6c4d", glyph: "🍽️", labels: { en: "Food & drink", ko: "식음료", ja: "飲食", ru: "Еда и напитки" } },
  transport: { color: "#d49b45", glyph: "🚆", labels: { en: "Transport", ko: "교통", ja: "交通", ru: "Транспорт" } },
  utilities: { color: "#54a7a3", glyph: "💡", labels: { en: "Utilities", ko: "공과금", ja: "光熱費", ru: "Коммунальные услуги" } },
  health: { color: "#d9687b", glyph: "🩺", labels: { en: "Health", ko: "건강·의료", ja: "健康・医療", ru: "Здоровье" } },
  education: { color: "#6d81be", glyph: "🎓", labels: { en: "Education", ko: "교육", ja: "教育", ru: "Образование" } },
  entertainment: { color: "#9b6acb", glyph: "🎬", labels: { en: "Entertainment", ko: "문화·여가", ja: "娯楽", ru: "Развлечения" } },
  travel: { color: "#2d8b9b", glyph: "✈️", labels: { en: "Travel", ko: "여행", ja: "旅行", ru: "Путешествия" } },
  shopping: { color: "#d1749c", glyph: "🛍️", labels: { en: "Shopping", ko: "쇼핑", ja: "買い物", ru: "Покупки" } },
  subscriptions: { color: "#7d78b8", glyph: "↻", labels: { en: "Subscriptions", ko: "구독", ja: "サブスクリプション", ru: "Подписки" } },
  other: { color: "#7e8b86", glyph: "•••", labels: { en: "Other", ko: "기타", ja: "その他", ru: "Другое" } },
};

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + amount, 1))
    .toISOString()
    .slice(0, 7);
}

function daysInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
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

function changePercent(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function ReportManager({ today }: { today: string }) {
  const [language, setLanguage] = useState<Language>("en");
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [ratesToUsd, setRatesToUsd] = useState<Record<string, number>>({ USD: 1 });
  const [month, setMonth] = useState(today.slice(0, 7));
  const [report, setReport] = useState<ReportData | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const copy = COPY[language];
  const baseRate = ratesToUsd[baseCurrency] ?? 1;
  const toBase = useCallback(
    (usdMinor: number) => usdMinor / 100 / baseRate,
    [baseRate],
  );

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
        const parsedRates: Record<string, number> = { USD: 1 };
        if (ratesPayload.data?.baseCurrency === "USD") {
          for (const [currency, rawRate] of Object.entries(ratesPayload.data.rates ?? {})) {
            const parsed = Number(rawRate);
            if (/^[A-Z]{3}$/u.test(currency) && Number.isFinite(parsed) && parsed > 0) {
              parsedRates[currency] = parsed;
            }
          }
        }
        const preferredBase = preferences.data?.baseCurrency;
        setRatesToUsd(parsedRates);
        setBaseCurrency(preferredBase && parsedRates[preferredBase] ? preferredBase : "USD");
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

  const loadReport = useCallback(async (targetMonth: string, signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const monthsToMaterialize = [targetMonth, shiftMonth(targetMonth, -1)];
      const materialized = await Promise.all(
        monthsToMaterialize.map((item) =>
          fetch(`/api/transactions?month=${encodeURIComponent(item)}&limit=1`, {
            cache: "no-store",
            signal,
          }),
        ),
      );
      if (materialized.some((response) => !response.ok)) throw new Error();
      const response = await fetch(`/api/reports?month=${encodeURIComponent(targetMonth)}`, {
        cache: "no-store",
        signal,
      });
      const payload = (await response.json()) as ReportResponse;
      if (!response.ok || !payload.data) throw new Error();
      setReport(payload.data);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(COPY[language].loadFailed);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const frame = window.requestAnimationFrame(() => {
      void loadReport(month, controller.signal);
    });
    return () => {
      controller.abort();
      window.cancelAnimationFrame(frame);
    };
  }, [loadReport, month, ready]);

  const dailySeries = useMemo(() => {
    const byDate = new Map(report?.daily.map((item) => [item.occurredOn, item]) ?? []);
    return Array.from({ length: daysInMonth(month) }, (_, index) => {
      const date = `${month}-${String(index + 1).padStart(2, "0")}`;
      return byDate.get(date) ?? {
        occurredOn: date,
        incomeUsdMinor: 0,
        expenseUsdMinor: 0,
        transactionCount: 0,
      };
    });
  }, [month, report?.daily]);
  const dailyMax = Math.max(
    1,
    ...dailySeries.flatMap((item) => [item.expenseUsdMinor, item.incomeUsdMinor]),
  );
  const summary = report?.summary;
  const expenseChange = summary
    ? changePercent(summary.expenseUsdMinor, report?.previous.expenseUsdMinor ?? 0)
    : null;
  const savingsRate = summary && summary.incomeUsdMinor > 0
    ? Math.round((summary.netUsdMinor / summary.incomeUsdMinor) * 100)
    : null;
  const topCategory = report?.categories[0];
  const isEmpty = !loading && !error && (summary?.transactionCount ?? 0) === 0;

  function categoryName(category: string) {
    return CATEGORY_META[category]?.labels[language] ?? category;
  }

  function chooseLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    void fetch("/api/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language: nextLanguage }),
    }).catch(() => undefined);
  }

  function comparisonLabel(value: number | null) {
    if (value === null) return copy.noComparison;
    if (value === 0) return copy.unchanged;
    return `${Math.abs(value)}% ${value > 0 ? copy.more : copy.less} · ${copy.comparedWith}`;
  }

  return (
    <div className="report-page-shell">
      <main className="report-main">
        <header className="report-topbar">
          <div>
            <span className="eyebrow">GlobeLedger</span>
            <h1>{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </div>
          <LanguagePicker value={language} label={copy.language} onChange={chooseLanguage} />
        </header>

        <section className="report-period-bar" aria-label={monthLabel(month, language)}>
          <div className="report-month-nav">
            <button type="button" aria-label={copy.previous} onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
            <strong>{monthLabel(month, language)}</strong>
            <button type="button" aria-label={copy.next} onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
          </div>
          <div className="report-period-meta">
            <span>{copy.baseNote}: <strong>{baseCurrency}</strong></span>
            {month !== today.slice(0, 7) && (
              <button type="button" onClick={() => setMonth(today.slice(0, 7))}>{copy.current}</button>
            )}
          </div>
        </section>

        {error && (
          <section className="report-state error" role="alert">
            <strong>{error}</strong>
            <button type="button" onClick={() => void loadReport(month)}>{copy.retry}</button>
          </section>
        )}

        {loading && !report ? <div className="report-loading" aria-live="polite">{copy.loading}</div> : null}

        {isEmpty ? (
          <section className="report-empty-state">
            <span aria-hidden="true">◫</span>
            <h2>{copy.emptyTitle}</h2>
            <p>{copy.emptyBody}</p>
            <button type="button" aria-label={copy.emptyBody} onClick={() => window.location.assign("/")}>＋</button>
          </section>
        ) : report ? (
          <div className={loading ? "report-content loading" : "report-content"} aria-busy={loading}>
            <section className="report-summary-grid" aria-label={copy.title}>
              <article className="income">
                <span>{copy.income}</span>
                <strong>{formatMoney(toBase(report.summary.incomeUsdMinor), baseCurrency, language)}</strong>
                <small>{report.summary.incomeCount} {copy.transactions}</small>
              </article>
              <article className="expense">
                <span>{copy.expenses}</span>
                <strong>{formatMoney(toBase(report.summary.expenseUsdMinor), baseCurrency, language)}</strong>
                <small>{comparisonLabel(expenseChange)}</small>
              </article>
              <article className={report.summary.netUsdMinor >= 0 ? "net positive" : "net negative"}>
                <span>{copy.net}</span>
                <strong>{formatMoney(toBase(report.summary.netUsdMinor), baseCurrency, language)}</strong>
                <small>{report.summary.activeDays} {copy.activeDays}</small>
              </article>
              <article className="savings">
                <span>{copy.savingsRate}</span>
                <strong>{savingsRate === null ? "—" : `${savingsRate}%`}</strong>
                <small>{copy.averageDay}: {formatMoney(toBase(report.summary.activeDays > 0 ? report.summary.expenseUsdMinor / report.summary.activeDays : 0), baseCurrency, language)}</small>
              </article>
            </section>

            <section className="report-grid-primary">
              <article className="report-panel daily-flow-panel">
                <div className="report-panel-heading">
                  <div><h2>{copy.dailyFlow}</h2><p>{copy.dailyHint}</p></div>
                  <div className="report-legend"><span className="expense">{copy.expenseLegend}</span><span className="income">{copy.incomeLegend}</span></div>
                </div>
                <div className="daily-flow-scroll">
                  <div
                    className="daily-flow-chart"
                    role="img"
                    aria-label={copy.dailyHint}
                    style={{ gridTemplateColumns: `repeat(${dailySeries.length}, minmax(13px, 1fr))` }}
                  >
                    {dailySeries.map((day, index) => (
                      <div className="daily-flow-day" key={day.occurredOn} title={`${day.occurredOn} · ${copy.expenses} ${formatMoney(toBase(day.expenseUsdMinor), baseCurrency, language)} · ${copy.income} ${formatMoney(toBase(day.incomeUsdMinor), baseCurrency, language)}`}>
                        <div className="daily-flow-bars">
                          <i className="expense" style={{ height: `${day.expenseUsdMinor ? Math.max(5, (day.expenseUsdMinor / dailyMax) * 100) : 0}%` }} />
                          <i className="income" style={{ height: `${day.incomeUsdMinor ? Math.max(5, (day.incomeUsdMinor / dailyMax) * 100) : 0}%` }} />
                        </div>
                        <small>{index + 1}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </article>

              <article className="report-panel category-report-panel">
                <div className="report-panel-heading">
                  <div><h2>{copy.categoryBreakdown}</h2><p>{copy.categoryHint}</p></div>
                  {topCategory && <span className="top-category-chip">{copy.topCategory}: {categoryName(topCategory.category)}</span>}
                </div>
                <div className="report-category-list">
                  {report.categories.length === 0 ? <p className="report-panel-empty">{copy.noExpenses}</p> : report.categories.map((item) => {
                    const share = report.summary.expenseUsdMinor > 0
                      ? Math.round((item.expenseUsdMinor / report.summary.expenseUsdMinor) * 100)
                      : 0;
                    const meta = CATEGORY_META[item.category] ?? CATEGORY_META.other;
                    return (
                      <div className="report-category-row" key={item.category}>
                        <span className="report-category-glyph" style={{ backgroundColor: `${meta.color}18`, color: meta.color }} aria-hidden="true">{meta.glyph}</span>
                        <div><strong>{categoryName(item.category)}</strong><span>{item.transactionCount} {copy.entries}</span><div className="report-progress"><i style={{ backgroundColor: meta.color, width: `${share}%` }} /></div></div>
                        <p><strong>{formatMoney(toBase(item.expenseUsdMinor), baseCurrency, language)}</strong><span>{share}% {copy.ofExpenses}</span></p>
                      </div>
                    );
                  })}
                </div>
              </article>
            </section>

            <section className="report-grid-secondary">
              <article className="report-panel currency-report-panel">
                <div className="report-panel-heading"><div><h2>{copy.currencyBreakdown}</h2><p>{copy.currencyHint}</p></div></div>
                <div className="report-currency-list">
                  {report.currencies.length === 0 ? <p className="report-panel-empty">{copy.noExpenses}</p> : report.currencies.map((item) => (
                    <div className="report-currency-row" key={item.currency}>
                      <span>{item.currency.slice(0, 1)}</span>
                      <div><strong>{item.currency}</strong><small>{item.transactionCount} {copy.entries}</small></div>
                      <p><strong>{formatMoney(item.originalAmountMinor / 10 ** item.currencyExponent, item.currency, language)}</strong><small>{formatMoney(toBase(item.expenseUsdMinor), baseCurrency, language)}</small></p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="report-panel merchant-report-panel">
                <div className="report-panel-heading"><div><h2>{copy.topMerchants}</h2><p>{copy.topMerchantsHint}</p></div></div>
                <ol className="report-merchant-list">
                  {report.merchants.length === 0 ? <li className="report-panel-empty">{copy.noExpenses}</li> : report.merchants.map((item, index) => (
                    <li key={`${item.description}:${item.category}`}>
                      <span>{index + 1}</span>
                      <div><strong>{item.description}</strong><small>{categoryName(item.category)} · {item.transactionCount} {copy.entries}</small></div>
                      <b>{formatMoney(toBase(item.expenseUsdMinor), baseCurrency, language)}</b>
                    </li>
                  ))}
                </ol>
              </article>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
