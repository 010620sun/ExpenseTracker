"use client";

import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { currencyExponent } from "@/lib/currency";
import {
  MAX_INSTALLMENT_COUNT,
  installmentPaymentMinor,
  installmentRemainingMinor,
  shiftInstallmentDate,
} from "@/lib/installments";
import { LanguagePicker } from "@/components/language-picker";
import {
  categoryColor,
  categoryGlyph,
  categoryGroupLabel,
  categoryGroupsForKind,
  categoryIdsForKind,
  categoryLabel,
  categoryPathLabel,
  isExpenseCategory,
  isIncomeCategory,
  subcategoryIdsForCategory,
  subcategoryLabel,
} from "@/lib/categories";
import {
  DEFAULT_LANGUAGE,
  formatLocalizedCount,
  isLanguage,
  LANGUAGE_LOCALES,
  LANGUAGE_STORAGE_KEY,
  persistLanguagePreference,
  type Language,
} from "@/lib/language";

type CurrencyCode = string;
type TransactionKind = "expense" | "income";
type RecurrenceFrequency = "weekly" | "monthly" | "yearly";
type ValuationMode = "historical" | "current";

type CurrencyMetadata = {
  code: CurrencyCode;
  name: string;
  symbol: string;
  exponent: number;
};

type LedgerTransaction = {
  id: string;
  kind: TransactionKind;
  occurredOn: string;
  amount?: string;
  originalAmountMinor: number;
  originalCurrency: CurrencyCode;
  originalExponent: number;
  fxRate: string;
  exchangeRateSource?: "identity" | "manual" | "sample" | "frankfurter";
  rateDate?: string | null;
  baseAmountMinor: number;
  baseCurrency: "USD";
  category: string;
  subcategory?: string | null;
  description: string;
  note?: string | null;
  recurringSeriesId?: string | null;
  recurrenceDate?: string | null;
  isRecurring?: boolean;
  splitGroupId?: string | null;
  splitIndex?: number | null;
  splitCount?: number | null;
  isDistributed?: boolean;
  installmentGroupId?: string | null;
  installmentIndex?: number | null;
  installmentCount?: number | null;
  installmentTotalOriginalMinor?: number | null;
  isInstallment?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type TransactionApiResponse = {
  data?: LedgerTransaction[] | LedgerTransaction;
  transaction?: LedgerTransaction;
  pagination?: { nextCursor?: string | null };
  error?: { code?: string; field?: string };
};

type RatesPayload = {
  base?: string;
  baseCurrency?: string;
  direction?: string;
  asOf: string;
  fetchedAt: string;
  source: string;
  stale: boolean;
  rates: Record<string, string>;
  rateDates?: Record<string, string>;
  currencies?: CurrencyMetadata[];
};

type RatesApiResponse = RatesPayload & {
  data?: RatesPayload;
};

type HistoricalRatesApiResponse = {
  data?: {
    baseCurrency?: string;
    quote?: string;
    direction?: string;
    rates?: Record<string, string>;
  };
};

type PreferencesApiResponse = {
  data?: {
    baseCurrency?: string;
    lastTransactionCurrency?: string;
    language?: Language;
  };
};

type BudgetApiResponse = {
  data?: { totalBudgetUsdMinor?: number };
};

type RateStatus = "updating" | "updated" | "stale" | "error";

type RateMeta = {
  status: RateStatus;
  asOf: string | null;
  fetchedAt: string | null;
  rateDates: Record<CurrencyCode, string>;
};

type FormRateSnapshot = {
  requestedDate: string | null;
  status: "idle" | "loading" | "ready" | "error";
  rates: Record<CurrencyCode, number>;
  rateDates: Record<CurrencyCode, string>;
  asOf: string | null;
};

const FALLBACK_CURRENCIES = {
  USD: { name: "US Dollar", exponent: 2, rateToUsd: 1 },
  KRW: { name: "South Korean Won", exponent: 0, rateToUsd: 0.000722 },
  EUR: { name: "Euro", exponent: 2, rateToUsd: 1.154 },
  JPY: { name: "Japanese Yen", exponent: 0, rateToUsd: 0.00681 },
  GBP: { name: "British Pound", exponent: 2, rateToUsd: 1.335 },
  SGD: { name: "Singapore Dollar", exponent: 2, rateToUsd: 0.778 },
  CAD: { name: "Canadian Dollar", exponent: 2, rateToUsd: 0.729 },
  AUD: { name: "Australian Dollar", exponent: 2, rateToUsd: 0.648 },
} as const;

const FALLBACK_RATES_TO_USD = Object.fromEntries(
  Object.entries(FALLBACK_CURRENCIES).map(([code, details]) => [code, details.rateToUsd]),
) as Record<CurrencyCode, number>;

const FALLBACK_CURRENCY_CATALOG: CurrencyMetadata[] = Object.entries(
  FALLBACK_CURRENCIES,
).map(([code, details]) => ({
  code,
  name: details.name,
  symbol: code,
  exponent: details.exponent,
}));

const POPULAR_CURRENCY_CODES = [
  "USD",
  "KRW",
  "EUR",
  "JPY",
  "GBP",
  "CNY",
  "CAD",
  "AUD",
  "SGD",
  "CHF",
  "HKD",
  "THB",
] as const;

const CURRENCY_SEARCH_ALIASES: Record<string, string> = {
  USD: "united states america usa 미국 달러",
  KRW: "south korea korean 대한민국 한국 원화 원",
  EUR: "europe eurozone 유럽 유로",
  JPY: "japan japanese 일본 엔화 엔",
  GBP: "united kingdom britain british 영국 파운드",
  CNY: "china chinese 중국 위안화 위안",
  CAD: "canada canadian 캐나다 달러",
  AUD: "australia australian 호주 달러",
  SGD: "singapore 싱가포르 달러",
  CHF: "switzerland swiss 스위스 프랑",
  HKD: "hong kong 홍콩 달러",
  THB: "thailand thai 태국 바트",
};

type CurrencyPickerCopy = {
  search: string;
  searchPlaceholder: string;
  popular: string;
  all: string;
  results: string;
  empty: string;
};

function normalizeCurrencySearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase()
    .trim();
}

function CurrencyPicker({
  value,
  catalog,
  onChange,
  language,
  label,
  pickerCopy,
  className = "",
}: {
  value: CurrencyCode;
  catalog: CurrencyMetadata[];
  onChange: (currency: CurrencyCode) => void;
  language: Language;
  label: string;
  pickerCopy: CurrencyPickerCopy;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const listboxId = useId();
  const triggerId = useId();

  const displayNames = useMemo(
    () =>
      typeof Intl.DisplayNames === "function"
        ? new Intl.DisplayNames([LANGUAGE_LOCALES[language]], {
            type: "currency",
          })
        : null,
    [language],
  );

  const currencies = useMemo(
    () =>
      catalog.map((metadata) => {
        const localizedName = displayNames?.of(metadata.code) ?? metadata.name;
        return {
          metadata,
          localizedName,
          searchable: normalizeCurrencySearch(
            `${metadata.code} ${metadata.name} ${localizedName} ${metadata.symbol} ${CURRENCY_SEARCH_ALIASES[metadata.code] ?? ""}`,
          ),
        };
      }),
    [catalog, displayNames],
  );

  const normalizedQuery = normalizeCurrencySearch(query);
  const filtered = useMemo(
    () =>
      currencies.filter((currency) =>
        currency.searchable.includes(normalizedQuery),
      ),
    [currencies, normalizedQuery],
  );
  const popular = POPULAR_CURRENCY_CODES.flatMap((code) => {
    const match = currencies.find((currency) => currency.metadata.code === code);
    return match ? [match] : [];
  });
  const popularCodes = new Set(popular.map((currency) => currency.metadata.code));
  const remaining = currencies
    .filter((currency) => !popularCodes.has(currency.metadata.code))
    .sort((left, right) =>
      left.localizedName.localeCompare(right.localizedName, language),
    );
  const visibleCurrencies = normalizedQuery
    ? filtered
    : [...popular, ...remaining];
  const selected =
    currencies.find((currency) => currency.metadata.code === value) ??
    currencies[0];

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    });
    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [isOpen]);

  function closePicker() {
    setIsOpen(false);
    setQuery("");
  }

  function chooseCurrency(code: CurrencyCode) {
    onChange(code);
    closePicker();
  }

  function renderOptions(
    items: typeof currencies,
    heading: string,
  ) {
    if (items.length === 0) return null;
    return (
      <section className="currency-option-section">
        <strong>{heading}</strong>
        {items.map((currency) => {
          const index = visibleCurrencies.findIndex(
            (item) => item.metadata.code === currency.metadata.code,
          );
          const isSelected = currency.metadata.code === value;
          return (
            <button
              key={currency.metadata.code}
              ref={(node) => {
                optionRefs.current[currency.metadata.code] = node;
              }}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={isSelected ? "currency-option selected" : "currency-option"}
              onClick={() => chooseCurrency(currency.metadata.code)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closePicker();
                  document.getElementById(triggerId)?.focus();
                } else if (event.key === "ArrowDown") {
                  event.preventDefault();
                  const next = visibleCurrencies[(index + 1) % visibleCurrencies.length];
                  if (next) optionRefs.current[next.metadata.code]?.focus();
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  const previous =
                    visibleCurrencies[
                      (index - 1 + visibleCurrencies.length) %
                        visibleCurrencies.length
                    ];
                  if (previous) optionRefs.current[previous.metadata.code]?.focus();
                }
              }}
            >
              <span className="currency-code">{currency.metadata.code}</span>
              <span className="currency-option-name">
                <strong>{currency.localizedName}</strong>
                {language === "en" && currency.localizedName !== currency.metadata.name && (
                  <small>{currency.metadata.name}</small>
                )}
              </span>
              <span className="currency-symbol" aria-hidden="true">
                {currency.metadata.symbol}
              </span>
              {isSelected && <i aria-hidden="true">✓</i>}
            </button>
          );
        })}
      </section>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`currency-picker ${className}`.trim()}
    >
      <span className="currency-picker-label">{label}</span>
      <button
        id={triggerId}
        type="button"
        className="currency-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="currency-code">{selected?.metadata.code ?? value}</span>
        <span className="currency-trigger-name">
          {selected?.localizedName ?? value}
        </span>
        <span className="currency-chevron" aria-hidden="true">⌄</span>
      </button>
      {isOpen && (
        <div className="currency-popover">
          <label className="currency-search">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">{pickerCopy.search}</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              placeholder={pickerCopy.searchPlaceholder}
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closePicker();
                  document.getElementById(triggerId)?.focus();
                } else if (event.key === "ArrowDown" && visibleCurrencies.length > 0) {
                  event.preventDefault();
                  const first = visibleCurrencies[0];
                  if (first) optionRefs.current[first.metadata.code]?.focus();
                }
              }}
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label={pickerCopy.search}>
                ×
              </button>
            )}
          </label>
          <div id={listboxId} className="currency-listbox" role="listbox" aria-label={label}>
            {normalizedQuery ? (
              filtered.length > 0 ? (
                renderOptions(filtered, `${pickerCopy.results} · ${filtered.length}`)
              ) : (
                <p className="currency-empty">{pickerCopy.empty}</p>
              )
            ) : (
              <>
                {renderOptions(popular, pickerCopy.popular)}
                {renderOptions(remaining, pickerCopy.all)}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const FALLBACK_TRANSACTIONS: LedgerTransaction[] = [
  {
    id: "preview-1",
    kind: "expense",
    occurredOn: "2026-08-06",
    originalAmountMinor: 7500,
    originalCurrency: "KRW",
    originalExponent: 0,
    fxRate: "0.000722",
    baseAmountMinor: 542,
    baseCurrency: "USD",
    category: "dining",
    description: "COEX Coffee",
  },
  {
    id: "preview-2",
    kind: "expense",
    occurredOn: "2026-08-05",
    originalAmountMinor: 4990,
    originalCurrency: "EUR",
    originalExponent: 2,
    fxRate: "1.154",
    baseAmountMinor: 5758,
    baseCurrency: "USD",
    category: "transport",
    description: "DB Bahn",
  },
  {
    id: "preview-3",
    kind: "expense",
    occurredOn: "2026-08-04",
    originalAmountMinor: 8642,
    originalCurrency: "USD",
    originalExponent: 2,
    fxRate: "1",
    baseAmountMinor: 8642,
    baseCurrency: "USD",
    category: "groceries",
    description: "Whole Foods",
  },
  {
    id: "preview-4",
    kind: "expense",
    occurredOn: "2026-08-03",
    originalAmountMinor: 2400,
    originalCurrency: "JPY",
    originalExponent: 0,
    fxRate: "0.00681",
    baseAmountMinor: 1634,
    baseCurrency: "USD",
    category: "transport",
    description: "Suica",
  },
  {
    id: "preview-5",
    kind: "expense",
    occurredOn: "2026-08-01",
    originalAmountMinor: 185000,
    originalCurrency: "USD",
    originalExponent: 2,
    fxRate: "1",
    baseAmountMinor: 185000,
    baseCurrency: "USD",
    category: "housing",
    description: "Maple Apartments",
  },
  {
    id: "preview-6",
    kind: "income",
    occurredOn: "2026-08-01",
    originalAmountMinor: 320000,
    originalCurrency: "EUR",
    originalExponent: 2,
    fxRate: "1.154",
    baseAmountMinor: 369280,
    baseCurrency: "USD",
    category: "income",
    description: "Acme Studio",
  },
];

const COPY = {
  en: {
    overview: "Overview",
    monthOverview: "{month} overview",
    transactions: "Transactions",
    budgets: "Budgets",
    reports: "Reports",
    settings: "Settings",
    greeting: "Welcome back, {name}.",
    greetingFallback: "Welcome back.",
    subtitle: "Every currency, one clear picture.",
    transactionsSubtitle: "Your complete transaction history.",
    baseCurrency: "Base currency",
    currencySearch: "Search currencies",
    currencySearchPlaceholder: "Search currency code or name",
    popularCurrencies: "Popular currencies",
    allCurrencies: "All currencies",
    currencyResults: "Search results",
    noCurrencies: "No matching currencies found.",
    sync: "Rates saved per transaction",
    rateProvider: "Frankfurter reference rates",
    rateLatest: "Latest available reference rates",
    valuationMode: "Exchange-rate basis",
    historicalValue: "Transaction-date rate",
    currentValue: "Current rate",
    historicalUnavailable: "Some transaction-date rates are unavailable",
    transactionRateLoading: "Loading the transaction-date rate…",
    transactionRateError: "The transaction-date rate is unavailable. Try again shortly.",
    futureRateNotice: "Future transaction: the latest available rate will be saved.",
    rateUpdating: "Updating reference rates…",
    rateStale: "Using last available rate dated {date}",
    rateError: "Connection failed · using fallback rates",
    rateDate: "Rate date",
    fetchedAt: "Fetched",
    fallbackRate: "Fallback rate",
    identityRate: "USD reference rate",
    sameCurrencyRate: "No conversion",
    syncing: "Syncing your ledger",
    synced: "Ledger synced",
    addExpense: "Add transaction",
    spent: "Spent this month",
    across: "Across {count}",
    budgetLeft: "Budget left",
    ofBudget: "used",
    setBudget: "Set a monthly budget",
    netFlow: "Net flow",
    incomeMinusSpend: "Income minus spending",
    activeCurrencies: "Active currencies",
    originalAmounts: "Original amounts preserved",
    spendingBreakdown: "Spending breakdown",
    byCategory: "By category · converted to {currency}",
    currencyMix: "Currency mix",
    originalSpend: "Share of spending by transaction currency",
    recent: "Recent transactions",
    recentHint: "Original amount and {currency} value",
    allActivity: "All activity",
    searchTransactions: "Search transactions",
    searchTransactionPlaceholder: "Search merchant, note, category, or currency",
    allTypes: "All types",
    allCategories: "All categories",
    clearFilters: "Clear filters",
    filterResults: "{count} results",
    noFilterResults: "No transactions match these filters.",
    merchant: "Merchant, payer, or description",
    merchantPlaceholderExpense: "e.g. Corner Cafe",
    merchantPlaceholderIncome: "e.g. Acme Studio",
    category: "Category",
    chooseCategory: "Choose a category",
    categoryHint: "Choose the closest match for this transaction.",
    subcategory: "Subcategory (optional)",
    subcategoryHint: "Add a more precise label, or leave it unset.",
    noSubcategory: "None",
    date: "Date",
    amount: "Amount",
    currency: "Currency",
    converted: "Converted amount",
    savedRate: "The rate is saved with this transaction.",
    save: "Save transaction",
    saving: "Saving…",
    cancel: "Cancel",
    close: "Close",
    expense: "Expense",
    income: "Income",
    drawerTitle: "Add a transaction",
    drawerSubtitle: "Keep the original amount. We’ll save its USD rate for a stable history.",
    amountError: "Enter an amount greater than 0.",
    dateError: "Choose a valid transaction date.",
    requiredError: "Add a merchant or description.",
    saved: "Transaction added.",
    deleted: "Transaction removed.",
    saveFailed: "We couldn’t save that transaction. Try again.",
    deleteFailed: "We couldn’t remove that transaction.",
    signInNeeded: "Sign in to save your private ledger.",
    previewMode: "Showing preview data while your ledger reconnects.",
    empty: "No transactions yet. Add your first one.",
    language: "Language",
    privateLedger: "Your private global ledger",
    logout: "Log out",
    helpTitle: "Built for borderless lives",
    helpBody: "Original amounts stay intact, while one base view keeps your budget honest.",
    learnMore: "How conversions work",
    menu: "Open navigation",
    deleteLabel: "Delete {merchant}",
    convertedTo: "in {currency}",
    repeatTransaction: "Repeat this transaction",
    repeatHint: "Create future entries automatically on the calendar.",
    repeatFrequency: "Repeats",
    weekly: "Every week",
    monthly: "Every month",
    yearly: "Every year",
    repeatEnds: "Ends on (optional)",
    recurringEntry: "Recurring entry",
    recurringEditHint: "Changes apply only to this occurrence.",
    stopRecurring: "Stop future repeats",
    stopRecurringConfirm: "Stop repeats after this occurrence? Past entries will remain.",
    recurringStopped: "Future repeats stopped.",
    recurringStopFailed: "We couldn’t stop the recurring transaction.",
    recurrenceDateError: "The repeat end date must be on or after the first transaction.",
    distributeExpense: "Distribute across dates",
    distributeHint: "Split one total into consecutive daily entries.",
    distributionCount: "Number of days",
    distributionPreview: "Distribution preview",
    distributionRange: "{count} days · {start} to {end}",
    distributionEach: "About {amount} per day · total stays {total}",
    distributionError: "Choose between 2 and 365 days, with at least one minor currency unit per day.",
    distributionSaved: "Expense distributed across the selected dates.",
    distributedEntry: "Distributed expense {part}/{count}",
    distributionEditHint: "Changes apply only to this date. Deleting removes the entire distribution.",
    deleteDistributedConfirm: "Delete all {count} distributed entries for {merchant}?",
    installmentExpense: "Pay in installments",
    installmentHint: "Split the total into monthly charges, starting on this date.",
    installmentCount: "Number of payments",
    installmentPreview: "Installment preview",
    installmentRange: "{count} payments · {start} to {end}",
    installmentEach: "First payment {amount} · total stays {total}",
    installmentRateHint: "All payments preserve the exchange rate captured for the purchase.",
    installmentError: "Choose 2–120 payments, with at least one minor currency unit per payment.",
    installmentSaved: "Installment plan added to the calendar.",
    installmentEntry: "Installment {part}/{count}",
    installmentRemaining: "{amount} remaining after this payment",
    installmentEditHint: "Changes apply only to this payment. Deleting removes the entire installment plan.",
    deleteInstallmentConfirm: "Delete all {count} installments for {merchant}?",
  },
  ko: {
    overview: "대시보드",
    monthOverview: "{month} 요약",
    transactions: "거래 내역",
    budgets: "예산",
    reports: "리포트",
    settings: "설정",
    greeting: "{name}님, 다시 오신 것을 환영합니다.",
    greetingFallback: "다시 오신 것을 환영합니다.",
    subtitle: "모든 통화를 한눈에 명확하게.",
    transactionsSubtitle: "모든 거래 내역을 한곳에서 확인하세요.",
    baseCurrency: "기준 통화",
    currencySearch: "통화 검색",
    currencySearchPlaceholder: "통화 코드 또는 이름 검색",
    popularCurrencies: "자주 쓰는 통화",
    allCurrencies: "전체 통화",
    currencyResults: "검색 결과",
    noCurrencies: "일치하는 통화를 찾지 못했습니다.",
    sync: "거래별 환율 저장",
    rateProvider: "Frankfurter 기준 환율",
    rateLatest: "사용 가능한 최신 기준 환율",
    valuationMode: "환산 기준",
    historicalValue: "거래일 환율 기준",
    currentValue: "현재 환율 기준",
    historicalUnavailable: "일부 거래일 환율을 불러오지 못했습니다",
    transactionRateLoading: "거래일 기준 환율을 불러오는 중…",
    transactionRateError: "거래일 기준 환율을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    futureRateNotice: "미래 거래에는 현재 이용 가능한 최신 환율을 저장합니다.",
    rateUpdating: "기준 환율 업데이트 중…",
    rateStale: "{date} 기준 마지막 가용 환율 사용 중",
    rateError: "연결 실패 · 예비 환율 사용 중",
    rateDate: "기준일",
    fetchedAt: "업데이트 시각",
    fallbackRate: "예비 환율",
    identityRate: "USD 기준 환율",
    sameCurrencyRate: "환산 없음",
    syncing: "가계부 동기화 중",
    synced: "가계부 동기화 완료",
    addExpense: "거래 추가",
    spent: "이번 달 지출",
    across: "{count} 합산",
    budgetLeft: "남은 예산",
    ofBudget: "사용",
    setBudget: "월 예산 설정하기",
    netFlow: "순 현금 흐름",
    incomeMinusSpend: "수입에서 지출을 뺀 금액",
    activeCurrencies: "사용 통화",
    originalAmounts: "원 결제 금액 그대로 보관",
    spendingBreakdown: "지출 분석",
    byCategory: "카테고리별 · {currency} 환산",
    currencyMix: "통화 구성",
    originalSpend: "거래 통화별 지출 비중",
    recent: "최근 거래",
    recentHint: "원 결제 금액과 {currency} 환산 금액",
    allActivity: "전체 내역",
    searchTransactions: "거래 검색",
    searchTransactionPlaceholder: "사용처, 메모, 카테고리 또는 통화 검색",
    allTypes: "전체 유형",
    allCategories: "전체 카테고리",
    clearFilters: "필터 초기화",
    filterResults: "{count}건의 결과",
    noFilterResults: "조건에 맞는 거래가 없습니다.",
    merchant: "거래처 또는 설명",
    merchantPlaceholderExpense: "예: 동네 카페",
    merchantPlaceholderIncome: "예: 프로젝트 대금",
    category: "카테고리",
    chooseCategory: "카테고리 선택",
    categoryHint: "이 거래에 가장 알맞은 항목을 선택하세요.",
    subcategory: "세부 카테고리(선택)",
    subcategoryHint: "필요한 경우에만 더 구체적인 항목을 선택하세요.",
    noSubcategory: "선택 안 함",
    date: "날짜",
    amount: "금액",
    currency: "통화",
    converted: "환산 금액",
    savedRate: "이 환율은 거래와 함께 저장됩니다.",
    save: "거래 저장",
    saving: "저장 중…",
    cancel: "취소",
    close: "닫기",
    expense: "지출",
    income: "수입",
    drawerTitle: "거래 추가",
    drawerSubtitle: "원 결제 금액과 당시 USD 환율을 함께 저장해 과거 기록을 안정적으로 유지합니다.",
    amountError: "0보다 큰 금액을 입력하세요.",
    dateError: "올바른 거래 날짜를 선택하세요.",
    requiredError: "사용처나 설명을 입력하세요.",
    saved: "거래가 추가되었습니다.",
    deleted: "거래가 삭제되었습니다.",
    saveFailed: "거래를 저장하지 못했습니다. 다시 시도해 주세요.",
    deleteFailed: "거래를 삭제하지 못했습니다.",
    signInNeeded: "로그인하면 나만의 가계부에 저장할 수 있습니다.",
    previewMode: "가계부를 다시 연결하는 동안 예시 데이터를 표시합니다.",
    empty: "아직 거래가 없습니다. 첫 거래를 추가해 보세요.",
    language: "언어",
    privateLedger: "나만의 글로벌 가계부",
    logout: "로그아웃",
    helpTitle: "국경 없는 일상을 위해",
    helpBody: "원 결제 금액은 그대로, 기준 통화로는 예산을 분명하게 관리하세요.",
    learnMore: "환산 방식 보기",
    menu: "내비게이션 열기",
    deleteLabel: "{merchant} 삭제",
    convertedTo: "{currency} 기준",
    repeatTransaction: "이 거래를 반복",
    repeatHint: "앞으로의 거래를 달력에 자동으로 생성합니다.",
    repeatFrequency: "반복 주기",
    weekly: "매주",
    monthly: "매월",
    yearly: "매년",
    repeatEnds: "종료일(선택)",
    recurringEntry: "반복 거래",
    recurringEditHint: "변경 내용은 이번 거래에만 적용됩니다.",
    stopRecurring: "향후 반복 중단",
    stopRecurringConfirm: "이번 거래 이후의 반복을 중단할까요? 지난 거래는 유지됩니다.",
    recurringStopped: "향후 반복을 중단했습니다.",
    recurringStopFailed: "반복 거래를 중단하지 못했습니다.",
    recurrenceDateError: "반복 종료일은 첫 거래일과 같거나 이후여야 합니다.",
    distributeExpense: "날짜별로 분배",
    distributeHint: "하나의 총액을 연속된 날짜의 일별 거래로 나눕니다.",
    distributionCount: "일수",
    distributionPreview: "분배 미리보기",
    distributionRange: "{count}일 · {start}~{end}",
    distributionEach: "하루 약 {amount} · 총액 {total} 유지",
    distributionError: "2~365일을 선택하고, 하루 금액이 통화 최소 단위 이상이 되게 해주세요.",
    distributionSaved: "선택한 날짜에 지출을 분배했습니다.",
    distributedEntry: "분할 지출 {part}/{count}",
    distributionEditHint: "변경은 이 날짜에만 적용됩니다. 삭제하면 전체 분할 거래가 삭제됩니다.",
    deleteDistributedConfirm: "{merchant}의 분할 거래 {count}건을 모두 삭제할까요?",
    installmentExpense: "할부 결제",
    installmentHint: "총 결제 금액을 이 날짜부터 매월 나누어 기록합니다.",
    installmentCount: "할부 개월",
    installmentPreview: "할부 미리보기",
    installmentRange: "{count}개월 · {start}~{end}",
    installmentEach: "첫 회차 {amount} · 총액 {total} 유지",
    installmentRateHint: "모든 회차에는 구매 시점에 저장한 동일한 환율을 적용합니다.",
    installmentError: "2~120개월을 선택하고, 회차별 금액이 통화 최소 단위 이상이 되게 해주세요.",
    installmentSaved: "할부 결제를 달력에 추가했습니다.",
    installmentEntry: "할부 {part}/{count}",
    installmentRemaining: "이 회차 결제 후 {amount} 남음",
    installmentEditHint: "변경은 이 회차에만 적용됩니다. 삭제하면 전체 할부 내역이 삭제됩니다.",
    deleteInstallmentConfirm: "{merchant}의 할부 {count}건을 모두 삭제할까요?",
  },
  ja: {
    overview: "ダッシュボード",
    monthOverview: "{month}の概要",
    transactions: "取引履歴",
    budgets: "予算",
    reports: "レポート",
    settings: "設定",
    greeting: "{name}さん、おかえりなさい。",
    greetingFallback: "おかえりなさい。",
    subtitle: "すべての通貨を、ひと目で明確に。",
    transactionsSubtitle: "すべての取引履歴を一か所で確認。",
    baseCurrency: "基準通貨",
    currencySearch: "通貨を検索",
    currencySearchPlaceholder: "通貨コードまたは名称で検索",
    popularCurrencies: "よく使われる通貨",
    allCurrencies: "すべての通貨",
    currencyResults: "検索結果",
    noCurrencies: "該当する通貨が見つかりません。",
    sync: "取引ごとに為替レートを保存",
    rateProvider: "Frankfurterの参照レート",
    rateLatest: "利用可能な最新の参照レート",
    valuationMode: "換算基準",
    historicalValue: "取引日時点",
    currentValue: "現在レート換算",
    historicalUnavailable: "一部の取引日レートを取得できませんでした",
    transactionRateLoading: "取引日のレートを取得中…",
    transactionRateError: "取引日のレートを取得できません。しばらくしてから再試行してください。",
    futureRateNotice: "未来の取引には、現時点で取得可能な最新レートを保存します。",
    rateUpdating: "参照レートを更新中…",
    rateStale: "{date}時点で取得可能な最新レートを使用中",
    rateError: "接続に失敗しました · 代替レートを使用中",
    rateDate: "レート基準日",
    fetchedAt: "取得日時",
    fallbackRate: "代替レート",
    identityRate: "USD基準レート",
    sameCurrencyRate: "換算なし",
    syncing: "家計簿を同期中",
    synced: "家計簿を同期しました",
    addExpense: "取引を追加",
    spent: "今月の支出",
    across: "{count}の合計",
    budgetLeft: "残り予算",
    ofBudget: "消化済み",
    setBudget: "月間予算を設定",
    netFlow: "純収支",
    incomeMinusSpend: "収入から支出を差し引いた額",
    activeCurrencies: "使用中の通貨",
    originalAmounts: "元の金額をそのまま保存",
    spendingBreakdown: "支出の内訳",
    byCategory: "カテゴリー別 · {currency}換算",
    currencyMix: "通貨の構成",
    originalSpend: "取引時の通貨別支出割合",
    recent: "最近の取引",
    recentHint: "元の金額と{currency}換算額",
    allActivity: "すべての履歴",
    searchTransactions: "取引を検索",
    searchTransactionPlaceholder: "取引先・説明、メモ、カテゴリー、通貨を検索",
    allTypes: "すべての種類",
    allCategories: "すべてのカテゴリー",
    clearFilters: "フィルターを解除",
    filterResults: "{count}件",
    noFilterResults: "条件に一致する取引はありません。",
    merchant: "取引先または内容",
    merchantPlaceholderExpense: "例：近所のカフェ",
    merchantPlaceholderIncome: "例：業務委託料",
    category: "カテゴリー",
    chooseCategory: "カテゴリーを選択",
    categoryHint: "この取引に最も合う項目を選んでください。",
    subcategory: "サブカテゴリー（任意）",
    subcategoryHint: "必要な場合のみ、より具体的な項目を選択してください。",
    noSubcategory: "未指定",
    date: "日付",
    amount: "金額",
    currency: "通貨",
    converted: "換算額",
    savedRate: "このレートは取引と一緒に保存されます。",
    save: "取引を保存",
    saving: "保存中…",
    cancel: "キャンセル",
    close: "閉じる",
    expense: "支出",
    income: "収入",
    drawerTitle: "取引を追加",
    drawerSubtitle: "元の金額と取引時のUSD換算レートを保存し、履歴を正確に維持します。",
    amountError: "0より大きい金額を入力してください。",
    dateError: "有効な取引日を選択してください。",
    requiredError: "店舗名または説明を入力してください。",
    saved: "取引を追加しました。",
    deleted: "取引を削除しました。",
    saveFailed: "取引を保存できませんでした。もう一度お試しください。",
    deleteFailed: "取引を削除できませんでした。",
    signInNeeded: "ログインすると自分の家計簿に保存できます。",
    previewMode: "家計簿に再接続するまでサンプルデータを表示しています。",
    empty: "取引はまだありません。最初の取引を追加しましょう。",
    language: "言語",
    privateLedger: "自分だけのグローバル家計簿",
    logout: "ログアウト",
    helpTitle: "国境を越える暮らしのために",
    helpBody: "元の金額はそのままに、基準通貨で予算を明確に管理できます。",
    learnMore: "換算方法を見る",
    menu: "ナビゲーションを開く",
    deleteLabel: "{merchant}を削除",
    convertedTo: "{currency}換算",
    repeatTransaction: "この取引を定期登録",
    repeatHint: "今後の取引をカレンダーに自動作成します。",
    repeatFrequency: "繰り返し頻度",
    weekly: "毎週",
    monthly: "毎月",
    yearly: "毎年",
    repeatEnds: "終了日（任意）",
    recurringEntry: "定期取引",
    recurringEditHint: "変更は今回の取引にのみ適用されます。",
    stopRecurring: "今後の繰り返しを停止",
    stopRecurringConfirm: "この取引以降の繰り返しを停止しますか？過去の取引は残ります。",
    recurringStopped: "今後の繰り返しを停止しました。",
    recurringStopFailed: "定期取引を停止できませんでした。",
    recurrenceDateError: "終了日は最初の取引日以降にしてください。",
    distributeExpense: "日付ごとに分割",
    distributeHint: "合計金額を連続する複数日の取引に分割します。",
    distributionCount: "日数",
    distributionPreview: "分割プレビュー",
    distributionRange: "{count}日 · {start}〜{end}",
    distributionEach: "1日約{amount} · 合計{total}を維持",
    distributionError: "2〜365日を選び、1日分を通貨の最小単位以上にしてください。",
    distributionSaved: "選択した日付に支出を分割しました。",
    distributedEntry: "分割支出 {part}/{count}",
    distributionEditHint: "変更はこの日付にのみ適用されます。削除すると分割取引全体が削除されます。",
    deleteDistributedConfirm: "{merchant}の分割取引{count}件をすべて削除しますか？",
    installmentExpense: "分割払い",
    installmentHint: "合計金額をこの日から毎月の支払いに分けて記録します。",
    installmentCount: "支払回数",
    installmentPreview: "分割払いプレビュー",
    installmentRange: "{count}回 · {start}〜{end}",
    installmentEach: "初回{amount} · 合計{total}を維持",
    installmentRateHint: "すべての支払いに購入時に保存した同じ為替レートを使用します。",
    installmentError: "2〜120回を選び、1回分を通貨の最小単位以上にしてください。",
    installmentSaved: "分割払いをカレンダーに追加しました。",
    installmentEntry: "分割払い {part}/{count}",
    installmentRemaining: "この支払い後の残額：{amount}",
    installmentEditHint: "変更はこの支払いにのみ適用されます。削除すると分割払い全体が削除されます。",
    deleteInstallmentConfirm: "{merchant}の分割払い{count}件をすべて削除しますか？",
  },
  ru: {
    overview: "Обзор",
    monthOverview: "Обзор за {month}",
    transactions: "Операции",
    budgets: "Бюджеты",
    reports: "Отчёты",
    settings: "Настройки",
    greeting: "С возвращением, {name}.",
    greetingFallback: "С возвращением.",
    subtitle: "Все валюты — в одной понятной картине.",
    transactionsSubtitle: "Полная история операций в одном месте.",
    baseCurrency: "Основная валюта",
    currencySearch: "Поиск валют",
    currencySearchPlaceholder: "Код или название валюты",
    popularCurrencies: "Популярные валюты",
    allCurrencies: "Все валюты",
    currencyResults: "Результаты поиска",
    noCurrencies: "Подходящие валюты не найдены.",
    sync: "Курс сохраняется для каждой операции",
    rateProvider: "Справочные курсы Frankfurter",
    rateLatest: "Последние доступные справочные курсы",
    valuationMode: "Курс для пересчёта",
    historicalValue: "Курс на дату операции",
    currentValue: "Текущий курс",
    historicalUnavailable: "Некоторые курсы на дату операции недоступны",
    transactionRateLoading: "Загружаем курс на дату операции…",
    transactionRateError: "Курс на дату операции недоступен. Повторите попытку позже.",
    futureRateNotice: "Для будущей операции сохраняется последний доступный курс.",
    rateUpdating: "Обновляем справочные курсы…",
    rateStale: "Используется последний доступный курс от {date}",
    rateError: "Нет соединения · используется резервный курс",
    rateDate: "Дата курса",
    fetchedAt: "Получено",
    fallbackRate: "Резервный курс",
    identityRate: "Опорный курс USD",
    sameCurrencyRate: "Без конвертации",
    syncing: "Синхронизация данных учёта",
    synced: "Данные учёта синхронизированы",
    addExpense: "Добавить операцию",
    spent: "Расходы за месяц",
    across: "Всего: {count}",
    budgetLeft: "Остаток бюджета",
    ofBudget: "использовано",
    setBudget: "Задать месячный бюджет",
    netFlow: "Чистый денежный поток",
    incomeMinusSpend: "Доходы за вычетом расходов",
    activeCurrencies: "Используемые валюты",
    originalAmounts: "Исходные суммы сохранены",
    spendingBreakdown: "Структура расходов",
    byCategory: "По категориям · в {currency}",
    currencyMix: "Состав валют",
    originalSpend: "Доля расходов по валютам операций",
    recent: "Недавние операции",
    recentHint: "Исходная сумма и эквивалент в {currency}",
    allActivity: "Все операции",
    searchTransactions: "Поиск операций",
    searchTransactionPlaceholder: "Контрагент, описание, примечание, категория или валюта",
    allTypes: "Все типы",
    allCategories: "Все категории",
    clearFilters: "Сбросить фильтры",
    filterResults: "Результатов: {count}",
    noFilterResults: "Нет операций, соответствующих фильтрам.",
    merchant: "Контрагент или описание",
    merchantPlaceholderExpense: "Например, местное кафе",
    merchantPlaceholderIncome: "Например, оплата проекта",
    category: "Категория",
    chooseCategory: "Выберите категорию",
    categoryHint: "Выберите наиболее подходящую категорию операции.",
    subcategory: "Подкатегория (необязательно)",
    subcategoryHint: "При необходимости выберите более точный вариант.",
    noSubcategory: "Без уточнения",
    date: "Дата",
    amount: "Сумма",
    currency: "Валюта",
    converted: "Сумма после пересчёта",
    savedRate: "Этот курс сохранится вместе с операцией.",
    save: "Сохранить операцию",
    saving: "Сохранение…",
    cancel: "Отмена",
    close: "Закрыть",
    expense: "Расход",
    income: "Доход",
    drawerTitle: "Добавить операцию",
    drawerSubtitle: "Сохраняем исходную сумму и курс к USD, чтобы история оставалась точной.",
    amountError: "Введите сумму больше 0.",
    dateError: "Выберите корректную дату операции.",
    requiredError: "Укажите продавца или описание.",
    saved: "Операция добавлена.",
    deleted: "Операция удалена.",
    saveFailed: "Не удалось сохранить операцию. Попробуйте ещё раз.",
    deleteFailed: "Не удалось удалить операцию.",
    signInNeeded: "Войдите, чтобы сохранить личный учёт финансов.",
    previewMode: "Показываем пример данных, пока восстанавливается соединение.",
    empty: "Операций пока нет. Добавьте первую.",
    language: "Язык",
    privateLedger: "Ваш личный глобальный учёт финансов",
    logout: "Выйти",
    helpTitle: "Для жизни без границ",
    helpBody: "Исходные суммы сохраняются, а основная валюта помогает честно вести бюджет.",
    learnMore: "Как работает пересчёт",
    menu: "Открыть навигацию",
    deleteLabel: "Удалить {merchant}",
    convertedTo: "в {currency}",
    repeatTransaction: "Повторять эту операцию",
    repeatHint: "Автоматически создавать будущие операции в календаре.",
    repeatFrequency: "Периодичность",
    weekly: "Каждую неделю",
    monthly: "Каждый месяц",
    yearly: "Каждый год",
    repeatEnds: "Дата окончания (необязательно)",
    recurringEntry: "Регулярная операция",
    recurringEditHint: "Изменения применятся только к этой операции.",
    stopRecurring: "Остановить будущие повторы",
    stopRecurringConfirm: "Остановить повторы после этой операции? Прошлые записи сохранятся.",
    recurringStopped: "Будущие повторы остановлены.",
    recurringStopFailed: "Не удалось остановить регулярную операцию.",
    recurrenceDateError: "Дата окончания должна быть не раньше первой операции.",
    distributeExpense: "Распределить по датам",
    distributeHint: "Разделить одну сумму на ежедневные операции подряд.",
    distributionCount: "Количество дней",
    distributionPreview: "Предпросмотр распределения",
    distributionRange: "{count} дн. · {start}–{end}",
    distributionEach: "Около {amount} в день · итог {total} сохранится",
    distributionError: "Выберите от 2 до 365 дней; сумма за день должна быть не меньше минимальной разменной единицы выбранной валюты.",
    distributionSaved: "Расход распределён по выбранным датам.",
    distributedEntry: "Распределённый расход {part}/{count}",
    distributionEditHint: "Изменения относятся только к этой дате. Удаление удалит всё распределение.",
    deleteDistributedConfirm: "Удалить все распределённые операции ({count}) для {merchant}?",
    installmentExpense: "Оплата в рассрочку",
    installmentHint: "Разделить общую сумму на ежемесячные платежи с этой даты.",
    installmentCount: "Количество платежей",
    installmentPreview: "Предпросмотр рассрочки",
    installmentRange: "{count} платежей · {start}–{end}",
    installmentEach: "Первый платёж {amount} · итог {total} сохранится",
    installmentRateHint: "Для всех платежей используется курс, сохранённый на дату покупки.",
    installmentError: "Выберите от 2 до 120 платежей; каждый должен быть не меньше минимальной разменной единицы валюты.",
    installmentSaved: "Рассрочка добавлена в календарь.",
    installmentEntry: "Платёж {part}/{count}",
    installmentRemaining: "После платежа останется {amount}",
    installmentEditHint: "Изменения относятся только к этому платежу. Удаление удалит всю рассрочку.",
    deleteInstallmentConfirm: "Удалить все платежи рассрочки ({count}) для {merchant}?",
  },
} as const;

const RECURRING_FLOW_COPY = {
  en: {
    add: "Add recurring",
    manage: "Recurring transactions",
    buttonHint: "Schedule an expense or regular income",
    drawerTitle: "Add a recurring transaction",
    drawerSubtitle:
      "Set the first entry and schedule. Future entries will appear automatically.",
    scheduleTitle: "Recurring schedule",
    save: "Save recurring transaction",
    saved: "Recurring transaction added.",
  },
  ko: {
    add: "반복 거래 추가",
    manage: "반복 거래 관리",
    buttonHint: "반복 지출 또는 정기 수입 설정",
    drawerTitle: "반복 거래 추가",
    drawerSubtitle:
      "첫 거래와 반복 주기를 설정하면 이후 거래가 자동으로 생성됩니다.",
    scheduleTitle: "반복 일정",
    save: "반복 거래 저장",
    saved: "반복 거래가 추가되었습니다.",
  },
  ja: {
    add: "定期取引を追加",
    manage: "定期取引の管理",
    buttonHint: "定期的な支出または収入を設定",
    drawerTitle: "定期取引を追加",
    drawerSubtitle: "最初の取引と周期を設定すると、今後の取引が自動で表示されます。",
    scheduleTitle: "定期取引のスケジュール",
    save: "定期取引を保存",
    saved: "定期取引を追加しました。",
  },
  ru: {
    add: "Добавить регулярную операцию",
    manage: "Регулярные операции",
    buttonHint: "Запланировать расход или регулярный доход",
    drawerTitle: "Добавить регулярную операцию",
    drawerSubtitle: "Задайте первую операцию и расписание. Будущие записи появятся автоматически.",
    scheduleTitle: "Расписание повторов",
    save: "Сохранить регулярную операцию",
    saved: "Регулярная операция добавлена.",
  },
} as const;

const CALENDAR_COPY = {
  en: {
    calendar: "Monthly calendar",
    calendarHint: "Select a date to review, add, or edit entries.",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    thisMonth: "This month",
    today: "Today",
    selectedDay: "Selected day",
    transactionCount: "{count} transactions",
    addOnDate: "Add transaction on {date}",
    noTransactions: "No transactions on this day.",
    moreTransactions: "+{count} more",
    edit: "Edit",
    editLabel: "Edit {merchant}",
    editTransaction: "Edit transaction",
    editSubtitle: "Update the entry while keeping its saved transaction-date exchange rate.",
    update: "Save changes",
    updating: "Saving changes…",
    updated: "Transaction updated.",
    historicalRate: "Saved transaction-date rate",
    changedConflict: "This entry changed elsewhere. Reopen it and try again.",
    confirmDelete: "Delete {merchant}? This cannot be undone.",
    expenseTotal: "Expense",
    incomeTotal: "Income",
    note: "Note",
    notePlaceholder: "Optional details",
    openDate: "Open {date}",
    daySummary: "{count}: {expense} expenses, {income} income",
  },
  ko: {
    calendar: "월간 달력",
    calendarHint: "날짜를 선택해 거래를 확인하고 추가하거나 수정하세요.",
    previousMonth: "이전 달",
    nextMonth: "다음 달",
    thisMonth: "이번 달",
    today: "오늘",
    selectedDay: "선택한 날짜",
    transactionCount: "거래 {count}건",
    addOnDate: "{date}에 거래 추가",
    noTransactions: "이 날짜에는 거래가 없습니다.",
    moreTransactions: "외 {count}건",
    edit: "수정",
    editLabel: "{merchant} 수정",
    editTransaction: "거래 수정",
    editSubtitle: "저장된 거래일 환율은 유지하면서 거래 내용을 변경합니다.",
    update: "변경사항 저장",
    updating: "변경사항 저장 중…",
    updated: "거래가 수정되었습니다.",
    historicalRate: "저장된 거래일 환율",
    changedConflict: "다른 곳에서 변경된 거래입니다. 다시 열어 수정해 주세요.",
    confirmDelete: "{merchant} 거래를 삭제할까요? 이 작업은 되돌릴 수 없습니다.",
    expenseTotal: "지출",
    incomeTotal: "수입",
    note: "메모",
    notePlaceholder: "선택 사항",
    openDate: "{date} 상세 보기",
    daySummary: "{count} · 지출 {expense}, 수입 {income}",
  },
  ja: {
    calendar: "月間カレンダー",
    calendarHint: "日付を選んで取引を確認、追加、編集できます。",
    previousMonth: "前の月",
    nextMonth: "次の月",
    thisMonth: "今月",
    today: "今日",
    selectedDay: "選択した日",
    transactionCount: "{count}件の取引",
    addOnDate: "{date}に取引を追加",
    noTransactions: "この日の取引はありません。",
    moreTransactions: "ほか{count}件",
    edit: "編集",
    editLabel: "{merchant}を編集",
    editTransaction: "取引を編集",
    editSubtitle: "保存済みの取引時レートを維持したまま取引を更新します。",
    update: "変更を保存",
    updating: "変更を保存中…",
    updated: "取引を更新しました。",
    historicalRate: "保存済みの取引時レート",
    changedConflict: "この取引は別の画面または端末ですでに変更されています。開き直してもう一度お試しください。",
    confirmDelete: "{merchant}を削除しますか？この操作は元に戻せません。",
    expenseTotal: "支出",
    incomeTotal: "収入",
    note: "メモ",
    notePlaceholder: "補足（任意）",
    openDate: "{date}を開く",
    daySummary: "{count}、支出{expense}、収入{income}",
  },
  ru: {
    calendar: "Календарь на месяц",
    calendarHint: "Выберите дату, чтобы просмотреть, добавить или изменить операции.",
    previousMonth: "Предыдущий месяц",
    nextMonth: "Следующий месяц",
    thisMonth: "Текущий месяц",
    today: "Сегодня",
    selectedDay: "Выбранный день",
    transactionCount: "Операций: {count}",
    addOnDate: "Добавить операцию на {date}",
    noTransactions: "В этот день операций нет.",
    moreTransactions: "Ещё {count}",
    edit: "Изменить",
    editLabel: "Изменить {merchant}",
    editTransaction: "Изменить операцию",
    editSubtitle: "Обновите запись, сохранив курс, зафиксированный на дату операции.",
    update: "Сохранить изменения",
    updating: "Сохранение изменений…",
    updated: "Операция обновлена.",
    historicalRate: "Сохранённый курс на дату операции",
    changedConflict: "Эта запись была изменена в другом месте. Откройте её заново.",
    confirmDelete: "Удалить {merchant}? Это действие нельзя отменить.",
    expenseTotal: "Расход",
    incomeTotal: "Доход",
    note: "Примечание",
    notePlaceholder: "Дополнительные сведения",
    openDate: "Открыть {date}",
    daySummary: "{count}: расходы {expense}, доходы {income}",
  },
} as const;

function template(value: string, variables: Record<string, string | number>) {
  return Object.entries(variables).reduce(
    (result, [key, replacement]) =>
      result.replace(`{${key}}`, String(replacement)),
    value,
  );
}

function formatCurrency(
  amount: number,
  currency: CurrencyCode,
  language: Language,
) {
  const locale = LANGUAGE_LOCALES[language];
  const exponent = currencyExponent(currency) ?? 2;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(exponent)}`;
  }
}

function formatCompactCurrency(
  amount: number,
  currency: CurrencyCode,
  language: Language,
) {
  try {
    return new Intl.NumberFormat(LANGUAGE_LOCALES[language], {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(1)}`;
  }
}

function originalMajor(transaction: LedgerTransaction) {
  return transaction.originalAmountMinor / 10 ** transaction.originalExponent;
}

function installmentRemainingMajor(transaction: LedgerTransaction) {
  if (
    transaction.installmentTotalOriginalMinor == null ||
    transaction.installmentCount == null ||
    transaction.installmentIndex == null
  ) {
    return 0;
  }
  return (
    installmentRemainingMinor(
      transaction.installmentTotalOriginalMinor,
      transaction.installmentCount,
      transaction.installmentIndex,
    ) /
    10 ** transaction.originalExponent
  );
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isIsoInstant(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  ) {
    return false;
  }

  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function inBaseCurrency(
  usdMinor: number,
  currency: CurrencyCode,
  ratesToUsd: Record<CurrencyCode, number>,
) {
  return usdMinor / 100 / (ratesToUsd[currency] ?? 1);
}

function transactionInBaseCurrency(
  transaction: LedgerTransaction,
  currency: CurrencyCode,
  ratesToUsd: Record<CurrencyCode, number>,
  valuationMode: ValuationMode,
  historicalBaseRates: Record<string, number>,
) {
  if (transaction.originalCurrency === currency) {
    return originalMajor(transaction);
  }

  if (valuationMode === "current") {
    const originalRate = ratesToUsd[transaction.originalCurrency];
    const displayRate = ratesToUsd[currency];
    if (originalRate && displayRate) {
      return (originalMajor(transaction) * originalRate) / displayRate;
    }
  } else {
    const originalRate = Number(transaction.fxRate);
    const displayRate = historicalBaseRates[transaction.occurredOn];
    if (Number.isFinite(originalRate) && originalRate > 0 && displayRate > 0) {
      return (originalMajor(transaction) * originalRate) / displayRate;
    }
  }

  return inBaseCurrency(transaction.baseAmountMinor, currency, ratesToUsd);
}

function shiftIsoDate(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function localIsoDate(date = new Date()) {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return shifted.toISOString().slice(0, 7);
}

function daysInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function dateInMonth(month: string, preferredDay: number) {
  const day = Math.min(Math.max(preferredDay, 1), daysInMonth(month));
  return `${month}-${String(day).padStart(2, "0")}`;
}

function calendarDates(month: string) {
  const first = `${month}-01`;
  const firstWeekday = new Date(`${first}T00:00:00Z`).getUTCDay();
  const gridStart = shiftIsoDate(first, -firstWeekday);
  return Array.from({ length: 42 }, (_, index) => {
    const iso = shiftIsoDate(gridStart, index);
    return {
      iso,
      day: Number(iso.slice(8, 10)),
      inMonth: iso.startsWith(month),
    };
  });
}

function amountForInput(transaction: LedgerTransaction) {
  if (transaction.amount) return transaction.amount;
  const exponent = transaction.originalExponent;
  if (exponent === 0) return String(transaction.originalAmountMinor);
  const scale = 10 ** exponent;
  const whole = Math.floor(transaction.originalAmountMinor / scale);
  const fraction = String(transaction.originalAmountMinor % scale).padStart(
    exponent,
    "0",
  );
  return `${whole}.${fraction}`;
}

function byNewestTransaction(a: LedgerTransaction, b: LedgerTransaction) {
  const dateComparison = b.occurredOn.localeCompare(a.occurredOn);
  if (dateComparison !== 0) return dateComparison;
  return (b.updatedAt ?? b.createdAt ?? b.id).localeCompare(
    a.updatedAt ?? a.createdAt ?? a.id,
  );
}

function isPersistedTransaction(transaction: LedgerTransaction) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    transaction.id,
  );
}

export function ExpenseTracker({
  firstName,
  today,
  view = "dashboard",
  initialLanguage = DEFAULT_LANGUAGE,
}: {
  firstName: string | null;
  today: string;
  view?: "dashboard" | "transactions";
  initialLanguage?: Language;
}) {
  const router = useRouter();
  const isTransactionsView = view === "transactions";
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [languageReady, setLanguageReady] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>("USD");
  const [currencyCatalog, setCurrencyCatalog] = useState<CurrencyMetadata[]>(
    FALLBACK_CURRENCY_CATALOG,
  );
  const [ratesToUsd, setRatesToUsd] =
    useState<Record<CurrencyCode, number>>(FALLBACK_RATES_TO_USD);
  const [rateMeta, setRateMeta] = useState<RateMeta>({
    status: "updating",
    asOf: null,
    fetchedAt: null,
    rateDates: {},
  });
  const [valuationMode, setValuationMode] =
    useState<ValuationMode>("historical");
  const [historicalBaseRates, setHistoricalBaseRates] =
    useState<Record<string, number>>({});
  const [historicalRatesStatus, setHistoricalRatesStatus] =
    useState<"loading" | "ready" | "error">("loading");
  const [formRateSnapshot, setFormRateSnapshot] = useState<FormRateSnapshot>({
    requestedDate: null,
    status: "idle",
    rates: {},
    rateDates: {},
    asOf: null,
  });
  const [transactions, setTransactions] =
    useState<LedgerTransaction[]>(FALLBACK_TRANSACTIONS);
  const [monthlyBudgetUsdMinor, setMonthlyBudgetUsdMinor] =
    useState<number | null>(null);
  const [transactionQuery, setTransactionQuery] = useState("");
  const [transactionKindFilter, setTransactionKindFilter] =
    useState<"all" | TransactionKind>("all");
  const [transactionCategoryFilter, setTransactionCategoryFilter] =
    useState("all");
  const [transactionCurrencyFilter, setTransactionCurrencyFilter] =
    useState("all");
  const [isSyncing, setIsSyncing] = useState(true);
  const [currentDate, setCurrentDate] = useState(today);
  const [viewMonth, setViewMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<LedgerTransaction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("KRW");
  const [lastTransactionCurrency, setLastTransactionCurrency] =
    useState<CurrencyCode>("KRW");
  const [category, setCategory] = useState("dining");
  const [subcategory, setSubcategory] = useState("");
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [note, setNote] = useState("");
  const [occurredOn, setOccurredOn] = useState(today);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] =
    useState<RecurrenceFrequency>("monthly");
  const [recurrenceEndsOn, setRecurrenceEndsOn] = useState("");
  const [isDistributed, setIsDistributed] = useState(false);
  const [distributionCount, setDistributionCount] = useState("3");
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState("3");
  const [formError, setFormError] = useState("");
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerTriggerRef = useRef<HTMLElement | null>(null);
  const categoryTriggerRef = useRef<HTMLButtonElement>(null);
  const categoryPickerRef = useRef<HTMLDivElement>(null);
  const categoryOptionRefs = useRef<Record<string, HTMLButtonElement | null>>(
    {},
  );
  const drawerReturnDateRef = useRef(today);
  const isSavingRef = useRef(false);
  const calendarButtonRefs = useRef<Record<string, HTMLButtonElement | null>>(
    {},
  );
  const copy = COPY[language];
  const currencyPickerCopy: CurrencyPickerCopy = {
    search: copy.currencySearch,
    searchPlaceholder: copy.currencySearchPlaceholder,
    popular: copy.popularCurrencies,
    all: copy.allCurrencies,
    results: copy.currencyResults,
    empty: copy.noCurrencies,
  };
  const calendarCopy = CALENDAR_COPY[language];
  const recurringFlowCopy = RECURRING_FLOW_COPY[language];
  const activeCategoryOptions = categoryIdsForKind(kind);
  const activeCategoryGroups = categoryGroupsForKind(kind);
  const hasSelectedCategory = activeCategoryOptions.some((item) => item === category);
  const activeSubcategoryOptions = subcategoryIdsForCategory(category);
  const transactionCurrencyCatalog = useMemo(() => {
    if (currencyCatalog.some((item) => item.code === currency)) {
      return currencyCatalog;
    }
    return [
      ...currencyCatalog,
      {
        code: currency,
        name: currency,
        symbol: currency,
        exponent: currencyExponent(currency) ?? 2,
      },
    ];
  }, [currency, currencyCatalog]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const localToday = localIsoDate();
      setCurrentDate(localToday);
      const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (isLanguage(storedLanguage)) setLanguage(storedLanguage);
      setLanguageReady(true);
      const storedValuationMode = window.localStorage.getItem(
        "globeledger-valuation-mode",
      );
      if (storedValuationMode === "historical" || storedValuationMode === "current") {
        setValuationMode(storedValuationMode);
      }
      if (localToday !== today) {
        setTransactions([]);
        setViewMonth(localToday.slice(0, 7));
        setSelectedDate(localToday);
        setOccurredOn(localToday);
        setIsSyncing(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [today]);

  useEffect(() => {
    document.documentElement.lang = language;
    if (languageReady) persistLanguagePreference(language);
  }, [language, languageReady]);

  useEffect(() => {
    window.localStorage.setItem("globeledger-valuation-mode", valuationMode);
  }, [valuationMode]);

  useEffect(() => {
    if (!languageReady) return;
    const controller = new AbortController();
    async function loadPreferences() {
      try {
        const response = await fetch("/api/preferences", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("PREFERENCES_LOAD_FAILED");
        const payload = (await response.json()) as PreferencesApiResponse;
        const storedBaseCurrency = payload.data?.baseCurrency;
        const storedTransactionCurrency =
          payload.data?.lastTransactionCurrency;
        const storedLanguage = payload.data?.language;
        if (storedBaseCurrency && /^[A-Z]{3}$/u.test(storedBaseCurrency)) {
          setBaseCurrency(storedBaseCurrency);
        }
        if (
          storedTransactionCurrency &&
          /^[A-Z]{3}$/u.test(storedTransactionCurrency)
        ) {
          setLastTransactionCurrency(storedTransactionCurrency);
        }
        if (isLanguage(storedLanguage)) setLanguage(storedLanguage);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    void loadPreferences();
    return () => controller.abort();
  }, [languageReady]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRates() {
      try {
        const response = await fetch("/api/rates", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("RATES_LOAD_FAILED");

        const responseBody = (await response.json()) as RatesApiResponse;
        const payload = responseBody.data ?? responseBody;
        const responseBase = payload.baseCurrency ?? payload.base;
        if (
          responseBase !== "USD" ||
          payload.source !== "frankfurter" ||
          payload.direction !== "USD_PER_ORIGINAL" ||
          typeof payload.stale !== "boolean" ||
          !payload.rates ||
          typeof payload.rates !== "object" ||
          !payload.rateDates ||
          typeof payload.rateDates !== "object" ||
          !Array.isArray(payload.currencies) ||
          payload.currencies.length < 100 ||
          !isIsoDate(payload.asOf) ||
          !isIsoInstant(payload.fetchedAt)
        ) {
          throw new Error("INVALID_RATES_RESPONSE");
        }

        const nextRates: Record<CurrencyCode, number> = {};
        const rateDates: Record<CurrencyCode, string> = {};
        const nextCatalog: CurrencyMetadata[] = [];
        const seenCodes = new Set<string>();
        for (const metadata of payload.currencies) {
          if (
            !metadata ||
            typeof metadata !== "object" ||
            !/^[A-Z]{3}$/u.test(metadata.code) ||
            seenCodes.has(metadata.code) ||
            typeof metadata.name !== "string" ||
            !metadata.name.trim() ||
            typeof metadata.symbol !== "string" ||
            !Number.isInteger(metadata.exponent) ||
            metadata.exponent < 0 ||
            metadata.exponent > 4
          ) {
            throw new Error("INVALID_CURRENCY_CATALOG");
          }
          const code = metadata.code;
          const rawRate = payload.rates[code];
          const parsedRate = Number(rawRate);
          const rateDate = payload.rateDates[code];
          if (
            typeof rawRate !== "string" ||
            !Number.isFinite(parsedRate) ||
            parsedRate <= 0 ||
            !isIsoDate(rateDate)
          ) {
            throw new Error("INCOMPLETE_RATES_RESPONSE");
          }
          nextRates[code] = parsedRate;
          rateDates[code] = rateDate;
          nextCatalog.push(metadata);
          seenCodes.add(code);
        }
        if (nextRates.USD !== 1) throw new Error("INVALID_USD_RATE");
        nextRates.USD = 1;

        setRatesToUsd(nextRates);
        setCurrencyCatalog(nextCatalog);
        setBaseCurrency((current) =>
          nextRates[current] ? current : "USD",
        );
        setRateMeta({
          status: payload.stale ? "stale" : "updated",
          asOf: payload.asOf,
          fetchedAt: payload.fetchedAt,
          rateDates,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRatesToUsd(FALLBACK_RATES_TO_USD);
        setCurrencyCatalog(FALLBACK_CURRENCY_CATALOG);
        setBaseCurrency((current) =>
          FALLBACK_RATES_TO_USD[current] ? current : "USD",
        );
        setRateMeta({
          status: "error",
          asOf: null,
          fetchedAt: null,
          rateDates: {},
        });
      }
    }

    void loadRates();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTransactions() {
      try {
        const collected: LedgerTransaction[] = [];
        let cursor: string | null = null;
        let pageCount = 0;

        do {
          const search = new URLSearchParams({
            month: viewMonth,
            limit: "100",
          });
          if (cursor) search.set("cursor", cursor);
          const response = await fetch(`/api/transactions?${search}`, {
            signal: controller.signal,
            cache: "no-store",
          });
          if (!response.ok) throw new Error("LOAD_FAILED");
          const payload = (await response.json()) as TransactionApiResponse;
          if (!Array.isArray(payload.data)) throw new Error("INVALID_LEDGER");
          collected.push(...payload.data);
          cursor = payload.pagination?.nextCursor ?? null;
          pageCount += 1;
          if (pageCount > 20) throw new Error("LEDGER_PAGE_LIMIT");
        } while (cursor);

        setTransactions(collected.sort(byNewestTransaction));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setTransactions((current) =>
          current.filter(
            (transaction) => transaction.occurredOn.slice(0, 7) === viewMonth,
          ),
        );
        setToast(copy.previewMode);
      } finally {
        if (!controller.signal.aborted) setIsSyncing(false);
      }
    }

    void loadTransactions();
    return () => controller.abort();
  }, [viewMonth, copy.previewMode]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadHistoricalBaseRates() {
      setHistoricalRatesStatus("loading");
      try {
        const from = `${viewMonth}-01`;
        if (from > currentDate) {
          setHistoricalBaseRates({});
          setHistoricalRatesStatus("ready");
          return;
        }
        const monthEnd = shiftIsoDate(`${shiftMonth(viewMonth, 1)}-01`, -1);
        const to = monthEnd > currentDate ? currentDate : monthEnd;
        const search = new URLSearchParams({
          quote: baseCurrency,
          from,
          to,
        });
        const response = await fetch(`/api/rates/history?${search}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json()) as HistoricalRatesApiResponse;
        const data = payload.data;
        if (
          !response.ok ||
          data?.baseCurrency !== "USD" ||
          data.quote !== baseCurrency ||
          data.direction !== "USD_PER_ORIGINAL" ||
          !data.rates ||
          typeof data.rates !== "object"
        ) {
          throw new Error("INVALID_HISTORICAL_RATES");
        }
        const nextRates: Record<string, number> = {};
        for (const [date, rawRate] of Object.entries(data.rates)) {
          const rate = Number(rawRate);
          if (!isIsoDate(date) || !Number.isFinite(rate) || rate <= 0) {
            throw new Error("INVALID_HISTORICAL_RATE");
          }
          nextRates[date] = rate;
        }
        setHistoricalBaseRates(nextRates);
        setHistoricalRatesStatus("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setHistoricalBaseRates({});
        setHistoricalRatesStatus("error");
      }
    }
    void loadHistoricalBaseRates();
    return () => controller.abort();
  }, [baseCurrency, currentDate, viewMonth]);

  useEffect(() => {
    if (!isDrawerOpen || !isIsoDate(occurredOn)) return;

    const controller = new AbortController();
    async function loadTransactionDateRates() {
      setFormRateSnapshot({
        requestedDate: occurredOn,
        status: "loading",
        rates: {},
        rateDates: {},
        asOf: null,
      });
      try {
        const rateEndpoint = occurredOn > currentDate
          ? "/api/rates"
          : `/api/rates?date=${encodeURIComponent(occurredOn)}`;
        const response = await fetch(
          rateEndpoint,
          { signal: controller.signal, cache: "no-store" },
        );
        const responseBody = (await response.json()) as RatesApiResponse;
        const payload = responseBody.data ?? responseBody;
        if (
          !response.ok ||
          payload.baseCurrency !== "USD" ||
          payload.direction !== "USD_PER_ORIGINAL" ||
          payload.source !== "frankfurter" ||
          !payload.rates ||
          !payload.rateDates ||
          !isIsoDate(payload.asOf)
        ) {
          throw new Error("INVALID_TRANSACTION_DATE_RATES");
        }
        const nextRates: Record<string, number> = { USD: 1 };
        const nextRateDates: Record<string, string> = {};
        for (const [code, rawRate] of Object.entries(payload.rates)) {
          const rate = Number(rawRate);
          const rateDate = payload.rateDates[code];
          if (
            !/^[A-Z]{3}$/u.test(code) ||
            !Number.isFinite(rate) ||
            rate <= 0 ||
            !isIsoDate(rateDate)
          ) {
            throw new Error("INVALID_TRANSACTION_DATE_RATE");
          }
          nextRates[code] = rate;
          nextRateDates[code] = rateDate;
        }
        setFormRateSnapshot({
          requestedDate: occurredOn,
          status: "ready",
          rates: nextRates,
          rateDates: nextRateDates,
          asOf: payload.asOf,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFormRateSnapshot({
          requestedDate: occurredOn,
          status: "error",
          rates: {},
          rateDates: {},
          asOf: null,
        });
      }
    }
    const frame = window.requestAnimationFrame(() => {
      void loadTransactionDateRates();
    });
    return () => {
      controller.abort();
      window.cancelAnimationFrame(frame);
    };
  }, [currentDate, isDrawerOpen, occurredOn]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadBudget() {
      try {
        const response = await fetch(
          `/api/budgets?month=${encodeURIComponent(viewMonth)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json()) as BudgetApiResponse;
        const total = payload.data?.totalBudgetUsdMinor;
        if (
          !response.ok ||
          !Number.isSafeInteger(total) ||
          (total ?? -1) < 0
        ) {
          throw new Error("INVALID_BUDGET");
        }
        setMonthlyBudgetUsdMinor(total ?? 0);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMonthlyBudgetUsdMinor(0);
      }
    }
    void loadBudget();
    return () => controller.abort();
  }, [viewMonth]);

  const closeDrawer = useCallback(() => {
    if (isSavingRef.current) return;
    setIsCategoryPickerOpen(false);
    setIsDrawerOpen(false);
    setFormError("");
    const trigger = drawerTriggerRef.current ?? addButtonRef.current;
    drawerTriggerRef.current = null;
    window.setTimeout(() => {
      if (trigger?.isConnected) {
        trigger.focus();
        return;
      }
      (
        calendarButtonRefs.current[drawerReturnDateRef.current] ??
        addButtonRef.current
      )?.focus();
    }, 0);
    setEditingTransaction(null);
    setIsRecurring(false);
    setIsDistributed(false);
    setIsInstallment(false);
  }, []);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    descriptionRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDrawer, isDrawerOpen]);

  useEffect(() => {
    if (!isCategoryPickerOpen) return;
    const frame = window.requestAnimationFrame(() => {
      const firstCategory = categoryIdsForKind(kind)[0];
      (categoryOptionRefs.current[category] ??
        categoryOptionRefs.current[firstCategory])?.focus();
    });

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const drawer = drawerRef.current;
      if (drawer) {
        const drawerBounds = drawer.getBoundingClientRect();
        const scrollbarWidth = drawer.offsetWidth - drawer.clientWidth;
        if (
          scrollbarWidth > 0 &&
          event.clientX >= drawerBounds.right - scrollbarWidth &&
          event.clientX <= drawerBounds.right &&
          event.clientY >= drawerBounds.top &&
          event.clientY <= drawerBounds.bottom
        ) {
          return;
        }
      }
      if (
        categoryPickerRef.current?.contains(target) ||
        categoryTriggerRef.current?.contains(target)
      ) {
        return;
      }
      setIsCategoryPickerOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [category, isCategoryPickerOpen, kind]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const monthlyTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) => transaction.occurredOn.slice(0, 7) === viewMonth,
      ),
    [transactions, viewMonth],
  );

  const transactionFilterOptions = useMemo(
    () => ({
      categories: [
        ...new Set(monthlyTransactions.map((item) => item.category)),
      ].sort((a, b) =>
        categoryLabel(a, language).localeCompare(
          categoryLabel(b, language),
          LANGUAGE_LOCALES[language],
        ),
      ),
      currencies: [
        ...new Set(
          monthlyTransactions.map((item) => item.originalCurrency),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    }),
    [language, monthlyTransactions],
  );

  const filteredTransactions = useMemo(() => {
    const languageLocale = LANGUAGE_LOCALES[language];
    const query = transactionQuery
      .trim()
      .toLocaleLowerCase(languageLocale);
    return monthlyTransactions.filter((transaction) => {
      if (
        transactionKindFilter !== "all" &&
        transaction.kind !== transactionKindFilter
      ) {
        return false;
      }
      if (
        transactionCategoryFilter !== "all" &&
        transaction.category !== transactionCategoryFilter
      ) {
        return false;
      }
      if (
        transactionCurrencyFilter !== "all" &&
        transaction.originalCurrency !== transactionCurrencyFilter
      ) {
        return false;
      }
      if (!query) return true;
      return [
        transaction.description,
        transaction.note ?? "",
        transaction.category,
        categoryLabel(transaction.category, language),
        transaction.subcategory ?? "",
        transaction.subcategory
          ? subcategoryLabel(transaction.subcategory, language)
          : "",
        transaction.originalCurrency,
      ].some((value) =>
        value.toLocaleLowerCase(languageLocale).includes(query),
      );
    });
  }, [
    language,
    monthlyTransactions,
    transactionCategoryFilter,
    transactionCurrencyFilter,
    transactionKindFilter,
    transactionQuery,
  ]);

  const recentTransactions = useMemo(
    () => [...monthlyTransactions].sort(byNewestTransaction).slice(0, 3),
    [monthlyTransactions],
  );
  const visibleTransactions = isTransactionsView
    ? filteredTransactions
    : recentTransactions;

  const hasTransactionFilters = Boolean(
    transactionQuery.trim() ||
      transactionKindFilter !== "all" ||
      transactionCategoryFilter !== "all" ||
      transactionCurrencyFilter !== "all",
  );

  function clearTransactionFilters() {
    setTransactionQuery("");
    setTransactionKindFilter("all");
    setTransactionCategoryFilter("all");
    setTransactionCurrencyFilter("all");
  }

  const totals = useMemo(() => {
    let expenseBaseAmount = 0;
    let incomeBaseAmount = 0;
    const currencies = new Set<CurrencyCode>();
    const categories = new Map<string, number>();
    const currencyTotals = new Map<CurrencyCode, number>();

    for (const transaction of monthlyTransactions) {
      currencies.add(transaction.originalCurrency);
      const displayAmount = transactionInBaseCurrency(
        transaction,
        baseCurrency,
        ratesToUsd,
        valuationMode,
        historicalBaseRates,
      );
      if (transaction.kind === "income") {
        incomeBaseAmount += displayAmount;
        continue;
      }
      expenseBaseAmount += displayAmount;
      categories.set(
        transaction.category,
        (categories.get(transaction.category) ?? 0) + displayAmount,
      );
      currencyTotals.set(
        transaction.originalCurrency,
        (currencyTotals.get(transaction.originalCurrency) ?? 0) + displayAmount,
      );
    }

    return {
      expenseBaseAmount,
      incomeBaseAmount,
      currencies,
      categories: [...categories.entries()].sort((a, b) => b[1] - a[1]),
      currencyTotals: [...currencyTotals.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [
    baseCurrency,
    historicalBaseRates,
    monthlyTransactions,
    ratesToUsd,
    valuationMode,
  ]);

  const transactionsByDate = useMemo(() => {
    const grouped = new Map<string, LedgerTransaction[]>();
    for (const transaction of monthlyTransactions) {
      const entries = grouped.get(transaction.occurredOn) ?? [];
      entries.push(transaction);
      grouped.set(transaction.occurredOn, entries);
    }
    for (const entries of grouped.values()) entries.sort(byNewestTransaction);
    return grouped;
  }, [monthlyTransactions]);
  const monthCalendarDates = useMemo(
    () => calendarDates(viewMonth),
    [viewMonth],
  );
  const selectedTransactions = useMemo(
    () => transactionsByDate.get(selectedDate) ?? [],
    [selectedDate, transactionsByDate],
  );
  const selectedDayTotals = useMemo(() => {
    let expenseBaseAmount = 0;
    let incomeBaseAmount = 0;
    for (const transaction of selectedTransactions) {
      const displayAmount = transactionInBaseCurrency(
        transaction,
        baseCurrency,
        ratesToUsd,
        valuationMode,
        historicalBaseRates,
      );
      if (transaction.kind === "income") {
        incomeBaseAmount += displayAmount;
      } else {
        expenseBaseAmount += displayAmount;
      }
    }
    return { expenseBaseAmount, incomeBaseAmount };
  }, [
    baseCurrency,
    historicalBaseRates,
    ratesToUsd,
    selectedTransactions,
    valuationMode,
  ]);

  const budgetUsdMinor = monthlyBudgetUsdMinor ?? 0;
  const budgetBaseAmount = inBaseCurrency(budgetUsdMinor, baseCurrency, ratesToUsd);
  const remainingBaseAmount = budgetBaseAmount - totals.expenseBaseAmount;
  const budgetProgress = budgetBaseAmount > 0
    ? Math.round((totals.expenseBaseAmount / budgetBaseAmount) * 100)
    : 0;
  const maxCategory = totals.categories[0]?.[1] ?? 1;
  const currencyMixBackground = useMemo(() => {
    const total = totals.currencyTotals.reduce((sum, [, value]) => sum + value, 0);
    if (!total) return "conic-gradient(#e6e9e6 0 100%)";
    const colors = ["#ee6c4d", "#315f52", "#4d6fdd", "#d49b45", "#9b6acb"];
    let cursor = 0;
    const stops = totals.currencyTotals.map(([, value], index) => {
      const start = cursor;
      cursor += (value / total) * 100;
      return `${colors[index % colors.length]} ${start}% ${cursor}%`;
    });
    return `conic-gradient(${stops.join(", ")})`;
  }, [totals.currencyTotals]);

  const usesStoredRate = Boolean(
    editingTransaction &&
      currency === editingTransaction.originalCurrency &&
      occurredOn === editingTransaction.occurredOn &&
      Number.isFinite(Number(editingTransaction.fxRate)) &&
      Number(editingTransaction.fxRate) > 0,
  );
  const hasTransactionDateRates = Boolean(
    formRateSnapshot.status === "ready" &&
      formRateSnapshot.requestedDate === occurredOn,
  );
  const formRatesToUsd = hasTransactionDateRates
    ? formRateSnapshot.rates
    : ratesToUsd;
  const formRateToUsd = usesStoredRate
    ? Number(editingTransaction?.fxRate)
    : formRatesToUsd[currency] ?? 1;
  const conversionRate = currency === baseCurrency
    ? 1
    : formRateToUsd / (formRatesToUsd[baseCurrency] ?? 1);
  const convertedPreview = Number(amount) ? Number(amount) * conversionRate : 0;
  const hasFrankfurterRate = Boolean(
    hasTransactionDateRates &&
      formRateSnapshot.rates[currency] &&
      formRateSnapshot.rateDates[currency],
  );
  const selectedRateSource =
    usesStoredRate
      ? currency === "USD"
        ? "identity"
        : "manual"
      : currency === "USD"
      ? "identity"
      : hasFrankfurterRate
        ? "frankfurter"
        : "manual";
  const selectedRateDate = !usesStoredRate && currency !== "USD" && hasFrankfurterRate
    ? formRateSnapshot.rateDates[currency] ?? formRateSnapshot.asOf
    : null;
  const requiresTransactionDateRate = currency !== "USD" && !usesStoredRate;
  const transactionDateRateReady =
    !requiresTransactionDateRate || hasTransactionDateRates;
  const isFutureTransaction = occurredOn > currentDate;
  const parsedDistributionCount = Number(distributionCount);
  const distributionPreviewEnd =
    isIsoDate(occurredOn) &&
    Number.isInteger(parsedDistributionCount) &&
    parsedDistributionCount >= 2
      ? shiftIsoDate(occurredOn, parsedDistributionCount - 1)
      : occurredOn;
  const distributionDailyPreview =
    Number.isFinite(Number(amount)) && parsedDistributionCount > 0
      ? Number(amount) / parsedDistributionCount
      : 0;
  const parsedInstallmentCount = Number(installmentCount);
  const installmentPreviewEnd =
    isIsoDate(occurredOn) &&
    Number.isInteger(parsedInstallmentCount) &&
    parsedInstallmentCount >= 2
      ? shiftInstallmentDate(occurredOn, parsedInstallmentCount - 1)
      : occurredOn;
  const installmentAmountMinor = Math.round(
    (Number(amount) || 0) * 10 ** (currencyExponent(currency) ?? 2),
  );
  const firstInstallmentPreview =
    parsedInstallmentCount > 0
      ? installmentPaymentMinor(
          installmentAmountMinor,
          parsedInstallmentCount,
          0,
        ) / 10 ** (currencyExponent(currency) ?? 2)
      : 0;

  function rememberDrawerTrigger() {
    drawerTriggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : addButtonRef.current;
  }

  async function saveCurrencyPreference(
    preference:
      | { baseCurrency: CurrencyCode }
      | { language: Language },
  ) {
    try {
      const response = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(preference),
      });
      if (!response.ok) throw new Error("PREFERENCE_SAVE_FAILED");
    } catch {
      // The selected value remains active for this session and will be retried
      // the next time the member changes or uses a currency.
    }
  }

  function chooseBaseCurrency(nextCurrency: CurrencyCode) {
    setBaseCurrency(nextCurrency);
    void saveCurrencyPreference({ baseCurrency: nextCurrency });
  }

  function chooseLanguage(nextLanguage: Language) {
    persistLanguagePreference(nextLanguage);
    setLanguage(nextLanguage);
    void saveCurrencyPreference({ language: nextLanguage });
    router.refresh();
  }

  function openAddDrawer(date = selectedDate) {
    rememberDrawerTrigger();
    drawerReturnDateRef.current = date;
    setIsCategoryPickerOpen(false);
    setEditingTransaction(null);
    setKind("expense");
    setDescription("");
    setAmount("");
    setCurrency(lastTransactionCurrency);
    setCategory("dining");
    setSubcategory("");
    setNote("");
    setOccurredOn(date);
    setIsRecurring(false);
    setRecurrenceFrequency("monthly");
    setRecurrenceEndsOn("");
    setIsDistributed(false);
    setDistributionCount("3");
    setIsInstallment(false);
    setInstallmentCount("3");
    setIsDrawerOpen(true);
    setFormError("");
  }

  function openRecurringDrawer(date = selectedDate) {
    openAddDrawer(date);
    setIsRecurring(true);
    setIsDistributed(false);
    setIsInstallment(false);
  }

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (search.get("new") !== "recurring") return;
    const frame = window.requestAnimationFrame(() => {
      openRecurringDrawer(currentDate);
      window.history.replaceState(null, "", window.location.pathname);
    });
    return () => window.cancelAnimationFrame(frame);
    // This deep link is consumed once on arrival from the management page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openEditDrawer(transaction: LedgerTransaction) {
    if (!isPersistedTransaction(transaction)) {
      setToast(copy.previewMode);
      return;
    }
    rememberDrawerTrigger();
    drawerReturnDateRef.current = transaction.occurredOn;
    setIsCategoryPickerOpen(false);
    setEditingTransaction(transaction);
    setKind(transaction.kind);
    setDescription(transaction.description);
    setAmount(amountForInput(transaction));
    setCurrency(transaction.originalCurrency);
    setCategory(transaction.category);
    setSubcategory(transaction.subcategory ?? "");
    setNote(transaction.note ?? "");
    setOccurredOn(transaction.occurredOn);
    setIsRecurring(false);
    setRecurrenceFrequency("monthly");
    setRecurrenceEndsOn("");
    setIsDistributed(false);
    setDistributionCount("3");
    setIsInstallment(false);
    setInstallmentCount("3");
    setIsDrawerOpen(true);
    setFormError("");
  }

  function chooseCategory(nextCategory: string) {
    setCategory(nextCategory);
    setSubcategory("");
    setIsCategoryPickerOpen(false);
    window.requestAnimationFrame(() => categoryTriggerRef.current?.focus());
  }

  function handleCategoryKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setIsCategoryPickerOpen(false);
      categoryTriggerRef.current?.focus();
      return;
    }

    let targetIndex: number | null = null;
    if (event.key === "ArrowLeft") targetIndex = Math.max(0, index - 1);
    if (event.key === "ArrowRight") {
      targetIndex = Math.min(activeCategoryOptions.length - 1, index + 1);
    }
    if (event.key === "ArrowUp") targetIndex = Math.max(0, index - 3);
    if (event.key === "ArrowDown") {
      targetIndex = Math.min(activeCategoryOptions.length - 1, index + 3);
    }
    if (event.key === "Home") targetIndex = 0;
    if (event.key === "End") targetIndex = activeCategoryOptions.length - 1;
    if (targetIndex === null) return;
    event.preventDefault();
    if (targetIndex === index) return;
    categoryOptionRefs.current[activeCategoryOptions[targetIndex]]?.focus();
  }

  function moveToMonth(month: string, date: string) {
    setIsSyncing(true);
    setTransactions([]);
    setViewMonth(month);
    setSelectedDate(date);
  }

  function navigateMonth(amount: number) {
    const nextMonth = shiftMonth(viewMonth, amount);
    const preferredDay = Number(selectedDate.slice(8, 10));
    moveToMonth(nextMonth, dateInMonth(nextMonth, preferredDay));
  }

  function selectCalendarDate(date: string) {
    const month = date.slice(0, 7);
    if (month !== viewMonth) {
      moveToMonth(month, date);
      return;
    }
    setSelectedDate(date);
  }

  function focusCalendarDate(date: string) {
    selectCalendarDate(date);
    window.setTimeout(() => calendarButtonRefs.current[date]?.focus(), 0);
  }

  function handleCalendarKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    date: string,
  ) {
    let target: string | null = null;
    if (event.key === "ArrowLeft") target = shiftIsoDate(date, -1);
    if (event.key === "ArrowRight") target = shiftIsoDate(date, 1);
    if (event.key === "ArrowUp") target = shiftIsoDate(date, -7);
    if (event.key === "ArrowDown") target = shiftIsoDate(date, 7);
    if (event.key === "Home") {
      target = shiftIsoDate(
        date,
        -new Date(`${date}T00:00:00Z`).getUTCDay(),
      );
    }
    if (event.key === "End") {
      target = shiftIsoDate(
        date,
        6 - new Date(`${date}T00:00:00Z`).getUTCDay(),
      );
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      const nextMonth = shiftMonth(
        date.slice(0, 7),
        event.key === "PageUp" ? -1 : 1,
      );
      target = dateInMonth(nextMonth, Number(date.slice(8, 10)));
    }
    if (!target) return;
    event.preventDefault();
    focusCalendarDate(target);
  }

  function goToToday() {
    if (currentDate.slice(0, 7) === viewMonth) {
      setSelectedDate(currentDate);
      window.setTimeout(
        () => calendarButtonRefs.current[currentDate]?.focus(),
        0,
      );
      return;
    }
    moveToMonth(currentDate.slice(0, 7), currentDate);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSavingRef.current) return;
    const numericAmount = Number(amount);
    if (!description.trim()) {
      setFormError(copy.requiredError);
      descriptionRef.current?.focus();
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError(copy.amountError);
      return;
    }
    if (!isIsoDate(occurredOn)) {
      setFormError(copy.dateError);
      return;
    }
    if (requiresTransactionDateRate && !hasTransactionDateRates) {
      setFormError(
        formRateSnapshot.status === "loading"
          ? copy.transactionRateLoading
          : copy.transactionRateError,
      );
      return;
    }
    if (
      !editingTransaction &&
      isRecurring &&
      recurrenceEndsOn &&
      (!isIsoDate(recurrenceEndsOn) || recurrenceEndsOn < occurredOn)
    ) {
      setFormError(copy.recurrenceDateError);
      return;
    }
    const amountMinorPreview = Math.round(
      numericAmount * 10 ** (currencyExponent(currency) ?? 2),
    );
    if (
      !editingTransaction &&
      isDistributed &&
      (!Number.isInteger(parsedDistributionCount) ||
        parsedDistributionCount < 2 ||
        parsedDistributionCount > 365 ||
        amountMinorPreview < parsedDistributionCount)
    ) {
      setFormError(copy.distributionError);
      return;
    }
    if (
      !editingTransaction &&
      isInstallment &&
      (!Number.isInteger(parsedInstallmentCount) ||
        parsedInstallmentCount < 2 ||
        parsedInstallmentCount > MAX_INSTALLMENT_COUNT ||
        amountMinorPreview < parsedInstallmentCount)
    ) {
      setFormError(copy.installmentError);
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setFormError("");
    try {
      const endpoint = editingTransaction
        ? `/api/transactions?id=${encodeURIComponent(editingTransaction.id)}`
        : "/api/transactions";
      const response = await fetch(endpoint, {
        method: editingTransaction ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          occurredOn,
          amount,
          currency,
          rate: String(formRateToUsd),
          rateSource: selectedRateSource,
          rateDate: selectedRateDate,
          category,
          subcategory: subcategory || null,
          description: description.trim(),
          note: note.trim(),
          ...(!editingTransaction && isRecurring
            ? {
                recurrence: {
                  frequency: recurrenceFrequency,
                  endsOn: recurrenceEndsOn || null,
                },
              }
            : {}),
          ...(!editingTransaction && isDistributed
            ? { distribution: { count: parsedDistributionCount } }
            : {}),
          ...(!editingTransaction && isInstallment
            ? { installment: { count: parsedInstallmentCount } }
            : {}),
          ...(editingTransaction
            ? { expectedUpdatedAt: editingTransaction.updatedAt }
            : { clientRequestId: crypto.randomUUID() }),
        }),
      });
      const payload = (await response.json()) as TransactionApiResponse;
      if (!response.ok) {
        if (response.status === 401) throw new Error("UNAUTHENTICATED");
        throw new Error(payload.error?.code ?? "SAVE_FAILED");
      }
      const savedTransactions = Array.isArray(payload.data)
        ? payload.data
        : payload.data ?? payload.transaction
          ? [payload.data ?? payload.transaction!]
          : [];
      const savedTransaction = savedTransactions[0];
      if (savedTransaction) {
        const savedMonth = savedTransaction.occurredOn.slice(0, 7);
        const savedMonthTransactions = savedTransactions.filter(
          (transaction) => transaction.occurredOn.slice(0, 7) === savedMonth,
        );
        drawerReturnDateRef.current = savedTransaction.occurredOn;
        setTransactions((current) => {
          const savedIds = new Set(savedTransactions.map((item) => item.id));
          const withoutSaved = current.filter(
            (transaction) => !savedIds.has(transaction.id),
          );
          return savedMonth === viewMonth
            ? [...savedMonthTransactions, ...withoutSaved].sort(byNewestTransaction)
            : savedMonthTransactions;
        });
        setSelectedDate(savedTransaction.occurredOn);
        if (savedMonth !== viewMonth) {
          setIsSyncing(true);
          setViewMonth(savedMonth);
        }
      }
      if (!editingTransaction) {
        const usedCurrency = savedTransaction?.originalCurrency ?? currency;
        setLastTransactionCurrency(usedCurrency);
      }
      setDescription("");
      setAmount("");
      setNote("");
      setToast(
        editingTransaction
          ? calendarCopy.updated
          : isRecurring
            ? recurringFlowCopy.saved
            : isDistributed
              ? copy.distributionSaved
              : isInstallment
                ? copy.installmentSaved
              : copy.saved,
      );
      isSavingRef.current = false;
      setIsSaving(false);
      closeDrawer();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message === "UNAUTHENTICATED"
            ? copy.signInNeeded
            : error.message === "TRANSACTION_CHANGED"
              ? calendarCopy.changedConflict
              : copy.saveFailed
          : copy.saveFailed,
      );
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }

  async function deleteTransaction(transaction: LedgerTransaction) {
    if (!isPersistedTransaction(transaction)) {
      setToast(copy.previewMode);
      return;
    }
    if (
      !window.confirm(
        transaction.installmentGroupId
          ? template(copy.deleteInstallmentConfirm, {
              merchant: transaction.description,
              count: transaction.installmentCount ?? 0,
            })
          : transaction.splitGroupId
          ? template(copy.deleteDistributedConfirm, {
              merchant: transaction.description,
              count: transaction.splitCount ?? 0,
            })
          : template(calendarCopy.confirmDelete, {
              merchant: transaction.description,
            }),
      )
    ) {
      return;
    }
    const previous = transactions;
    setTransactions((current) =>
      current.filter((item) =>
        transaction.installmentGroupId
          ? item.installmentGroupId !== transaction.installmentGroupId
          : transaction.splitGroupId
          ? item.splitGroupId !== transaction.splitGroupId
          : item.id !== transaction.id,
      ),
    );
    window.setTimeout(
      () =>
        (
          calendarButtonRefs.current[transaction.occurredOn] ??
          addButtonRef.current
        )?.focus(),
      0,
    );
    try {
      const response = await fetch(
        `/api/transactions?id=${encodeURIComponent(transaction.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("DELETE_FAILED");
      if (editingTransaction?.id === transaction.id) closeDrawer();
      setToast(copy.deleted);
    } catch {
      setTransactions(previous);
      setToast(copy.deleteFailed);
    }
  }

  async function stopRecurringTransaction(transaction: LedgerTransaction) {
    if (!transaction.recurringSeriesId) return;
    if (!window.confirm(copy.stopRecurringConfirm)) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/recurring?id=${encodeURIComponent(transaction.recurringSeriesId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            endsOn: transaction.recurrenceDate ?? transaction.occurredOn,
          }),
        },
      );
      if (!response.ok) throw new Error("STOP_RECURRING_FAILED");
      const endsOn = transaction.recurrenceDate ?? transaction.occurredOn;
      setTransactions((current) =>
        current.filter(
          (item) =>
            item.recurringSeriesId !== transaction.recurringSeriesId ||
            (item.recurrenceDate ?? item.occurredOn) <= endsOn,
        ),
      );
      setToast(copy.recurringStopped);
      closeDrawer();
    } catch {
      setFormError(copy.recurringStopFailed);
    } finally {
      setIsSaving(false);
    }
  }

  const locale = LANGUAGE_LOCALES[language];
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${viewMonth}-01T00:00:00Z`));
  const selectedDateLabel = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${selectedDate}T00:00:00Z`));
  const weekdayLabels = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "short",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2026, 7, 2 + index))),
  );
  const rateDateLabel = rateMeta.asOf
    ? new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${rateMeta.asOf}T00:00:00Z`))
    : null;
  const selectedRateDateLabel = selectedRateDate
    ? new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${selectedRateDate}T00:00:00Z`))
    : null;
  const fetchedAtLabel = rateMeta.fetchedAt
    ? new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(rateMeta.fetchedAt))
    : null;
  const rateStatusMessage =
    rateMeta.status === "updating"
      ? copy.rateUpdating
      : rateMeta.status === "stale"
        ? template(copy.rateStale, { date: rateDateLabel ?? rateMeta.asOf ?? "" })
        : rateMeta.status === "error"
          ? copy.rateError
          : copy.rateLatest;

  return (
    <div className="app-shell">
      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark" aria-hidden="true"><span /></span>
            <span className="brand-name">GlobeLedger</span>
          </div>
          <div className="page-title">
            <p>{firstName ? template(copy.greeting, { name: firstName }) : copy.greetingFallback}</p>
            <h1>{isTransactionsView ? copy.transactionsSubtitle : copy.subtitle}</h1>
          </div>
          <div className="topbar-actions">
            <div className="sync-state" aria-live="polite">
              <span className={isSyncing ? "sync-dot pulsing" : "sync-dot"} />
              <span>{isSyncing ? copy.syncing : copy.synced}</span>
            </div>
            <LanguagePicker
              value={language}
              label={copy.language}
              onChange={chooseLanguage}
            />
            <CurrencyPicker
              className="base-select"
              value={baseCurrency}
              catalog={currencyCatalog}
              onChange={chooseBaseCurrency}
              language={language}
              label={copy.baseCurrency}
              pickerCopy={currencyPickerCopy}
            />
            <button className="primary-button desktop-add" onClick={() => openAddDrawer()} ref={addButtonRef}>
              <span aria-hidden="true">＋</span> {copy.addExpense}
            </button>
          </div>
        </header>

        <section className="month-heading" aria-labelledby="month-overview-title">
          <div className="month-heading-copy">
            <span className="eyebrow">{isTransactionsView ? copy.transactions : copy.overview}</span>
            <div className="month-title-row">
              <h2 id="month-overview-title" aria-live="polite">{monthLabel}</h2>
              <div className="month-controls" role="group" aria-label={calendarCopy.calendar}>
                <button type="button" onClick={() => navigateMonth(-1)} aria-label={calendarCopy.previousMonth}>‹</button>
                <button type="button" className="month-today" onClick={goToToday}>{calendarCopy.thisMonth}</button>
                <button type="button" onClick={() => navigateMonth(1)} aria-label={calendarCopy.nextMonth}>›</button>
              </div>
              {!isTransactionsView && (
                <button
                  type="button"
                  className="recurring-add-button"
                  onClick={() => openRecurringDrawer()}
                  aria-label={`${recurringFlowCopy.add}: ${recurringFlowCopy.buttonHint}`}
                >
                  <span aria-hidden="true">↻</span>
                  <strong>{recurringFlowCopy.add}</strong>
                </button>
              )}
            </div>
          </div>
          <div className="valuation-tools">
            <div
              className="valuation-switch"
              role="group"
              aria-label={copy.valuationMode}
            >
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
            {valuationMode === "historical" && historicalRatesStatus === "error" && (
              <small className="valuation-warning">{copy.historicalUnavailable}</small>
            )}
            <div
              className={`rate-note rate-note-${rateMeta.status}`}
              role="status"
              aria-live="polite"
            >
              <span className="rate-indicator" aria-hidden="true">↻</span>
              <span className="rate-note-copy">
                <strong>{copy.rateProvider}</strong>
                <span>{rateStatusMessage}</span>
                {(rateDateLabel || fetchedAtLabel) && (
                  <small>
                    {rateDateLabel ? `${copy.rateDate}: ${rateDateLabel}` : ""}
                    {rateDateLabel && fetchedAtLabel ? " · " : ""}
                    {fetchedAtLabel ? `${copy.fetchedAt}: ${fetchedAtLabel}` : ""}
                  </small>
                )}
              </span>
            </div>
          </div>
        </section>

        {!isTransactionsView && <>
        <section className="calendar-workspace" aria-label={calendarCopy.calendar}>
          <article className="panel calendar-panel" aria-busy={isSyncing}>
            <div className="calendar-panel-heading">
              <div>
                <span className="eyebrow">{calendarCopy.calendar}</span>
                <h2>{monthLabel}</h2>
                <p>{calendarCopy.calendarHint}</p>
              </div>
              <button type="button" className="calendar-today-button" onClick={goToToday}>
                {calendarCopy.today}
              </button>
            </div>
            <div className="calendar-table-wrap">
              <table className="calendar-table">
                <caption className="sr-only">{calendarCopy.calendar}: {monthLabel}</caption>
                <thead>
                  <tr>
                    {weekdayLabels.map((weekday) => (
                      <th key={weekday} scope="col">{weekday}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }, (_, weekIndex) => (
                    <tr key={weekIndex}>
                      {monthCalendarDates
                        .slice(weekIndex * 7, weekIndex * 7 + 7)
                        .map((calendarDate) => {
                          const dayEntries =
                            transactionsByDate.get(calendarDate.iso) ?? [];
                          let expenseBaseAmount = 0;
                          let incomeBaseAmount = 0;
                          for (const transaction of dayEntries) {
                            const displayAmount = transactionInBaseCurrency(
                              transaction,
                              baseCurrency,
                              ratesToUsd,
                              valuationMode,
                              historicalBaseRates,
                            );
                            if (transaction.kind === "income") {
                              incomeBaseAmount += displayAmount;
                            } else {
                              expenseBaseAmount += displayAmount;
                            }
                          }
                          const expense = formatCompactCurrency(
                            expenseBaseAmount,
                            baseCurrency,
                            language,
                          );
                          const income = formatCompactCurrency(
                            incomeBaseAmount,
                            baseCurrency,
                            language,
                          );
                          const dayLabel = new Intl.DateTimeFormat(locale, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            timeZone: "UTC",
                          }).format(new Date(`${calendarDate.iso}T00:00:00Z`));
                          return (
                            <td
                              className={calendarDate.inMonth ? "" : "outside-month"}
                              key={calendarDate.iso}
                            >
                              <button
                                type="button"
                                data-calendar-date={calendarDate.iso}
                                className={calendarDate.iso === selectedDate ? "calendar-day selected" : "calendar-day"}
                                aria-current={calendarDate.iso === currentDate ? "date" : undefined}
                                aria-label={`${template(calendarCopy.openDate, { date: dayLabel })}. ${template(calendarCopy.daySummary, { count: formatLocalizedCount(dayEntries.length, language, "entry"), expense, income })}`}
                                aria-pressed={calendarDate.iso === selectedDate}
                                tabIndex={calendarDate.iso === selectedDate ? 0 : -1}
                                ref={(node) => {
                                  calendarButtonRefs.current[calendarDate.iso] = node;
                                }}
                                onClick={() =>
                                  calendarDate.inMonth
                                    ? selectCalendarDate(calendarDate.iso)
                                    : focusCalendarDate(calendarDate.iso)
                                }
                                onKeyDown={(event) => handleCalendarKeyDown(event, calendarDate.iso)}
                              >
                                <span className="calendar-day-number">
                                  {calendarDate.day}
                                  {calendarDate.iso === currentDate && <i>{calendarCopy.today}</i>}
                                </span>
                                <span className="calendar-entry-previews" aria-hidden="true">
                                  {dayEntries.slice(0, 2).map((transaction) => (
                                    <span className={transaction.kind === "income" ? "calendar-entry-preview income" : "calendar-entry-preview"} key={transaction.id}>
                                      <i style={{ backgroundColor: categoryColor(transaction.category) }} />
                                      {transaction.isRecurring ? (
                                        <em>↻</em>
                                      ) : transaction.installmentGroupId ? (
                                        <em>ⓘ {(transaction.installmentIndex ?? 0) + 1}/{transaction.installmentCount}</em>
                                      ) : transaction.splitGroupId ? (
                                        <em>{(transaction.splitIndex ?? 0) + 1}/{transaction.splitCount}</em>
                                      ) : null}
                                      <b>{transaction.description}</b>
                                    </span>
                                  ))}
                                  {dayEntries.length > 2 && (
                                    <small>{template(calendarCopy.moreTransactions, { count: dayEntries.length - 2 })}</small>
                                  )}
                                </span>
                                {dayEntries.length > 0 && (
                                  <span className="calendar-entry-count" aria-hidden="true">
                                    {dayEntries.length}
                                  </span>
                                )}
                                {dayEntries.length > 0 && (
                                  <span className="calendar-day-totals" aria-hidden="true">
                                    {expenseBaseAmount > 0 && <b>−{expense}</b>}
                                    {incomeBaseAmount > 0 && <b className="income">+{income}</b>}
                                  </span>
                                )}
                              </button>
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <aside className="panel day-agenda" aria-labelledby="selected-day-title">
            <div className="day-agenda-heading">
              <div>
                <span className="eyebrow">{calendarCopy.selectedDay}</span>
                <h2 id="selected-day-title">{selectedDateLabel}</h2>
                <p>{formatLocalizedCount(selectedTransactions.length, language, "transaction")}</p>
              </div>
              <button type="button" className="day-add-button" onClick={() => openAddDrawer(selectedDate)} aria-label={template(calendarCopy.addOnDate, { date: selectedDateLabel })}>+</button>
            </div>
            <div className="day-summary-cards">
              <div>
                <span>{calendarCopy.expenseTotal}</span>
                <strong>−{formatCurrency(selectedDayTotals.expenseBaseAmount, baseCurrency, language)}</strong>
              </div>
              <div className="income">
                <span>{calendarCopy.incomeTotal}</span>
                <strong>+{formatCurrency(selectedDayTotals.incomeBaseAmount, baseCurrency, language)}</strong>
              </div>
            </div>
            {selectedTransactions.length ? (
              <div className="day-agenda-list">
                {selectedTransactions.map((transaction) => {
                  const canModify = isPersistedTransaction(transaction);
                  return (
                  <article className="day-agenda-entry" key={transaction.id}>
                    <button
                      type="button"
                      className="day-entry-main"
                      disabled={!canModify}
                      onClick={canModify ? () => openEditDrawer(transaction) : undefined}
                      aria-label={canModify ? template(calendarCopy.editLabel, { merchant: transaction.description }) : transaction.description}
                    >
                      <span className="transaction-glyph" style={{ backgroundColor: `${categoryColor(transaction.category)}18`, color: categoryColor(transaction.category) }} aria-hidden="true">
                        {categoryGlyph(transaction.category)}
                      </span>
                      <span className="day-entry-copy">
                        <strong>{transaction.description}</strong>
                        <small>
                          {transaction.isRecurring
                            ? "↻ · "
                            : transaction.installmentGroupId
                              ? `ⓘ ${(transaction.installmentIndex ?? 0) + 1}/${transaction.installmentCount} · `
                            : transaction.splitGroupId
                              ? `${(transaction.splitIndex ?? 0) + 1}/${transaction.splitCount} · `
                              : ""}
                          {categoryPathLabel(transaction.category, transaction.subcategory, language)} · {formatCurrency(originalMajor(transaction), transaction.originalCurrency, language)} {transaction.originalCurrency}
                        </small>
                      </span>
                      <span className={transaction.kind === "income" ? "day-entry-value income" : "day-entry-value"}>
                        {transaction.kind === "income" ? "+" : "−"}{formatCurrency(transactionInBaseCurrency(transaction, baseCurrency, ratesToUsd, valuationMode, historicalBaseRates), baseCurrency, language)}
                      </span>
                    </button>
                    {canModify && (
                      <div className="day-entry-actions">
                        <button type="button" className="danger" onClick={() => void deleteTransaction(transaction)} aria-label={template(copy.deleteLabel, { merchant: transaction.description })}>×</button>
                      </div>
                    )}
                  </article>
                  );
                })}
              </div>
            ) : (
              <div className="day-agenda-empty">
                <span aria-hidden="true">＋</span>
                <p>{calendarCopy.noTransactions}</p>
                <button type="button" onClick={() => openAddDrawer(selectedDate)}>{template(calendarCopy.addOnDate, { date: selectedDateLabel })}</button>
              </div>
            )}
          </aside>
        </section>

        <section className="metric-grid" aria-label={template(copy.monthOverview, { month: monthLabel })}>
          <article className="metric-card metric-featured">
            <div className="metric-label"><span>{copy.spent}</span><span className="metric-icon">↗</span></div>
            <strong>{formatCurrency(totals.expenseBaseAmount, baseCurrency, language)}</strong>
            <p>{template(copy.across, { count: formatLocalizedCount(totals.currencies.size, language, "currency") })}</p>
            <div className="micro-bars" aria-hidden="true">
              {[34, 58, 46, 72, 64, 88, 78, 100, 84, 94, 76, 90].map((height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
          </article>
          <article className="metric-card">
            <div className="metric-label"><span>{copy.budgetLeft}</span><span className="metric-icon pale">◔</span></div>
            <strong>{budgetUsdMinor > 0 ? formatCurrency(remainingBaseAmount, baseCurrency, language) : "—"}</strong>
            {budgetUsdMinor > 0 ? <p>{budgetProgress}% {copy.ofBudget}</p> : <p><a className="metric-link" href="/budgets">{copy.setBudget} →</a></p>}
            <div
              className="budget-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={budgetProgress}
              aria-label={`${budgetProgress}% ${copy.ofBudget}`}
            >
              <span style={{ width: `${Math.min(budgetProgress, 100)}%` }} />
            </div>
          </article>
          <article className="metric-card metric-flow-card">
            <div className="metric-label"><span>{copy.netFlow}</span><span className="metric-icon green">↕</span></div>
            <strong className="positive-amount">
              {formatCurrency(
                totals.incomeBaseAmount - totals.expenseBaseAmount,
                baseCurrency,
                language,
              )}
            </strong>
            <p>{copy.incomeMinusSpend}</p>
            <div className="income-pill">
              <span>{copy.income}</span>
              <strong>+{formatCurrency(totals.incomeBaseAmount, baseCurrency, language)}</strong>
            </div>
          </article>
          <article className="metric-card metric-currency-card">
            <div className="metric-label"><span>{copy.activeCurrencies}</span><span className="metric-icon blue">◎</span></div>
            <strong>{totals.currencies.size}</strong>
            <p>{copy.originalAmounts}</p>
            <div className="currency-stack" aria-label={[...totals.currencies].join(", ")}>
              {[...totals.currencies].slice(0, 4).map((code) => <span key={code}>{code}</span>)}
              {totals.currencies.size > 4 && <span className="currency-more">+{totals.currencies.size - 4}</span>}
            </div>
          </article>
        </section>

        <section className="insights-grid">
          <article className="panel spending-panel">
            <div className="panel-heading">
              <div><h2>{copy.spendingBreakdown}</h2><p>{template(copy.byCategory, { currency: baseCurrency })}</p></div>
              <button className="quiet-button" aria-label={copy.allActivity}>•••</button>
            </div>
            <div className="category-bars">
              {totals.categories.slice(0, 4).map(([item, value]) => (
                <div className="category-row" key={item}>
                  <div className="category-name">
                    <span style={{ backgroundColor: categoryColor(item) }}>{categoryGlyph(item)}</span>
                    <strong>{categoryLabel(item, language)}</strong>
                  </div>
                  <div className="category-track" aria-hidden="true">
                    <span
                      style={{
                        "--category-color": categoryColor(item),
                        "--bar-width": `${Math.max(8, (value / maxCategory) * 100)}%`,
                      } as CSSProperties}
                    />
                  </div>
                  <strong>{formatCurrency(value, baseCurrency, language)}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="panel currency-panel">
            <div className="panel-heading">
              <div><h2>{copy.currencyMix}</h2><p>{copy.originalSpend}</p></div>
              <span className="small-code">{baseCurrency}</span>
            </div>
            <div className="currency-chart-wrap">
              <div className="donut" style={{ background: currencyMixBackground }}>
                <div><strong>{totals.currencies.size}</strong><span>{copy.activeCurrencies}</span></div>
              </div>
              <div className="currency-legend">
                {totals.currencyTotals.slice(0, 4).map(([code, value], index) => (
                  <div key={code}>
                    <span className={`legend-dot legend-${index + 1}`} />
                    <strong>{code}</strong>
                    <small>{Math.round(value / Math.max(totals.expenseBaseAmount, 1) * 100)}%</small>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </section>

        </>}

        <section className={isTransactionsView ? "panel transactions-panel transactions-page-panel" : "panel transactions-panel"} id="transactions">
          <div className="panel-heading transactions-heading">
            <div><h2>{isTransactionsView ? copy.transactions : copy.recent}</h2><p>{template(copy.recentHint, { currency: baseCurrency })}</p></div>
            {isTransactionsView ? (
              <span className="transaction-result-count">{formatLocalizedCount(filteredTransactions.length, language, "result")}</span>
            ) : (
              <a className="transactions-view-all" href="/transactions">{copy.allActivity} →</a>
            )}
          </div>
          {isTransactionsView && <div className="transaction-filter-bar" role="search" aria-label={copy.searchTransactions}>
            <label className="transaction-search-field">
              <span aria-hidden="true">⌕</span>
              <span className="sr-only">{copy.searchTransactions}</span>
              <input type="search" value={transactionQuery} onChange={(event) => setTransactionQuery(event.target.value)} placeholder={copy.searchTransactionPlaceholder} />
            </label>
            <label className="transaction-filter-select">
              <span className="sr-only">{copy.allTypes}</span>
              <select value={transactionKindFilter} onChange={(event) => setTransactionKindFilter(event.target.value as "all" | TransactionKind)}>
                <option value="all">{copy.allTypes}</option>
                <option value="expense">{copy.expense}</option>
                <option value="income">{copy.income}</option>
              </select>
            </label>
            <label className="transaction-filter-select">
              <span className="sr-only">{copy.allCategories}</span>
              <select value={transactionCategoryFilter} onChange={(event) => setTransactionCategoryFilter(event.target.value)}>
                <option value="all">{copy.allCategories}</option>
                {transactionFilterOptions.categories.map((filterCategory) => (
                  <option value={filterCategory} key={filterCategory}>{categoryLabel(filterCategory, language)}</option>
                ))}
              </select>
            </label>
            <label className="transaction-filter-select currency">
              <span className="sr-only">{copy.allCurrencies}</span>
              <select value={transactionCurrencyFilter} onChange={(event) => setTransactionCurrencyFilter(event.target.value)}>
                <option value="all">{copy.allCurrencies}</option>
                {transactionFilterOptions.currencies.map((filterCurrency) => (
                  <option value={filterCurrency} key={filterCurrency}>{filterCurrency}</option>
                ))}
              </select>
            </label>
            <button type="button" className="transaction-filter-clear" onClick={clearTransactionFilters} disabled={!hasTransactionFilters}>{copy.clearFilters}</button>
          </div>}
          {visibleTransactions.length ? (
            <div className="transaction-list">
              {visibleTransactions.map((transaction) => (
                <article className="transaction-row" key={transaction.id}>
                  <span
                    className="transaction-glyph"
                    style={{
                      backgroundColor: `${categoryColor(transaction.category)}18`,
                      color: categoryColor(transaction.category),
                    }}
                    aria-hidden="true"
                  >
                    {categoryGlyph(transaction.category)}
                  </span>
                  <div className="transaction-name">
                    <strong>{transaction.description}</strong>
                    <span>
                      {transaction.isRecurring
                        ? "↻ · "
                        : transaction.installmentGroupId
                          ? `ⓘ ${(transaction.installmentIndex ?? 0) + 1}/${transaction.installmentCount} · `
                        : transaction.splitGroupId
                          ? `${(transaction.splitIndex ?? 0) + 1}/${transaction.splitCount} · `
                          : ""}
                      {categoryPathLabel(transaction.category, transaction.subcategory, language)}
                    </span>
                    {transaction.installmentGroupId && (
                      <small className="installment-remaining">
                        {template(copy.installmentRemaining, {
                          amount: `${formatCurrency(
                            installmentRemainingMajor(transaction),
                            transaction.originalCurrency,
                            language,
                          )} ${transaction.originalCurrency}`,
                        })}
                      </small>
                    )}
                  </div>
                  <time dateTime={transaction.occurredOn}>
                    {new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(
                      new Date(`${transaction.occurredOn}T12:00:00`),
                    )}
                  </time>
                  <div className="original-value">
                    <strong>{formatCurrency(originalMajor(transaction), transaction.originalCurrency, language)}</strong>
                    <span>{transaction.originalCurrency}</span>
                  </div>
                  <div className={transaction.kind === "income" ? "base-value income" : "base-value"}>
                    <strong>{transaction.kind === "income" ? "+" : "−"}{formatCurrency(transactionInBaseCurrency(transaction, baseCurrency, ratesToUsd, valuationMode, historicalBaseRates), baseCurrency, language)}</strong>
                    <span>{transaction.originalCurrency === baseCurrency ? baseCurrency : template(copy.convertedTo, { currency: baseCurrency })}</span>
                  </div>
                  {isPersistedTransaction(transaction) && (
                    <>
                      <button
                        type="button"
                        className="edit-transaction"
                        onClick={() => openEditDrawer(transaction)}
                        aria-label={template(calendarCopy.editLabel, { merchant: transaction.description })}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="delete-transaction"
                        onClick={() => void deleteTransaction(transaction)}
                        aria-label={template(copy.deleteLabel, { merchant: transaction.description })}
                      >
                        ×
                      </button>
                    </>
                  )}
                </article>
              ))}
            </div>
          ) : <p className="empty-state">{isTransactionsView && monthlyTransactions.length ? copy.noFilterResults : copy.empty}</p>}
        </section>

        <footer className="product-footer">
          <span>GlobeLedger</span><span>·</span><span>{copy.sync}</span>
        </footer>
      </main>

      <button className="primary-button mobile-add" onClick={() => openAddDrawer()}>
        <span aria-hidden="true">＋</span> {copy.addExpense}
      </button>

      {isDrawerOpen && (
        <div className="drawer-layer">
          <button className="drawer-scrim" aria-label={copy.close} onClick={closeDrawer} disabled={isSaving} />
          <aside ref={drawerRef} className="transaction-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" aria-describedby="drawer-description" aria-busy={isSaving}>
            <div className="drawer-header">
              <div>
                <span className="eyebrow">GlobeLedger</span>
                <h2 id="drawer-title">
                  {editingTransaction
                    ? calendarCopy.editTransaction
                    : isRecurring
                      ? recurringFlowCopy.drawerTitle
                      : copy.drawerTitle}
                </h2>
                <p id="drawer-description">
                  {editingTransaction
                    ? calendarCopy.editSubtitle
                    : isRecurring
                      ? recurringFlowCopy.drawerSubtitle
                      : copy.drawerSubtitle}
                </p>
              </div>
              <button type="button" className="drawer-close" onClick={closeDrawer} aria-label={copy.close} disabled={isSaving}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="kind-switch" aria-label={`${copy.expense} / ${copy.income}`}>
                <button type="button" aria-pressed={kind === "expense"} className={kind === "expense" ? "selected" : ""} onClick={() => { setIsCategoryPickerOpen(false); setKind("expense"); if (!isExpenseCategory(category)) { setCategory("dining"); setSubcategory(""); } }}>{copy.expense}</button>
                <button type="button" aria-pressed={kind === "income"} className={kind === "income" ? "selected" : ""} onClick={() => { setIsCategoryPickerOpen(false); setKind("income"); if (!isIncomeCategory(category)) { setCategory("salary"); setSubcategory(""); } setIsDistributed(false); }}>{copy.income}</button>
              </div>
              <label className="field">
                <span>{copy.merchant}</span>
                <input ref={descriptionRef} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={80} placeholder={kind === "expense" ? copy.merchantPlaceholderExpense : copy.merchantPlaceholderIncome} />
              </label>
              <div className="field-row amount-row">
                <label className="field">
                  <span>{copy.amount}</span>
                  <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" aria-describedby="conversion-preview" />
                </label>
                <CurrencyPicker
                  className="field currency-field"
                  value={currency}
                  catalog={transactionCurrencyCatalog}
                  onChange={setCurrency}
                  language={language}
                  label={copy.currency}
                  pickerCopy={currencyPickerCopy}
                />
              </div>
              <div className="conversion-preview" id="conversion-preview" aria-live="polite">
                <div><span>{copy.converted}</span><strong>{transactionDateRateReady ? formatCurrency(convertedPreview, baseCurrency, language) : "—"} <small>{baseCurrency}</small></strong></div>
                <p>
                  {!transactionDateRateReady
                    ? formRateSnapshot.status === "loading"
                      ? copy.transactionRateLoading
                      : copy.transactionRateError
                    : <>
                        1 {currency} = {conversionRate < 0.01 ? conversionRate.toFixed(6) : conversionRate.toFixed(4)} {baseCurrency}
                        {" · "}{usesStoredRate ? calendarCopy.historicalRate : currency === baseCurrency ? copy.sameCurrencyRate : currency === "USD" ? copy.identityRate : hasFrankfurterRate ? copy.rateProvider : copy.fallbackRate}
                        {selectedRateDateLabel ? ` · ${copy.rateDate}: ${selectedRateDateLabel}` : ""}
                        {isFutureTransaction && hasFrankfurterRate ? ` · ${copy.futureRateNotice}` : ""}
                        {" · "}{copy.savedRate}
                      </>}
                </p>
              </div>
              <div className="field category-field">
                  <span id="category-field-label">{copy.category}</span>
                  <div className="category-picker">
                    <button
                      ref={categoryTriggerRef}
                      type="button"
                      className="category-trigger"
                      aria-labelledby="category-field-label selected-category-label"
                      aria-haspopup="listbox"
                      aria-expanded={isCategoryPickerOpen}
                      aria-controls="category-options"
                      onClick={() => setIsCategoryPickerOpen((open) => !open)}
                    >
                      <span
                        className="category-trigger-art"
                        style={{
                          backgroundColor: `${categoryColor(category)}18`,
                          color: categoryColor(category),
                        }}
                        aria-hidden="true"
                      >
                        {categoryGlyph(category)}
                      </span>
                      <span id="selected-category-label" className="category-trigger-copy">
                        <strong>{categoryLabel(category, language)}</strong>
                        <small>{copy.categoryHint}</small>
                      </span>
                      <span className="category-trigger-chevron" aria-hidden="true">⌄</span>
                    </button>
                    {isCategoryPickerOpen && (
                      <div ref={categoryPickerRef} className="category-popover">
                        <div className="category-popover-heading">
                          <strong>{copy.chooseCategory}</strong>
                          <span>{copy.categoryHint}</span>
                        </div>
                        <div id="category-options" className="category-option-groups" role="listbox" aria-labelledby="category-field-label">
                          {activeCategoryGroups.map(({ group, categories }) => (
                            <section className="category-option-group" role="group" aria-label={categoryGroupLabel(group, language)} key={group}>
                              <strong>{categoryGroupLabel(group, language)}</strong>
                              <div className="category-option-grid">
                                {categories.map((item) => {
                                  const index = activeCategoryOptions.indexOf(item);
                                  const selected = item === category;
                                  const color = categoryColor(item);
                                  return (
                                    <button
                                      ref={(node) => {
                                        categoryOptionRefs.current[item] = node;
                                      }}
                                      type="button"
                                      role="option"
                                      aria-selected={selected}
                                      tabIndex={selected || (!hasSelectedCategory && index === 0) ? 0 : -1}
                                      className={selected ? "category-option selected" : "category-option"}
                                      key={item}
                                      onClick={() => chooseCategory(item)}
                                      onKeyDown={(event) => handleCategoryKeyDown(event, index)}
                                    >
                                      <span
                                        className="category-option-art"
                                        style={{ backgroundColor: `${color}18`, color }}
                                        aria-hidden="true"
                                      >
                                        {categoryGlyph(item)}
                                      </span>
                                      <span>{categoryLabel(item, language)}</span>
                                      {selected && <i aria-hidden="true">✓</i>}
                                    </button>
                                  );
                                })}
                              </div>
                            </section>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              {activeSubcategoryOptions.length > 0 && (
                <div className="field subcategory-field">
                  <span>{copy.subcategory}</span>
                  <small>{copy.subcategoryHint}</small>
                  <div className="subcategory-options" role="group" aria-label={copy.subcategory}>
                    <button
                      type="button"
                      className={!subcategory ? "selected" : ""}
                      aria-pressed={!subcategory}
                      onClick={() => setSubcategory("")}
                    >
                      {copy.noSubcategory}
                    </button>
                    {activeSubcategoryOptions.map((item) => (
                      <button
                        type="button"
                        className={subcategory === item ? "selected" : ""}
                        aria-pressed={subcategory === item}
                        key={item}
                        onClick={() => setSubcategory(item)}
                      >
                        {subcategoryLabel(item, language)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <label className="field">
                <span>{copy.date}</span>
                <input type="date" value={occurredOn} min="1900-01-01" onChange={(event) => setOccurredOn(event.target.value)} required />
              </label>
              {!editingTransaction && kind === "expense" && !isRecurring && (
                <div className={isDistributed ? "distribution-card active" : "distribution-card"}>
                  <label className="distribution-toggle">
                    <span>
                      <strong>{copy.distributeExpense}</strong>
                      <small>{copy.distributeHint}</small>
                    </span>
                    <input
                      type="checkbox"
                      aria-label={copy.distributeExpense}
                      checked={isDistributed}
                      onChange={(event) => {
                        setIsDistributed(event.target.checked);
                        if (event.target.checked) setIsInstallment(false);
                      }}
                    />
                  </label>
                  {isDistributed && (
                    <div className="distribution-options">
                      <label className="field distribution-count-field">
                        <span>{copy.distributionCount}</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="2"
                          max="365"
                          step="1"
                          value={distributionCount}
                          onChange={(event) => setDistributionCount(event.target.value)}
                        />
                      </label>
                      <div className="distribution-preview" aria-live="polite">
                        <span>{copy.distributionPreview}</span>
                        <strong>
                          {template(copy.distributionRange, {
                            count: Number.isInteger(parsedDistributionCount)
                              ? parsedDistributionCount
                              : 0,
                            start: occurredOn,
                            end: distributionPreviewEnd,
                          })}
                        </strong>
                        <small>
                          {template(copy.distributionEach, {
                            amount: `${formatCurrency(distributionDailyPreview, currency, language)} ${currency}`,
                            total: `${formatCurrency(Number(amount) || 0, currency, language)} ${currency}`,
                          })}
                        </small>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!editingTransaction && kind === "expense" && !isRecurring && (
                <div className={isInstallment ? "installment-card active" : "installment-card"}>
                  <label className="distribution-toggle">
                    <span>
                      <strong>{copy.installmentExpense}</strong>
                      <small>{copy.installmentHint}</small>
                    </span>
                    <input
                      type="checkbox"
                      aria-label={copy.installmentExpense}
                      checked={isInstallment}
                      onChange={(event) => {
                        setIsInstallment(event.target.checked);
                        if (event.target.checked) setIsDistributed(false);
                      }}
                    />
                  </label>
                  {isInstallment && (
                    <div className="distribution-options">
                      <label className="field distribution-count-field">
                        <span>{copy.installmentCount}</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="2"
                          max={MAX_INSTALLMENT_COUNT}
                          step="1"
                          value={installmentCount}
                          onChange={(event) => setInstallmentCount(event.target.value)}
                        />
                      </label>
                      <div className="distribution-preview" aria-live="polite">
                        <span>{copy.installmentPreview}</span>
                        <strong>
                          {template(copy.installmentRange, {
                            count: Number.isInteger(parsedInstallmentCount)
                              ? parsedInstallmentCount
                              : 0,
                            start: occurredOn,
                            end: installmentPreviewEnd,
                          })}
                        </strong>
                        <small>
                          {template(copy.installmentEach, {
                            amount: `${formatCurrency(firstInstallmentPreview, currency, language)} ${currency}`,
                            total: `${formatCurrency(Number(amount) || 0, currency, language)} ${currency}`,
                          })}
                        </small>
                        <small>{copy.installmentRateHint}</small>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!editingTransaction && isRecurring && (
                <div className="recurrence-card active">
                  <div className="recurrence-heading">
                    <span>
                      <strong>{recurringFlowCopy.scheduleTitle}</strong>
                      <small>{copy.repeatHint}</small>
                    </span>
                  </div>
                  <div className="recurrence-options">
                    <label className="field">
                      <span>{copy.repeatFrequency}</span>
                      <select
                        value={recurrenceFrequency}
                        onChange={(event) =>
                          setRecurrenceFrequency(
                            event.target.value as RecurrenceFrequency,
                          )
                        }
                      >
                        <option value="weekly">{copy.weekly}</option>
                        <option value="monthly">{copy.monthly}</option>
                        <option value="yearly">{copy.yearly}</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>{copy.repeatEnds}</span>
                      <input
                        type="date"
                        min={occurredOn}
                        value={recurrenceEndsOn}
                        onChange={(event) => setRecurrenceEndsOn(event.target.value)}
                      />
                    </label>
                  </div>
                </div>
              )}
              {editingTransaction?.recurringSeriesId && (
                <div className="recurring-edit-card">
                  <div>
                    <strong>↻ {copy.recurringEntry}</strong>
                    <small>{copy.recurringEditHint}</small>
                  </div>
                  <button
                    type="button"
                    onClick={() => void stopRecurringTransaction(editingTransaction)}
                    disabled={isSaving}
                  >
                    {copy.stopRecurring}
                  </button>
                </div>
              )}
              {editingTransaction?.splitGroupId && (
                <div className="distribution-edit-card">
                  <strong>
                    {template(copy.distributedEntry, {
                      part: (editingTransaction.splitIndex ?? 0) + 1,
                      count: editingTransaction.splitCount ?? 0,
                    })}
                  </strong>
                  <small>{copy.distributionEditHint}</small>
                </div>
              )}
              {editingTransaction?.installmentGroupId && (
                <div className="installment-edit-card">
                  <strong>
                    {template(copy.installmentEntry, {
                      part: (editingTransaction.installmentIndex ?? 0) + 1,
                      count: editingTransaction.installmentCount ?? 0,
                    })}
                  </strong>
                  <small>
                    {template(copy.installmentRemaining, {
                      amount: `${formatCurrency(
                        installmentRemainingMajor(editingTransaction),
                        editingTransaction.originalCurrency,
                        language,
                      )} ${editingTransaction.originalCurrency}`,
                    })}
                  </small>
                  <small>{copy.installmentEditHint}</small>
                </div>
              )}
              <label className="field">
                <span>{calendarCopy.note}</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder={calendarCopy.notePlaceholder} />
              </label>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="drawer-actions">
                <button type="button" className="secondary-button" onClick={closeDrawer} disabled={isSaving}>{copy.cancel}</button>
                <button type="submit" className="primary-button" aria-disabled={isSaving}>
                  {isSaving
                    ? editingTransaction
                      ? calendarCopy.updating
                      : copy.saving
                    : editingTransaction
                      ? calendarCopy.update
                      : isRecurring
                        ? recurringFlowCopy.save
                        : copy.save}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}

      <div className={toast ? "toast visible" : "toast"} aria-live="polite" aria-atomic="true">{toast}</div>
    </div>
  );
}
