"use client";

import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Language = "en" | "ko";
type CurrencyCode = keyof typeof CURRENCIES;
type TransactionKind = "expense" | "income";

type LedgerTransaction = {
  id: string;
  kind: TransactionKind;
  occurredOn: string;
  originalAmountMinor: number;
  originalCurrency: CurrencyCode;
  originalExponent: number;
  fxRate: string;
  baseAmountMinor: number;
  baseCurrency: "USD";
  category: string;
  description: string;
  note?: string | null;
};

type TransactionApiResponse = {
  data?: LedgerTransaction[] | LedgerTransaction;
  transaction?: LedgerTransaction;
  error?: { code?: string; field?: string };
};

const CURRENCIES = {
  USD: { name: "US Dollar", exponent: 2, rateToUsd: 1 },
  KRW: { name: "South Korean Won", exponent: 0, rateToUsd: 0.000722 },
  EUR: { name: "Euro", exponent: 2, rateToUsd: 1.154 },
  JPY: { name: "Japanese Yen", exponent: 0, rateToUsd: 0.00681 },
  GBP: { name: "British Pound", exponent: 2, rateToUsd: 1.335 },
  SGD: { name: "Singapore Dollar", exponent: 2, rateToUsd: 0.778 },
  CAD: { name: "Canadian Dollar", exponent: 2, rateToUsd: 0.729 },
  AUD: { name: "Australian Dollar", exponent: 2, rateToUsd: 0.648 },
} as const;

const CATEGORY_COLORS: Record<string, string> = {
  housing: "#ee6c4d",
  groceries: "#3d7c6a",
  transport: "#4d6fdd",
  dining: "#cf8b2c",
  shopping: "#9b6acb",
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
    shopping: "Shopping",
    other: "Other",
    incomeCategory: "Income",
    language: "Language",
    privateLedger: "Your private global ledger",
    helpTitle: "Built for borderless lives",
    helpBody: "Original amounts stay intact, while one base view keeps your budget honest.",
    learnMore: "How conversions work",
    menu: "Open navigation",
    deleteLabel: "Delete {merchant}",
    convertedTo: "in {currency}",
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
    shopping: "쇼핑",
    other: "기타",
    incomeCategory: "수입",
    language: "언어",
    privateLedger: "나만의 글로벌 가계부",
    helpTitle: "국경 없는 일상을 위해",
    helpBody: "원 결제 금액은 그대로, 기준 통화로는 예산을 분명하게 관리하세요.",
    learnMore: "환산 방식 보기",
    menu: "내비게이션 열기",
    deleteLabel: "{merchant} 삭제",
    convertedTo: "{currency} 기준",
  },
} as const;

const CATEGORY_OPTIONS = [
  "housing",
  "groceries",
  "transport",
  "dining",
  "shopping",
  "other",
];

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
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: CURRENCIES[currency].exponent,
    maximumFractionDigits: CURRENCIES[currency].exponent,
  }).format(amount);
}

function originalMajor(transaction: LedgerTransaction) {
  return transaction.originalAmountMinor / 10 ** transaction.originalExponent;
}

function inBaseCurrency(usdMinor: number, currency: CurrencyCode) {
  return usdMinor / 100 / CURRENCIES[currency].rateToUsd;
}

function categoryLabel(category: string, language: Language) {
  const copy = COPY[language];
  const labels: Record<string, string> = {
    housing: copy.housing,
    groceries: copy.groceries,
    transport: copy.transport,
    dining: copy.dining,
    shopping: copy.shopping,
    other: copy.other,
    income: copy.incomeCategory,
  };
  return labels[category] ?? category;
}

function categoryGlyph(category: string) {
  const glyphs: Record<string, string> = {
    housing: "H",
    groceries: "G",
    transport: "T",
    dining: "D",
    shopping: "S",
    income: "+",
    other: "O",
  };
  return glyphs[category] ?? "O";
}

export function ExpenseTracker({ firstName }: { firstName: string | null }) {
  const [language, setLanguage] = useState<Language>("en");
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>("USD");
  const [transactions, setTransactions] =
    useState<LedgerTransaction[]>(FALLBACK_TRANSACTIONS);
  const [isSyncing, setIsSyncing] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("KRW");
  const [category, setCategory] = useState("dining");
  const [occurredOn, setOccurredOn] = useState("2026-08-06");
  const [formError, setFormError] = useState("");
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const copy = COPY[language];

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem("globeledger-language");
    const storedCurrency = window.localStorage.getItem("globeledger-base-currency");
    if (storedLanguage === "en" || storedLanguage === "ko") {
      setLanguage(storedLanguage);
    }
    if (storedCurrency && storedCurrency in CURRENCIES) {
      setBaseCurrency(storedCurrency as CurrencyCode);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("globeledger-language", language);
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem("globeledger-base-currency", baseCurrency);
  }, [baseCurrency]);

  useEffect(() => {
    const controller = new AbortController();
    const month = occurredOn.slice(0, 7);

    async function loadTransactions() {
      try {
        const response = await fetch(`/api/transactions?month=${month}&limit=50`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("LOAD_FAILED");
        const payload = (await response.json()) as TransactionApiResponse;
        if (Array.isArray(payload.data)) setTransactions(payload.data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setToast(copy.previewMode);
      } finally {
        setIsSyncing(false);
      }
    }

    void loadTransactions();
    return () => controller.abort();
  }, [occurredOn, copy.previewMode]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    descriptionRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeDrawer();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDrawerOpen]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const totals = useMemo(() => {
    let expenseUsdMinor = 0;
    let incomeUsdMinor = 0;
    const currencies = new Set<CurrencyCode>();
    const categories = new Map<string, number>();
    const currencyTotals = new Map<CurrencyCode, number>();

    for (const transaction of transactions) {
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
  }, [transactions]);

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

  const convertedPreview = Number(amount)
    ? Number(amount) * CURRENCIES[currency].rateToUsd / CURRENCIES[baseCurrency].rateToUsd
    : 0;

  function closeDrawer() {
    setIsDrawerOpen(false);
    setFormError("");
    window.setTimeout(() => addButtonRef.current?.focus(), 0);
  }

  function openDrawer() {
    setIsDrawerOpen(true);
    setFormError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

    setIsSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          occurredOn,
          amount,
          currency,
          rate: String(CURRENCIES[currency].rateToUsd),
          category: kind === "income" ? "income" : category,
          description: description.trim(),
          clientRequestId: crypto.randomUUID(),
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
        setTransactions((current) =>
          [savedTransaction, ...current].sort((a, b) =>
            b.occurredOn.localeCompare(a.occurredOn),
          ),
        );
      }
      setDescription("");
      setAmount("");
      setToast(copy.saved);
      closeDrawer();
    } catch (error) {
      setFormError(
        error instanceof Error && error.message === "UNAUTHENTICATED"
          ? copy.signInNeeded
          : copy.saveFailed,
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteTransaction(transaction: LedgerTransaction) {
    const previous = transactions;
    setTransactions((current) => current.filter((item) => item.id !== transaction.id));
    try {
      const response = await fetch(
        `/api/transactions?id=${encodeURIComponent(transaction.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("DELETE_FAILED");
      setToast(copy.deleted);
    } catch {
      setTransactions(previous);
      setToast(copy.deleteFailed);
    }
  }

  const locale = language === "ko" ? "ko-KR" : "en-US";
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(`${occurredOn.slice(0, 7)}-01T12:00:00`));

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-name">GlobeLedger</span>
        </div>

        <nav className="primary-nav">
          {[
            ["overview", "●"],
            ["transactions", "↕"],
            ["budgets", "◒"],
            ["reports", "▥"],
            ["settings", "⚙"],
          ].map(([item, icon], index) => (
            <button className={index === 0 ? "nav-item active" : "nav-item"} key={item}>
              <span aria-hidden="true">{icon}</span>
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
          <span aria-hidden="true">•••</span>
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
                {Object.entries(CURRENCIES).map(([code, details]) => (
                  <option key={code} value={code}>{code} · {details.name}</option>
                ))}
              </select>
            </label>
            <button className="primary-button desktop-add" onClick={openDrawer} ref={addButtonRef}>
              <span aria-hidden="true">＋</span> {copy.addExpense}
            </button>
          </div>
        </header>

        <section className="month-heading" aria-labelledby="month-overview-title">
          <div>
            <span className="eyebrow">{copy.overview}</span>
            <h2 id="month-overview-title">{monthLabel}</h2>
          </div>
          <span className="rate-note"><span aria-hidden="true">↻</span> {copy.sync}</span>
        </section>

        <section className="metric-grid" aria-label={`${monthLabel} overview`}>
          <article className="metric-card metric-featured">
            <div className="metric-label"><span>{copy.spent}</span><span className="metric-icon">↗</span></div>
            <strong>{formatCurrency(inBaseCurrency(totals.expenseUsdMinor, baseCurrency), baseCurrency, language)}</strong>
            <p>{template(copy.across, { count: totals.currencies.size })}</p>
            <div className="micro-bars" aria-hidden="true">
              {[34, 58, 46, 72, 64, 88, 78, 100, 84, 94, 76, 90].map((height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
          </article>
          <article className="metric-card">
            <div className="metric-label"><span>{copy.budgetLeft}</span><span className="metric-icon pale">◔</span></div>
            <strong>{formatCurrency(inBaseCurrency(remainingUsdMinor, baseCurrency), baseCurrency, language)}</strong>
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
                inBaseCurrency(totals.incomeUsdMinor - totals.expenseUsdMinor, baseCurrency),
                baseCurrency,
                language,
              )}
            </strong>
            <p>{copy.incomeMinusSpend}</p>
            <span className="income-pill">+ {formatCurrency(inBaseCurrency(totals.incomeUsdMinor, baseCurrency), baseCurrency, language)}</span>
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
                  <strong>{formatCurrency(inBaseCurrency(value, baseCurrency), baseCurrency, language)}</strong>
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
          {transactions.length ? (
            <div className="transaction-list">
              {transactions.slice(0, 6).map((transaction) => (
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
                    <span>{categoryLabel(transaction.category, language)}</span>
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
                    <strong>{transaction.kind === "income" ? "+" : "−"}{formatCurrency(inBaseCurrency(transaction.baseAmountMinor, baseCurrency), baseCurrency, language)}</strong>
                    <span>{template(copy.convertedTo, { currency: baseCurrency })}</span>
                  </div>
                  <button
                    className="delete-transaction"
                    onClick={() => void deleteTransaction(transaction)}
                    aria-label={template(copy.deleteLabel, { merchant: transaction.description })}
                  >
                    ×
                  </button>
                </article>
              ))}
            </div>
          ) : <p className="empty-state">{copy.empty}</p>}
        </section>

        <footer className="product-footer">
          <span>GlobeLedger</span><span>·</span><span>{copy.sync}</span>
        </footer>
      </main>

      <button className="primary-button mobile-add" onClick={openDrawer}>
        <span aria-hidden="true">＋</span> {copy.addExpense}
      </button>

      {isDrawerOpen && (
        <div className="drawer-layer">
          <button className="drawer-scrim" aria-label={copy.close} onClick={closeDrawer} />
          <aside className="transaction-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
            <div className="drawer-header">
              <div><span className="eyebrow">GlobeLedger</span><h2 id="drawer-title">{copy.drawerTitle}</h2><p>{copy.drawerSubtitle}</p></div>
              <button className="drawer-close" onClick={closeDrawer} aria-label={copy.close}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="kind-switch" aria-label={`${copy.expense} / ${copy.income}`}>
                <button type="button" className={kind === "expense" ? "selected" : ""} onClick={() => { setKind("expense"); if (category === "income") setCategory("dining"); }}>{copy.expense}</button>
                <button type="button" className={kind === "income" ? "selected" : ""} onClick={() => { setKind("income"); setCategory("income"); }}>{copy.income}</button>
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
                    {Object.entries(CURRENCIES).map(([code, details]) => <option key={code} value={code}>{code} · {details.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="conversion-preview" id="conversion-preview" aria-live="polite">
                <div><span>{copy.converted}</span><strong>{formatCurrency(convertedPreview, baseCurrency, language)} <small>{baseCurrency}</small></strong></div>
                <p>1 {currency} = {CURRENCIES[currency].rateToUsd / CURRENCIES[baseCurrency].rateToUsd < 0.01 ? (CURRENCIES[currency].rateToUsd / CURRENCIES[baseCurrency].rateToUsd).toFixed(6) : (CURRENCIES[currency].rateToUsd / CURRENCIES[baseCurrency].rateToUsd).toFixed(4)} {baseCurrency} · {copy.savedRate}</p>
              </div>
              {kind === "expense" && (
                <label className="field">
                  <span>{copy.category}</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value)}>
                    {CATEGORY_OPTIONS.map((item) => <option key={item} value={item}>{categoryLabel(item, language)}</option>)}
                  </select>
                </label>
              )}
              <label className="field">
                <span>{copy.date}</span>
                <input type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} />
              </label>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="drawer-actions">
                <button type="button" className="secondary-button" onClick={closeDrawer}>{copy.cancel}</button>
                <button type="submit" className="primary-button" disabled={isSaving}>{isSaving ? copy.saving : copy.save}</button>
              </div>
            </form>
          </aside>
        </div>
      )}

      <div className={toast ? "toast visible" : "toast"} aria-live="polite" aria-atomic="true">{toast}</div>
    </div>
  );
}
