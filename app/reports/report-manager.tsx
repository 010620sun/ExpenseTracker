"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { LanguagePicker } from "@/components/language-picker";
import { CategoryIcon } from "@/components/category-icon";
import {
  categoryColor,
  categoryLabel,
  categoryPathLabel,
  subcategoryLabel,
} from "@/lib/categories";
import { currencyExponent } from "@/lib/currency";
import {
  DEFAULT_LANGUAGE,
  formatLocalizedCount,
  isLanguage,
  LANGUAGE_LOCALES,
  LANGUAGE_STORAGE_KEY,
  persistLanguagePreference,
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
  subcategories: Array<{
    category: string;
    subcategory: string;
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
    subcategory: string | null;
    expenseUsdMinor: number;
    transactionCount: number;
  }>;
  valuationBuckets: Array<{
    kind: "expense" | "income";
    occurredOn: string;
    currency: string;
    currencyExponent: number;
    fxRate: string;
    category: string;
    subcategory: string | null;
    description: string;
    originalAmountMinor: number;
    baseAmountMinor: number;
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
type HistoricalRatesResponse = {
  data?: {
    baseCurrency?: string;
    quote?: string;
    direction?: string;
    rates?: Record<string, string>;
  };
};
type ValuationMode = "historical" | "current";

const COPY = {
  en: {
    title: "Monthly report",
    subtitle: "See where your money moved and what changed from last month.",
    language: "Language",
    previous: "Previous month",
    next: "Next month",
    current: "This month",
    baseNote: "Shown in your base currency",
    valuationMode: "Exchange-rate basis",
    historicalValue: "Transaction-date rate",
    currentValue: "Current rate",
    income: "Income",
    expenses: "Expenses",
    net: "Net cash flow",
    savingsRate: "Savings rate",
    transactions: "transactions",
    activeDays: "active days",
    comparedWith: "vs. previous month",
    noComparison: "No data from the previous month",
    dailyFlow: "Daily cash flow",
    dailyHint: "Income and expenses by calendar day",
    expenseLegend: "Expense",
    incomeLegend: "Income",
    categoryBreakdown: "Spending by category",
    categoryHint: "Share of this month’s total expenses",
    subcategoryBreakdown: "Spending by subcategory",
    subcategoryHint: "Subcategories recorded this month",
    noSubcategories: "No detailed categories recorded this month.",
    currencyBreakdown: "Spending by currency",
    currencyHint: "Original amounts and base-currency equivalents",
    topMerchants: "Top spending destinations",
    topMerchantsHint: "Grouped by transaction description",
    ofExpenses: "{share}% of total expenses",
    entries: "entries",
    emptyTitle: "No activity for this month",
    emptyBody: "Add a transaction or choose another month to generate a report.",
    loadFailed: "We couldn’t load this report. Try again.",
    retry: "Retry",
    loading: "Building your report…",
    more: "{percent}% more than previous month",
    less: "{percent}% less than previous month",
    unchanged: "No change",
    topCategory: "Highest-spending category",
    averageDay: "Average spending per active day",
    noExpenses: "No expenses recorded this month.",
  },
  ko: {
    title: "월간 리포트",
    subtitle: "돈의 흐름과 지난달 대비 변화를 한눈에 확인하세요.",
    language: "언어",
    previous: "이전 달",
    next: "다음 달",
    current: "이번 달",
    baseNote: "기준 통화로 표시",
    valuationMode: "환산 기준",
    historicalValue: "거래일 환율 기준",
    currentValue: "현재 환율 기준",
    income: "수입",
    expenses: "지출",
    net: "순 현금 흐름",
    savingsRate: "저축률",
    transactions: "건의 거래",
    activeDays: "일 사용",
    comparedWith: "지난달 대비",
    noComparison: "비교할 지난달 데이터가 없습니다",
    dailyFlow: "일별 현금 흐름",
    dailyHint: "날짜별 수입과 지출",
    expenseLegend: "지출",
    incomeLegend: "수입",
    categoryBreakdown: "카테고리별 지출",
    categoryHint: "이번 달 총지출에서 차지하는 비중",
    subcategoryBreakdown: "세부 카테고리별 지출",
    subcategoryHint: "이번 달에 기록한 세부 카테고리별 지출",
    noSubcategories: "이번 달에는 세부 카테고리가 기록되지 않았습니다.",
    currencyBreakdown: "통화별 지출",
    currencyHint: "거래 통화별 원금액과 기준 통화 환산액",
    topMerchants: "주요 사용처",
    topMerchantsHint: "거래 설명을 기준으로 합산",
    ofExpenses: "총지출의 {share}%",
    entries: "건",
    emptyTitle: "이번 달 거래가 없습니다",
    emptyBody: "거래를 추가하거나 다른 달을 선택하면 리포트가 생성됩니다.",
    loadFailed: "리포트를 불러오지 못했습니다. 다시 시도해 주세요.",
    retry: "다시 시도",
    loading: "리포트 생성 중…",
    more: "지난달보다 {percent}% 증가",
    less: "지난달보다 {percent}% 감소",
    unchanged: "변화 없음",
    topCategory: "지출액 상위 카테고리",
    averageDay: "거래일 평균 지출",
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
    valuationMode: "換算レートの基準",
    historicalValue: "取引日のレート",
    currentValue: "現在のレート",
    income: "収入",
    expenses: "支出",
    net: "純キャッシュフロー",
    savingsRate: "貯蓄率",
    transactions: "件の取引",
    activeDays: "日利用",
    comparedWith: "前月比",
    noComparison: "前月のデータがありません",
    dailyFlow: "日別キャッシュフロー",
    dailyHint: "日付ごとの収入と支出",
    expenseLegend: "支出",
    incomeLegend: "収入",
    categoryBreakdown: "カテゴリー別支出",
    categoryHint: "今月の総支出に占める割合",
    subcategoryBreakdown: "サブカテゴリー別支出",
    subcategoryHint: "今月記録されたサブカテゴリー",
    noSubcategories: "今月はサブカテゴリーが記録されていません。",
    currencyBreakdown: "通貨別支出",
    currencyHint: "取引時の通貨別合計と基本通貨換算額",
    topMerchants: "主な利用先",
    topMerchantsHint: "取引の説明ごとに集計",
    ofExpenses: "総支出の{share}%",
    entries: "件",
    emptyTitle: "今月の取引はありません",
    emptyBody: "取引を追加するか、別の月を選ぶとレポートが作成されます。",
    loadFailed: "レポートを読み込めませんでした。もう一度お試しください。",
    retry: "再試行",
    loading: "レポートを作成中…",
    more: "前月より{percent}%増加",
    less: "前月より{percent}%減少",
    unchanged: "変化なし",
    topCategory: "支出額トップのカテゴリー",
    averageDay: "取引があった日の日平均支出",
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
    valuationMode: "Курс для пересчёта",
    historicalValue: "Курс на дату операции",
    currentValue: "Текущий курс",
    income: "Доходы",
    expenses: "Расходы",
    net: "Чистый денежный поток",
    savingsRate: "Доля сбережений",
    transactions: "операций",
    activeDays: "активных дней",
    comparedWith: "к прошлому месяцу",
    noComparison: "Нет данных за прошлый месяц для сравнения",
    dailyFlow: "Денежный поток по дням",
    dailyHint: "Доходы и расходы по датам",
    expenseLegend: "Расход",
    incomeLegend: "Доход",
    categoryBreakdown: "Расходы по категориям",
    categoryHint: "Доля в общих расходах месяца",
    subcategoryBreakdown: "Расходы по подкатегориям",
    subcategoryHint: "Подкатегории, использованные в этом месяце",
    noSubcategories: "В этом месяце подкатегории не использовались.",
    currencyBreakdown: "Расходы по валютам",
    currencyHint: "Исходные суммы и эквиваленты в основной валюте",
    topMerchants: "Основные места расходов",
    topMerchantsHint: "Сгруппировано по описанию операции",
    ofExpenses: "{share}% от общих расходов",
    entries: "операций",
    emptyTitle: "В этом месяце операций нет",
    emptyBody: "Добавьте операцию или выберите другой месяц, чтобы создать отчёт.",
    loadFailed: "Не удалось загрузить отчёт. Попробуйте снова.",
    retry: "Повторить",
    loading: "Формируем отчёт…",
    more: "На {percent}% больше, чем в прошлом месяце",
    less: "На {percent}% меньше, чем в прошлом месяце",
    unchanged: "Без изменений",
    topCategory: "Категория с наибольшими расходами",
    averageDay: "Среднее за активный день",
    noExpenses: "В этом месяце расходов не зафиксировано.",
  },
} as const;

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

export function ReportManager({
  today,
  initialLanguage = DEFAULT_LANGUAGE,
}: {
  today: string;
  initialLanguage?: Language;
}) {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [languageReady, setLanguageReady] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [ratesToUsd, setRatesToUsd] = useState<Record<string, number>>({ USD: 1 });
  const [month, setMonth] = useState(today.slice(0, 7));
  const [report, setReport] = useState<ReportData | null>(null);
  const [valuationMode, setValuationMode] =
    useState<ValuationMode>("historical");
  const [historicalBaseRates, setHistoricalBaseRates] =
    useState<Record<string, number>>({});
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
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (isLanguage(stored)) setLanguage(stored);
      setLanguageReady(true);
      const storedValuationMode = window.localStorage.getItem(
        "globeledger-valuation-mode",
      );
      if (storedValuationMode === "historical" || storedValuationMode === "current") {
        setValuationMode(storedValuationMode);
      }
      void bootstrap();
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
    return () => {
      controller.abort();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    if (languageReady) persistLanguagePreference(language);
  }, [language, languageReady]);

  useEffect(() => {
    window.localStorage.setItem("globeledger-valuation-mode", valuationMode);
  }, [valuationMode]);

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
      const historySearch = new URLSearchParams({
        quote: baseCurrency,
        from: `${shiftMonth(targetMonth, -1)}-01`,
        to: `${targetMonth}-${String(daysInMonth(targetMonth)).padStart(2, "0")}`,
      });
      const [response, historyResponse] = await Promise.all([
        fetch(`/api/reports?month=${encodeURIComponent(targetMonth)}`, {
          cache: "no-store",
          signal,
        }),
        fetch(`/api/rates/history?${historySearch}`, {
          cache: "no-store",
          signal,
        }),
      ]);
      const payload = (await response.json()) as ReportResponse;
      const historyPayload = (await historyResponse.json()) as HistoricalRatesResponse;
      if (!response.ok || !payload.data) throw new Error();
      const nextHistoricalRates: Record<string, number> = {};
      if (
        historyResponse.ok &&
        historyPayload.data?.baseCurrency === "USD" &&
        historyPayload.data.quote === baseCurrency &&
        historyPayload.data.direction === "USD_PER_ORIGINAL"
      ) {
        for (const [date, rawRate] of Object.entries(historyPayload.data.rates ?? {})) {
          const parsed = Number(rawRate);
          if (/^\d{4}-\d{2}-\d{2}$/u.test(date) && Number.isFinite(parsed) && parsed > 0) {
            nextHistoricalRates[date] = parsed;
          }
        }
      }
      setHistoricalBaseRates(nextHistoricalRates);
      setReport(payload.data);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(COPY[language].loadFailed);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [baseCurrency, language]);

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

  const valuedReport = useMemo(() => {
    if (!report || !report.valuationBuckets?.length) return report;

    const toPseudoUsdMinor = (amount: number) => amount * baseRate * 100;
    const bucketAmount = (bucket: ReportData["valuationBuckets"][number]) => {
      const original = bucket.originalAmountMinor / 10 ** bucket.currencyExponent;
      if (bucket.currency === baseCurrency) return original;
      if (valuationMode === "current") {
        const originalRate = ratesToUsd[bucket.currency];
        if (originalRate && baseRate > 0) return (original * originalRate) / baseRate;
      } else {
        const originalRate = Number(bucket.fxRate);
        const displayRate = historicalBaseRates[bucket.occurredOn];
        if (Number.isFinite(originalRate) && originalRate > 0 && displayRate > 0) {
          return (original * originalRate) / displayRate;
        }
      }
      return bucket.baseAmountMinor / 100 / baseRate;
    };
    const emptySummary = (): ReportSummary => ({
      incomeUsdMinor: 0,
      expenseUsdMinor: 0,
      netUsdMinor: 0,
      incomeCount: 0,
      expenseCount: 0,
      transactionCount: 0,
      activeDays: 0,
    });
    const currentSummary = emptySummary();
    const previousSummary = emptySummary();
    const currentDays = new Set<string>();
    const previousDays = new Set<string>();
    const categories = new Map<string, { amount: number; count: number }>();
    const subcategories = new Map<string, {
      category: string;
      subcategory: string;
      amount: number;
      count: number;
    }>();
    const daily = new Map<string, { income: number; expense: number; count: number }>();
    const currencies = new Map<string, {
      exponent: number;
      originalMinor: number;
      amount: number;
      count: number;
    }>();
    const merchants = new Map<string, {
      description: string;
      category: string;
      subcategory: string | null;
      amount: number;
      count: number;
    }>();

    for (const bucket of report.valuationBuckets) {
      const amount = bucketAmount(bucket);
      const pseudoUsdMinor = toPseudoUsdMinor(amount);
      const isCurrentMonth = bucket.occurredOn.slice(0, 7) === report.month;
      const summary = isCurrentMonth ? currentSummary : previousSummary;
      const activeDays = isCurrentMonth ? currentDays : previousDays;
      summary.transactionCount += bucket.transactionCount;
      activeDays.add(bucket.occurredOn);
      if (bucket.kind === "income") {
        summary.incomeUsdMinor += pseudoUsdMinor;
        summary.incomeCount += bucket.transactionCount;
      } else {
        summary.expenseUsdMinor += pseudoUsdMinor;
        summary.expenseCount += bucket.transactionCount;
      }
      if (!isCurrentMonth) continue;

      const day = daily.get(bucket.occurredOn) ?? { income: 0, expense: 0, count: 0 };
      day[bucket.kind] += pseudoUsdMinor;
      day.count += bucket.transactionCount;
      daily.set(bucket.occurredOn, day);
      if (bucket.kind === "income") continue;

      const category = categories.get(bucket.category) ?? { amount: 0, count: 0 };
      category.amount += pseudoUsdMinor;
      category.count += bucket.transactionCount;
      categories.set(bucket.category, category);

      if (bucket.subcategory) {
        const subcategoryKey = `${bucket.category}\u0000${bucket.subcategory}`;
        const detail = subcategories.get(subcategoryKey) ?? {
          category: bucket.category,
          subcategory: bucket.subcategory,
          amount: 0,
          count: 0,
        };
        detail.amount += pseudoUsdMinor;
        detail.count += bucket.transactionCount;
        subcategories.set(subcategoryKey, detail);
      }

      const currency = currencies.get(bucket.currency) ?? {
        exponent: bucket.currencyExponent,
        originalMinor: 0,
        amount: 0,
        count: 0,
      };
      currency.originalMinor += bucket.originalAmountMinor;
      currency.amount += pseudoUsdMinor;
      currency.count += bucket.transactionCount;
      currencies.set(bucket.currency, currency);

      const merchantKey = `${bucket.description}\u0000${bucket.category}\u0000${bucket.subcategory ?? ""}`;
      const merchant = merchants.get(merchantKey) ?? {
        description: bucket.description,
        category: bucket.category,
        subcategory: bucket.subcategory,
        amount: 0,
        count: 0,
      };
      merchant.amount += pseudoUsdMinor;
      merchant.count += bucket.transactionCount;
      merchants.set(merchantKey, merchant);
    }

    currentSummary.activeDays = currentDays.size;
    previousSummary.activeDays = previousDays.size;
    currentSummary.netUsdMinor =
      currentSummary.incomeUsdMinor - currentSummary.expenseUsdMinor;
    previousSummary.netUsdMinor =
      previousSummary.incomeUsdMinor - previousSummary.expenseUsdMinor;

    return {
      ...report,
      summary: currentSummary,
      previous: { ...previousSummary, month: report.previous.month },
      categories: [...categories.entries()]
        .map(([category, item]) => ({
          category,
          expenseUsdMinor: item.amount,
          transactionCount: item.count,
        }))
        .sort((left, right) => right.expenseUsdMinor - left.expenseUsdMinor),
      subcategories: [...subcategories.values()]
        .map((item) => ({
          category: item.category,
          subcategory: item.subcategory,
          expenseUsdMinor: item.amount,
          transactionCount: item.count,
        }))
        .sort((left, right) => right.expenseUsdMinor - left.expenseUsdMinor),
      daily: [...daily.entries()]
        .map(([occurredOn, item]) => ({
          occurredOn,
          incomeUsdMinor: item.income,
          expenseUsdMinor: item.expense,
          transactionCount: item.count,
        }))
        .sort((left, right) => left.occurredOn.localeCompare(right.occurredOn)),
      currencies: [...currencies.entries()]
        .map(([currency, item]) => ({
          currency,
          currencyExponent: item.exponent,
          originalAmountMinor: item.originalMinor,
          expenseUsdMinor: item.amount,
          transactionCount: item.count,
        }))
        .sort((left, right) => right.expenseUsdMinor - left.expenseUsdMinor),
      merchants: [...merchants.values()]
        .map((item) => ({
          description: item.description,
          category: item.category,
          subcategory: item.subcategory,
          expenseUsdMinor: item.amount,
          transactionCount: item.count,
        }))
        .sort((left, right) => right.expenseUsdMinor - left.expenseUsdMinor)
        .slice(0, 5),
    };
  }, [
    baseCurrency,
    baseRate,
    historicalBaseRates,
    ratesToUsd,
    report,
    valuationMode,
  ]);

  const dailySeries = useMemo(() => {
    const byDate = new Map(valuedReport?.daily.map((item) => [item.occurredOn, item]) ?? []);
    return Array.from({ length: daysInMonth(month) }, (_, index) => {
      const date = `${month}-${String(index + 1).padStart(2, "0")}`;
      return byDate.get(date) ?? {
        occurredOn: date,
        incomeUsdMinor: 0,
        expenseUsdMinor: 0,
        transactionCount: 0,
      };
    });
  }, [month, valuedReport?.daily]);
  const dailyMax = Math.max(
    1,
    ...dailySeries.flatMap((item) => [item.expenseUsdMinor, item.incomeUsdMinor]),
  );
  const summary = valuedReport?.summary;
  const expenseChange = summary
    ? changePercent(summary.expenseUsdMinor, valuedReport?.previous.expenseUsdMinor ?? 0)
    : null;
  const savingsRate = summary && summary.incomeUsdMinor > 0
    ? Math.round((summary.netUsdMinor / summary.incomeUsdMinor) * 100)
    : null;
  const topCategory = valuedReport?.categories[0];
  const isEmpty = !loading && !error && (summary?.transactionCount ?? 0) === 0;

  function categoryName(category: string) {
    return categoryLabel(category, language);
  }

  function chooseLanguage(nextLanguage: Language) {
    persistLanguagePreference(nextLanguage);
    setLanguage(nextLanguage);
    void fetch("/api/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language: nextLanguage }),
    }).catch(() => undefined);
    router.refresh();
  }

  function comparisonLabel(value: number | null) {
    if (value === null) return copy.noComparison;
    if (value === 0) return copy.unchanged;
    return (value > 0 ? copy.more : copy.less).replace(
      "{percent}",
      String(Math.abs(value)),
    );
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
            <div className="valuation-switch" role="group" aria-label={copy.valuationMode}>
              <button
                type="button"
                className={valuationMode === "historical" ? "selected" : ""}
                aria-pressed={valuationMode === "historical"}
                onClick={() => setValuationMode("historical")}
              >
                {copy.historicalValue}
              </button>
              <button
                type="button"
                className={valuationMode === "current" ? "selected" : ""}
                aria-pressed={valuationMode === "current"}
                onClick={() => setValuationMode("current")}
              >
                {copy.currentValue}
              </button>
            </div>
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
        ) : valuedReport ? (
          <div className={loading ? "report-content loading" : "report-content"} aria-busy={loading}>
            <section className="report-summary-grid" aria-label={copy.title}>
              <article className="income">
                <span>{copy.income}</span>
                <strong>{formatMoney(toBase(valuedReport.summary.incomeUsdMinor), baseCurrency, language)}</strong>
                <small>{formatLocalizedCount(valuedReport.summary.incomeCount, language, "transaction")}</small>
              </article>
              <article className="expense">
                <span>{copy.expenses}</span>
                <strong>{formatMoney(toBase(valuedReport.summary.expenseUsdMinor), baseCurrency, language)}</strong>
                <small>{comparisonLabel(expenseChange)}</small>
              </article>
              <article className={valuedReport.summary.netUsdMinor >= 0 ? "net positive" : "net negative"}>
                <span>{copy.net}</span>
                <strong>{formatMoney(toBase(valuedReport.summary.netUsdMinor), baseCurrency, language)}</strong>
                <small>{formatLocalizedCount(valuedReport.summary.activeDays, language, "activeDay")}</small>
              </article>
              <article className="savings">
                <span>{copy.savingsRate}</span>
                <strong>{savingsRate === null ? "—" : `${savingsRate}%`}</strong>
                <small>{copy.averageDay}: {formatMoney(toBase(valuedReport.summary.activeDays > 0 ? valuedReport.summary.expenseUsdMinor / valuedReport.summary.activeDays : 0), baseCurrency, language)}</small>
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
                  {valuedReport.categories.length === 0 ? <p className="report-panel-empty">{copy.noExpenses}</p> : valuedReport.categories.map((item) => {
                    const share = valuedReport.summary.expenseUsdMinor > 0
                      ? Math.round((item.expenseUsdMinor / valuedReport.summary.expenseUsdMinor) * 100)
                      : 0;
                    const color = categoryColor(item.category);
                    return (
                      <div className="report-category-row" key={item.category}>
                        <span className="report-category-glyph" style={{ backgroundColor: `${color}18`, color }} aria-hidden="true"><CategoryIcon category={item.category} /></span>
                        <div><strong>{categoryName(item.category)}</strong><span>{formatLocalizedCount(item.transactionCount, language, "entry")}</span><div className="report-progress"><i style={{ backgroundColor: color, width: `${share}%` }} /></div></div>
                        <p><strong>{formatMoney(toBase(item.expenseUsdMinor), baseCurrency, language)}</strong><span>{copy.ofExpenses.replace("{share}", String(share))}</span></p>
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
                  {valuedReport.currencies.length === 0 ? <p className="report-panel-empty">{copy.noExpenses}</p> : valuedReport.currencies.map((item) => (
                    <div className="report-currency-row" key={item.currency}>
                      <span>{item.currency.slice(0, 1)}</span>
                      <div><strong>{item.currency}</strong><small>{formatLocalizedCount(item.transactionCount, language, "entry")}</small></div>
                      <p><strong>{formatMoney(item.originalAmountMinor / 10 ** item.currencyExponent, item.currency, language)}</strong><small>{formatMoney(toBase(item.expenseUsdMinor), baseCurrency, language)}</small></p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="report-panel merchant-report-panel">
                <div className="report-panel-heading"><div><h2>{copy.topMerchants}</h2><p>{copy.topMerchantsHint}</p></div></div>
                <ol className="report-merchant-list">
                  {valuedReport.merchants.length === 0 ? <li className="report-panel-empty">{copy.noExpenses}</li> : valuedReport.merchants.map((item, index) => (
                    <li key={`${item.description}:${item.category}:${item.subcategory ?? ""}`}>
                      <span>{index + 1}</span>
                      <div><strong>{item.description}</strong><small>{categoryPathLabel(item.category, item.subcategory, language)} · {formatLocalizedCount(item.transactionCount, language, "entry")}</small></div>
                      <b>{formatMoney(toBase(item.expenseUsdMinor), baseCurrency, language)}</b>
                    </li>
                  ))}
                </ol>
              </article>
            </section>

            <section className="report-grid-detail">
              <article className="report-panel subcategory-report-panel">
                <div className="report-panel-heading"><div><h2>{copy.subcategoryBreakdown}</h2><p>{copy.subcategoryHint}</p></div></div>
                <div className="report-subcategory-list">
                  {valuedReport.subcategories.length === 0 ? (
                    <p className="report-panel-empty">{copy.noSubcategories}</p>
                  ) : valuedReport.subcategories.slice(0, 10).map((item) => {
                    const share = valuedReport.summary.expenseUsdMinor > 0
                      ? Math.round((item.expenseUsdMinor / valuedReport.summary.expenseUsdMinor) * 100)
                      : 0;
                    const color = categoryColor(item.category);
                    return (
                      <div className="report-subcategory-row" key={`${item.category}:${item.subcategory}`}>
                        <span style={{ backgroundColor: `${color}18`, color }} aria-hidden="true"><CategoryIcon category={item.category} /></span>
                        <div><strong>{subcategoryLabel(item.subcategory, language)}</strong><small>{categoryName(item.category)} · {formatLocalizedCount(item.transactionCount, language, "entry")}</small></div>
                        <p><strong>{formatMoney(toBase(item.expenseUsdMinor), baseCurrency, language)}</strong><small>{copy.ofExpenses.replace("{share}", String(share))}</small></p>
                      </div>
                    );
                  })}
                </div>
              </article>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
