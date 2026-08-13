"use client";

import Link from "next/link";
import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { currencyExponent } from "@/lib/currency";

type Language = "en" | "ko";
type CurrencyCode = string;
type TransactionKind = "expense" | "income";
type RecurrenceFrequency = "weekly" | "monthly" | "yearly";

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
  description: string;
  note?: string | null;
  recurringSeriesId?: string | null;
  recurrenceDate?: string | null;
  isRecurring?: boolean;
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

type RateStatus = "updating" | "updated" | "stale" | "error";

type RateMeta = {
  status: RateStatus;
  asOf: string | null;
  fetchedAt: string | null;
  rateDates: Record<CurrencyCode, string>;
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

const CATEGORY_COLORS: Record<string, string> = {
  housing: "#ee6c4d",
  groceries: "#3d7c6a",
  transport: "#4d6fdd",
  dining: "#cf8b2c",
  utilities: "#d59b31",
  health: "#d45f79",
  education: "#5277b8",
  entertainment: "#8b67c7",
  travel: "#2f8e9d",
  shopping: "#9b6acb",
  subscriptions: "#647b96",
  income: "#278369",
  other: "#657477",
};

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
    transactions: "Transactions",
    budgets: "Budgets",
    reports: "Reports",
    settings: "Settings",
    greeting: "Good morning",
    greetingFallback: "Good morning",
    subtitle: "Every currency, one clear picture.",
    baseCurrency: "Base currency",
    sync: "Rates saved per transaction",
    rateProvider: "Frankfurter reference rates",
    rateLatest: "Latest available reference rates",
    rateUpdating: "Updating reference rates…",
    rateStale: "Using last available rate dated {date}",
    rateError: "Connection failed · using fallback rates",
    rateDate: "Rate date",
    fetchedAt: "Fetched",
    fallbackRate: "Fallback rate",
    identityRate: "USD identity rate",
    syncing: "Syncing your ledger",
    synced: "Ledger synced",
    addExpense: "Add transaction",
    spent: "Spent this month",
    across: "Across {count} currencies",
    budgetLeft: "Budget left",
    ofBudget: "of monthly budget",
    netFlow: "Net flow",
    incomeMinusSpend: "Income minus spending",
    activeCurrencies: "Active currencies",
    originalAmounts: "Original amounts preserved",
    spendingBreakdown: "Spending breakdown",
    byCategory: "By category · converted to {currency}",
    currencyMix: "Currency mix",
    originalSpend: "Share of original transactions",
    recent: "Recent transactions",
    recentHint: "Original amount and {currency} value",
    allActivity: "All activity",
    merchant: "Merchant or description",
    category: "Category",
    chooseCategory: "Choose a category",
    categoryHint: "Pick the best match for this expense.",
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
    housing: "Housing",
    groceries: "Groceries",
    transport: "Transport",
    dining: "Food & drink",
    utilities: "Utilities",
    health: "Health",
    education: "Education",
    entertainment: "Entertainment",
    travel: "Travel",
    shopping: "Shopping",
    subscriptions: "Subscriptions",
    other: "Other",
    incomeCategory: "Income",
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
  },
  ko: {
    overview: "대시보드",
    transactions: "거래 내역",
    budgets: "예산",
    reports: "리포트",
    settings: "설정",
    greeting: "좋은 아침이에요",
    greetingFallback: "좋은 아침이에요",
    subtitle: "모든 통화를 한눈에 명확하게.",
    baseCurrency: "기준 통화",
    sync: "거래별 환율 저장",
    rateProvider: "Frankfurter 기준 환율",
    rateLatest: "최신 가용 기준 환율",
    rateUpdating: "기준 환율 업데이트 중…",
    rateStale: "{date} 기준 마지막 가용 환율 사용 중",
    rateError: "연결 실패 · 기본 환율 사용 중",
    rateDate: "기준일",
    fetchedAt: "가져온 시각",
    fallbackRate: "기본 환율",
    identityRate: "USD 고정 환율",
    syncing: "가계부 동기화 중",
    synced: "가계부 동기화 완료",
    addExpense: "거래 추가",
    spent: "이번 달 지출",
    across: "{count}개 통화 합산",
    budgetLeft: "남은 예산",
    ofBudget: "월 예산 기준",
    netFlow: "순 현금 흐름",
    incomeMinusSpend: "수입에서 지출을 제외",
    activeCurrencies: "사용 통화",
    originalAmounts: "원 결제 금액 그대로 보관",
    spendingBreakdown: "지출 분석",
    byCategory: "카테고리별 · {currency} 환산",
    currencyMix: "통화 구성",
    originalSpend: "원 통화 거래 비중",
    recent: "최근 거래",
    recentHint: "원 결제 금액과 {currency} 환산 금액",
    allActivity: "전체 내역",
    merchant: "사용처 또는 설명",
    category: "카테고리",
    chooseCategory: "카테고리 선택",
    categoryHint: "이 지출에 가장 알맞은 항목을 선택하세요.",
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
    signInNeeded: "로그인하면 나만의 가계부에 저장할 수 있어요.",
    previewMode: "가계부를 다시 연결하는 동안 예시 데이터를 표시합니다.",
    empty: "아직 거래가 없습니다. 첫 거래를 추가해 보세요.",
    housing: "주거",
    groceries: "식료품",
    transport: "교통",
    dining: "식음료",
    utilities: "공과금",
    health: "건강·의료",
    education: "교육",
    entertainment: "문화·여가",
    travel: "여행",
    shopping: "쇼핑",
    subscriptions: "구독",
    other: "기타",
    incomeCategory: "수입",
    language: "언어",
    privateLedger: "나만의 글로벌 가계부",
    logout: "로그아웃",
    helpTitle: "국경 없는 일상을 위해",
    helpBody: "원 결제 금액은 그대로, 기준 통화로는 예산을 분명하게 관리하세요.",
    learnMore: "환산 방식 보기",
    menu: "내비게이션 열기",
    deleteLabel: "{merchant} 삭제",
    convertedTo: "{currency} 기준",
    repeatTransaction: "이 거래 반복",
    repeatHint: "앞으로의 거래를 달력에 자동으로 생성합니다.",
    repeatFrequency: "반복 주기",
    weekly: "매주",
    monthly: "매월",
    yearly: "매년",
    repeatEnds: "종료일 (선택)",
    recurringEntry: "반복 거래",
    recurringEditHint: "변경 내용은 이번 거래에만 적용됩니다.",
    stopRecurring: "향후 반복 중단",
    stopRecurringConfirm: "이번 거래 이후의 반복을 중단할까요? 지난 거래는 유지됩니다.",
    recurringStopped: "향후 반복을 중단했습니다.",
    recurringStopFailed: "반복 거래를 중단하지 못했습니다.",
    recurrenceDateError: "반복 종료일은 첫 거래일과 같거나 이후여야 합니다.",
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
    addOnDate: "Add on {date}",
    noTransactions: "No transactions on this day.",
    moreTransactions: "+{count} more",
    edit: "Edit",
    editLabel: "Edit {merchant}",
    editTransaction: "Edit transaction",
    editSubtitle: "Update the entry while keeping its historical exchange-rate snapshot.",
    update: "Save changes",
    updating: "Saving changes…",
    updated: "Transaction updated.",
    historicalRate: "Saved historical rate",
    changedConflict: "This entry changed elsewhere. Reopen it and try again.",
    confirmDelete: "Delete {merchant}? This cannot be undone.",
    expenseTotal: "Expense",
    incomeTotal: "Income",
    note: "Note",
    notePlaceholder: "Optional details",
    openDate: "Open {date}",
    daySummary: "{count} entries, {expense} expense, {income} income",
  },
  ko: {
    calendar: "월별 달력",
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
    editSubtitle: "과거 환율 기록은 유지하면서 거래 내용을 변경합니다.",
    update: "변경사항 저장",
    updating: "변경사항 저장 중…",
    updated: "거래가 수정되었습니다.",
    historicalRate: "저장된 과거 환율",
    changedConflict: "다른 곳에서 변경된 거래입니다. 다시 열어 수정해 주세요.",
    confirmDelete: "{merchant} 거래를 삭제할까요? 이 작업은 되돌릴 수 없습니다.",
    expenseTotal: "지출",
    incomeTotal: "수입",
    note: "메모",
    notePlaceholder: "선택 사항",
    openDate: "{date} 열기",
    daySummary: "거래 {count}건, 지출 {expense}, 수입 {income}",
  },
} as const;

const CATEGORY_OPTIONS = [
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
  const locale = language === "ko" ? "ko-KR" : "en-US";
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
    return new Intl.NumberFormat(language === "ko" ? "ko-KR" : "en-US", {
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

function categoryLabel(category: string, language: Language) {
  const copy = COPY[language];
  const labels: Record<string, string> = {
    housing: copy.housing,
    groceries: copy.groceries,
    transport: copy.transport,
    dining: copy.dining,
    utilities: copy.utilities,
    health: copy.health,
    education: copy.education,
    entertainment: copy.entertainment,
    travel: copy.travel,
    shopping: copy.shopping,
    subscriptions: copy.subscriptions,
    other: copy.other,
    income: copy.incomeCategory,
  };
  return labels[category] ?? category;
}

function categoryGlyph(category: string) {
  const glyphs: Record<string, string> = {
    housing: "🏠",
    groceries: "🛒",
    dining: "🍽️",
    transport: "🚆",
    utilities: "💡",
    health: "🩺",
    education: "🎓",
    entertainment: "🎬",
    travel: "✈️",
    shopping: "🛍️",
    subscriptions: "🔁",
    income: "+",
    other: "•••",
  };
  return glyphs[category] ?? "•••";
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
}: {
  firstName: string | null;
  today: string;
}) {
  const [language, setLanguage] = useState<Language>("en");
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
  const [transactions, setTransactions] =
    useState<LedgerTransaction[]>(FALLBACK_TRANSACTIONS);
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
  const [category, setCategory] = useState("dining");
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [note, setNote] = useState("");
  const [occurredOn, setOccurredOn] = useState(today);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] =
    useState<RecurrenceFrequency>("monthly");
  const [recurrenceEndsOn, setRecurrenceEndsOn] = useState("");
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
  const calendarCopy = CALENDAR_COPY[language];
  const recurringFlowCopy = RECURRING_FLOW_COPY[language];
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
      const storedLanguage = window.localStorage.getItem("globeledger-language");
      const storedCurrency = window.localStorage.getItem(
        "globeledger-base-currency",
      );
      if (storedLanguage === "en" || storedLanguage === "ko") {
        setLanguage(storedLanguage);
      }
      if (storedCurrency && storedCurrency in FALLBACK_CURRENCIES) {
        setBaseCurrency(storedCurrency);
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
    window.localStorage.setItem("globeledger-language", language);
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem("globeledger-base-currency", baseCurrency);
  }, [baseCurrency]);

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
        const storedCurrency = window.localStorage.getItem(
          "globeledger-base-currency",
        );
        setBaseCurrency((current) =>
          storedCurrency && nextRates[storedCurrency]
            ? storedCurrency
            : nextRates[current]
              ? current
              : "USD",
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
      categoryOptionRefs.current[category]?.focus();
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
  }, [category, isCategoryPickerOpen]);

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

  const totals = useMemo(() => {
    let expenseUsdMinor = 0;
    let incomeUsdMinor = 0;
    const currencies = new Set<CurrencyCode>();
    const categories = new Map<string, number>();
    const currencyTotals = new Map<CurrencyCode, number>();

    for (const transaction of monthlyTransactions) {
      currencies.add(transaction.originalCurrency);
      if (transaction.kind === "income") {
        incomeUsdMinor += transaction.baseAmountMinor;
        continue;
      }
      expenseUsdMinor += transaction.baseAmountMinor;
      categories.set(
        transaction.category,
        (categories.get(transaction.category) ?? 0) + transaction.baseAmountMinor,
      );
      currencyTotals.set(
        transaction.originalCurrency,
        (currencyTotals.get(transaction.originalCurrency) ?? 0) +
          transaction.baseAmountMinor,
      );
    }

    return {
      expenseUsdMinor,
      incomeUsdMinor,
      currencies,
      categories: [...categories.entries()].sort((a, b) => b[1] - a[1]),
      currencyTotals: [...currencyTotals.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [monthlyTransactions]);

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
    let expenseUsdMinor = 0;
    let incomeUsdMinor = 0;
    for (const transaction of selectedTransactions) {
      if (transaction.kind === "income") {
        incomeUsdMinor += transaction.baseAmountMinor;
      } else {
        expenseUsdMinor += transaction.baseAmountMinor;
      }
    }
    return { expenseUsdMinor, incomeUsdMinor };
  }, [selectedTransactions]);

  const budgetUsdMinor = 350_000;
  const remainingUsdMinor = Math.max(0, budgetUsdMinor - totals.expenseUsdMinor);
  const budgetProgress = Math.min(
    100,
    Math.round((totals.expenseUsdMinor / budgetUsdMinor) * 100),
  );
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
      Number.isFinite(Number(editingTransaction.fxRate)) &&
      Number(editingTransaction.fxRate) > 0,
  );
  const formRateToUsd = usesStoredRate
    ? Number(editingTransaction?.fxRate)
    : ratesToUsd[currency] ?? 1;
  const conversionRate = formRateToUsd / (ratesToUsd[baseCurrency] ?? 1);
  const convertedPreview = Number(amount) ? Number(amount) * conversionRate : 0;
  const hasFrankfurterRate = Boolean(
    (rateMeta.status === "updated" || rateMeta.status === "stale") &&
      ratesToUsd[currency] &&
      rateMeta.rateDates[currency],
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
    ? rateMeta.rateDates[currency] ?? rateMeta.asOf
    : null;

  function rememberDrawerTrigger() {
    drawerTriggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : addButtonRef.current;
  }

  function openAddDrawer(date = selectedDate) {
    rememberDrawerTrigger();
    drawerReturnDateRef.current = date;
    setIsCategoryPickerOpen(false);
    setEditingTransaction(null);
    setKind("expense");
    setDescription("");
    setAmount("");
    setCurrency("KRW");
    setCategory("dining");
    setNote("");
    setOccurredOn(date);
    setIsRecurring(false);
    setRecurrenceFrequency("monthly");
    setRecurrenceEndsOn("");
    setIsDrawerOpen(true);
    setFormError("");
  }

  function openRecurringDrawer(date = selectedDate) {
    openAddDrawer(date);
    setIsRecurring(true);
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
    setCategory(
      transaction.kind === "income" ? "income" : transaction.category,
    );
    setNote(transaction.note ?? "");
    setOccurredOn(transaction.occurredOn);
    setIsRecurring(false);
    setRecurrenceFrequency("monthly");
    setRecurrenceEndsOn("");
    setIsDrawerOpen(true);
    setFormError("");
  }

  function chooseCategory(nextCategory: string) {
    setCategory(nextCategory);
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
      targetIndex = Math.min(CATEGORY_OPTIONS.length - 1, index + 1);
    }
    if (event.key === "ArrowUp") targetIndex = Math.max(0, index - 3);
    if (event.key === "ArrowDown") {
      targetIndex = Math.min(CATEGORY_OPTIONS.length - 1, index + 3);
    }
    if (event.key === "Home") targetIndex = 0;
    if (event.key === "End") targetIndex = CATEGORY_OPTIONS.length - 1;
    if (targetIndex === null) return;
    event.preventDefault();
    if (targetIndex === index) return;
    categoryOptionRefs.current[CATEGORY_OPTIONS[targetIndex]]?.focus();
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
    if (
      !editingTransaction &&
      isRecurring &&
      recurrenceEndsOn &&
      (!isIsoDate(recurrenceEndsOn) || recurrenceEndsOn < occurredOn)
    ) {
      setFormError(copy.recurrenceDateError);
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
          category: kind === "income" ? "income" : category,
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
      const savedTransaction = Array.isArray(payload.data)
        ? payload.data[0]
        : payload.data ?? payload.transaction;
      if (savedTransaction) {
        const savedMonth = savedTransaction.occurredOn.slice(0, 7);
        drawerReturnDateRef.current = savedTransaction.occurredOn;
        setTransactions((current) => {
          const withoutSaved = current.filter(
            (transaction) => transaction.id !== savedTransaction.id,
          );
          return savedMonth === viewMonth
            ? [savedTransaction, ...withoutSaved].sort(byNewestTransaction)
            : [savedTransaction];
        });
        setSelectedDate(savedTransaction.occurredOn);
        if (savedMonth !== viewMonth) {
          setIsSyncing(true);
          setViewMonth(savedMonth);
        }
      }
      setDescription("");
      setAmount("");
      setNote("");
      setToast(
        editingTransaction
          ? calendarCopy.updated
          : isRecurring
            ? recurringFlowCopy.saved
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
        template(calendarCopy.confirmDelete, {
          merchant: transaction.description,
        }),
      )
    ) {
      return;
    }
    const previous = transactions;
    setTransactions((current) => current.filter((item) => item.id !== transaction.id));
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

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/auth");
  }

  const locale = language === "ko" ? "ko-KR" : "en-US";
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
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-name">GlobeLedger</span>
        </div>

        <nav className="primary-nav">
          <span className="nav-item active"><span aria-hidden="true">●</span>{copy.overview}</span>
          <Link className="nav-item" href="/recurring"><span aria-hidden="true">↻</span>{recurringFlowCopy.manage}</Link>
          {["transactions", "budgets", "reports", "settings"].map((item) => (
            <button className="nav-item" key={item}>
              <span aria-hidden="true">·</span>
              {copy[item as keyof typeof copy]}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="borderless-note">
          <span className="note-orbit" aria-hidden="true">◎</span>
          <strong>{copy.helpTitle}</strong>
          <p>{copy.helpBody}</p>
          <button>{copy.learnMore} <span aria-hidden="true">→</span></button>
        </div>
        <div className="account-chip">
          <span className="avatar">{firstName?.[0]?.toUpperCase() ?? "G"}</span>
          <span>
            <strong>{firstName ?? "Global citizen"}</strong>
            <small>{copy.privateLedger}</small>
          </span>
          <button type="button" className="account-logout" onClick={() => void logout()}>{copy.logout}</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark" aria-hidden="true"><span /></span>
            <span className="brand-name">GlobeLedger</span>
          </div>
          <div className="page-title">
            <p>{firstName ? `${copy.greeting}, ${firstName}.` : `${copy.greetingFallback}.`}</p>
            <h1>{copy.subtitle}</h1>
          </div>
          <div className="topbar-actions">
            <div className="sync-state" aria-live="polite">
              <span className={isSyncing ? "sync-dot pulsing" : "sync-dot"} />
              <span>{isSyncing ? copy.syncing : copy.synced}</span>
            </div>
            <div className="language-switch" aria-label={copy.language}>
              <button
                aria-pressed={language === "en"}
                className={language === "en" ? "selected" : ""}
                onClick={() => setLanguage("en")}
              >
                EN
              </button>
              <button
                aria-pressed={language === "ko"}
                className={language === "ko" ? "selected" : ""}
                onClick={() => setLanguage("ko")}
              >
                한국어
              </button>
            </div>
            <label className="base-select">
              <span>{copy.baseCurrency}</span>
              <select
                value={baseCurrency}
                onChange={(event) => setBaseCurrency(event.target.value as CurrencyCode)}
              >
                {currencyCatalog.map((details) => (
                  <option key={details.code} value={details.code}>{details.code} · {details.name}</option>
                ))}
              </select>
            </label>
            <button className="primary-button desktop-add" onClick={() => openAddDrawer()} ref={addButtonRef}>
              <span aria-hidden="true">＋</span> {copy.addExpense}
            </button>
          </div>
        </header>

        <section className="month-heading" aria-labelledby="month-overview-title">
          <div className="month-heading-copy">
            <span className="eyebrow">{copy.overview}</span>
            <div className="month-title-row">
              <h2 id="month-overview-title" aria-live="polite">{monthLabel}</h2>
              <div className="month-controls" role="group" aria-label={calendarCopy.calendar}>
                <button type="button" onClick={() => navigateMonth(-1)} aria-label={calendarCopy.previousMonth}>‹</button>
                <button type="button" className="month-today" onClick={goToToday}>{calendarCopy.thisMonth}</button>
                <button type="button" onClick={() => navigateMonth(1)} aria-label={calendarCopy.nextMonth}>›</button>
              </div>
              <button
                type="button"
                className="recurring-add-button"
                onClick={() => openRecurringDrawer()}
                aria-label={`${recurringFlowCopy.add}: ${recurringFlowCopy.buttonHint}`}
              >
                <span aria-hidden="true">↻</span>
                <strong>{recurringFlowCopy.add}</strong>
              </button>
            </div>
          </div>
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
        </section>

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
                          let expenseUsdMinor = 0;
                          let incomeUsdMinor = 0;
                          for (const transaction of dayEntries) {
                            if (transaction.kind === "income") {
                              incomeUsdMinor += transaction.baseAmountMinor;
                            } else {
                              expenseUsdMinor += transaction.baseAmountMinor;
                            }
                          }
                          const expense = formatCompactCurrency(
                            inBaseCurrency(expenseUsdMinor, baseCurrency, ratesToUsd),
                            baseCurrency,
                            language,
                          );
                          const income = formatCompactCurrency(
                            inBaseCurrency(incomeUsdMinor, baseCurrency, ratesToUsd),
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
                                aria-label={`${template(calendarCopy.openDate, { date: dayLabel })}. ${template(calendarCopy.daySummary, { count: dayEntries.length, expense, income })}`}
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
                                      <i style={{ backgroundColor: CATEGORY_COLORS[transaction.category] ?? CATEGORY_COLORS.other }} />
                                      {transaction.isRecurring && <em>↻</em>}
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
                                    {expenseUsdMinor > 0 && <b>−{expense}</b>}
                                    {incomeUsdMinor > 0 && <b className="income">+{income}</b>}
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
                <p>{template(calendarCopy.transactionCount, { count: selectedTransactions.length })}</p>
              </div>
              <button type="button" className="day-add-button" onClick={() => openAddDrawer(selectedDate)} aria-label={template(calendarCopy.addOnDate, { date: selectedDateLabel })}>+</button>
            </div>
            <div className="day-summary-cards">
              <div>
                <span>{calendarCopy.expenseTotal}</span>
                <strong>−{formatCurrency(inBaseCurrency(selectedDayTotals.expenseUsdMinor, baseCurrency, ratesToUsd), baseCurrency, language)}</strong>
              </div>
              <div className="income">
                <span>{calendarCopy.incomeTotal}</span>
                <strong>+{formatCurrency(inBaseCurrency(selectedDayTotals.incomeUsdMinor, baseCurrency, ratesToUsd), baseCurrency, language)}</strong>
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
                      <span className="transaction-glyph" style={{ backgroundColor: `${CATEGORY_COLORS[transaction.category] ?? CATEGORY_COLORS.other}18`, color: CATEGORY_COLORS[transaction.category] ?? CATEGORY_COLORS.other }} aria-hidden="true">
                        {categoryGlyph(transaction.category)}
                      </span>
                      <span className="day-entry-copy">
                        <strong>{transaction.description}</strong>
                        <small>{transaction.isRecurring ? "↻ · " : ""}{categoryLabel(transaction.category, language)} · {formatCurrency(originalMajor(transaction), transaction.originalCurrency, language)} {transaction.originalCurrency}</small>
                      </span>
                      <span className={transaction.kind === "income" ? "day-entry-value income" : "day-entry-value"}>
                        {transaction.kind === "income" ? "+" : "−"}{formatCurrency(inBaseCurrency(transaction.baseAmountMinor, baseCurrency, ratesToUsd), baseCurrency, language)}
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

        <section className="metric-grid" aria-label={`${monthLabel} overview`}>
          <article className="metric-card metric-featured">
            <div className="metric-label"><span>{copy.spent}</span><span className="metric-icon">↗</span></div>
            <strong>{formatCurrency(inBaseCurrency(totals.expenseUsdMinor, baseCurrency, ratesToUsd), baseCurrency, language)}</strong>
            <p>{template(copy.across, { count: totals.currencies.size })}</p>
            <div className="micro-bars" aria-hidden="true">
              {[34, 58, 46, 72, 64, 88, 78, 100, 84, 94, 76, 90].map((height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
          </article>
          <article className="metric-card">
            <div className="metric-label"><span>{copy.budgetLeft}</span><span className="metric-icon pale">◔</span></div>
            <strong>{formatCurrency(inBaseCurrency(remainingUsdMinor, baseCurrency, ratesToUsd), baseCurrency, language)}</strong>
            <p>{budgetProgress}% {copy.ofBudget}</p>
            <div
              className="budget-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={budgetProgress}
              aria-label={`${budgetProgress}% ${copy.ofBudget}`}
            >
              <span style={{ width: `${budgetProgress}%` }} />
            </div>
          </article>
          <article className="metric-card">
            <div className="metric-label"><span>{copy.netFlow}</span><span className="metric-icon green">↕</span></div>
            <strong className="positive-amount">
              {formatCurrency(
                inBaseCurrency(totals.incomeUsdMinor - totals.expenseUsdMinor, baseCurrency, ratesToUsd),
                baseCurrency,
                language,
              )}
            </strong>
            <p>{copy.incomeMinusSpend}</p>
            <span className="income-pill">+ {formatCurrency(inBaseCurrency(totals.incomeUsdMinor, baseCurrency, ratesToUsd), baseCurrency, language)}</span>
          </article>
          <article className="metric-card">
            <div className="metric-label"><span>{copy.activeCurrencies}</span><span className="metric-icon blue">◎</span></div>
            <strong>{totals.currencies.size}</strong>
            <p>{copy.originalAmounts}</p>
            <div className="currency-stack" aria-label={[...totals.currencies].join(", ")}>
              {[...totals.currencies].slice(0, 5).map((code) => <span key={code}>{code}</span>)}
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
                    <span style={{ backgroundColor: CATEGORY_COLORS[item] ?? CATEGORY_COLORS.other }}>{categoryGlyph(item)}</span>
                    <strong>{categoryLabel(item, language)}</strong>
                  </div>
                  <div className="category-track" aria-hidden="true">
                    <span
                      style={{
                        "--category-color": CATEGORY_COLORS[item] ?? CATEGORY_COLORS.other,
                        "--bar-width": `${Math.max(8, (value / maxCategory) * 100)}%`,
                      } as CSSProperties}
                    />
                  </div>
                  <strong>{formatCurrency(inBaseCurrency(value, baseCurrency, ratesToUsd), baseCurrency, language)}</strong>
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
                    <small>{Math.round(value / Math.max(totals.expenseUsdMinor, 1) * 100)}%</small>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </section>

        <section className="panel transactions-panel">
          <div className="panel-heading transactions-heading">
            <div><h2>{copy.recent}</h2><p>{template(copy.recentHint, { currency: baseCurrency })}</p></div>
            <button className="text-button">{copy.allActivity} <span aria-hidden="true">→</span></button>
          </div>
          {monthlyTransactions.length ? (
            <div className="transaction-list">
              {monthlyTransactions.slice(0, 6).map((transaction) => (
                <article className="transaction-row" key={transaction.id}>
                  <span
                    className="transaction-glyph"
                    style={{
                      backgroundColor: `${CATEGORY_COLORS[transaction.category] ?? CATEGORY_COLORS.other}18`,
                      color: CATEGORY_COLORS[transaction.category] ?? CATEGORY_COLORS.other,
                    }}
                    aria-hidden="true"
                  >
                    {categoryGlyph(transaction.category)}
                  </span>
                  <div className="transaction-name">
                    <strong>{transaction.description}</strong>
                    <span>{transaction.isRecurring ? "↻ · " : ""}{categoryLabel(transaction.category, language)}</span>
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
                    <strong>{transaction.kind === "income" ? "+" : "−"}{formatCurrency(inBaseCurrency(transaction.baseAmountMinor, baseCurrency, ratesToUsd), baseCurrency, language)}</strong>
                    <span>{template(copy.convertedTo, { currency: baseCurrency })}</span>
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
          ) : <p className="empty-state">{copy.empty}</p>}
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
                <button type="button" aria-pressed={kind === "expense"} className={kind === "expense" ? "selected" : ""} onClick={() => { setKind("expense"); if (category === "income") setCategory("dining"); }}>{copy.expense}</button>
                <button type="button" aria-pressed={kind === "income"} className={kind === "income" ? "selected" : ""} onClick={() => { setIsCategoryPickerOpen(false); setKind("income"); setCategory("income"); }}>{copy.income}</button>
              </div>
              <label className="field">
                <span>{copy.merchant}</span>
                <input ref={descriptionRef} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={80} placeholder={kind === "expense" ? "COEX Coffee" : "Acme Studio"} />
              </label>
              <div className="field-row amount-row">
                <label className="field">
                  <span>{copy.amount}</span>
                  <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" aria-describedby="conversion-preview" />
                </label>
                <label className="field currency-field">
                  <span>{copy.currency}</span>
                  <select value={currency} onChange={(event) => setCurrency(event.target.value as CurrencyCode)}>
                    {transactionCurrencyCatalog.map((details) => <option key={details.code} value={details.code}>{details.code} · {details.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="conversion-preview" id="conversion-preview" aria-live="polite">
                <div><span>{copy.converted}</span><strong>{formatCurrency(convertedPreview, baseCurrency, language)} <small>{baseCurrency}</small></strong></div>
                <p>
                  1 {currency} = {conversionRate < 0.01 ? conversionRate.toFixed(6) : conversionRate.toFixed(4)} {baseCurrency}
                  {" · "}{usesStoredRate ? calendarCopy.historicalRate : currency === "USD" ? copy.identityRate : hasFrankfurterRate ? copy.rateProvider : copy.fallbackRate}
                  {selectedRateDate ? ` · ${copy.rateDate}: ${selectedRateDate}` : ""}
                  {" · "}{copy.savedRate}
                </p>
              </div>
              {kind === "expense" && (
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
                          backgroundColor: `${CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other}18`,
                          color: CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other,
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
                        <div id="category-options" className="category-option-grid" role="listbox" aria-labelledby="category-field-label">
                          {CATEGORY_OPTIONS.map((item, index) => {
                            const selected = item === category;
                            const color = CATEGORY_COLORS[item] ?? CATEGORY_COLORS.other;
                            return (
                              <button
                                ref={(node) => {
                                  categoryOptionRefs.current[item] = node;
                                }}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                tabIndex={selected ? 0 : -1}
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
                      </div>
                    )}
                  </div>
                </div>
              )}
              <label className="field">
                <span>{copy.date}</span>
                <input type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} required />
              </label>
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
