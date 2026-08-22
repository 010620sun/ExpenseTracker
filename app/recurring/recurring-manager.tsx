"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { LanguagePicker } from "@/components/language-picker";
import {
  categoryGlyph,
  categoryGroupLabel,
  categoryGroupsForKind,
  categoryLabel,
  categoryPathLabel,
  subcategoryIdsForCategory,
  subcategoryLabel,
} from "@/lib/categories";
import {
  isLanguage,
  LANGUAGE_LOCALES,
  type Language,
} from "@/lib/language";

type Frequency = "weekly" | "monthly" | "yearly";
type SeriesStatus = "active" | "paused" | "ended";

type RecurringItem = {
  id: string;
  kind: "expense" | "income";
  description: string;
  category: string;
  subcategory: string | null;
  note: string;
  amount: string;
  originalAmountMinor: number;
  originalCurrency: string;
  originalCurrencyExponent: number;
  frequency: Frequency;
  startOn: string;
  endsOn: string | null;
  status: SeriesStatus;
  nextOccurrence: string | null;
  estimatedBaseAmountMinor: number;
  occurrenceCount: number;
  updatedAt: string;
};

type RecurringResponse = {
  data?: RecurringItem[];
  summary?: {
    month: string;
    active: number;
    paused: number;
    expectedIncomeMinor: number;
    expectedExpenseMinor: number;
  };
};

type PreferencesResponse = {
  data?: { language?: Language };
};

const COPY = {
  en: {
    back: "Overview",
    budgets: "Budgets",
    title: "Recurring transactions",
    subtitle: "Keep regular expenses and income predictable across currencies.",
    add: "Add recurring",
    active: "Active schedules",
    paused: "Paused",
    expense: "Expected expenses",
    income: "Expected income",
    monthEstimate: "Estimated for this month in USD",
    all: "All",
    activeFilter: "Active",
    pausedFilter: "Paused",
    endedFilter: "Ended",
    empty: "No recurring schedules in this view.",
    next: "Next",
    noNext: "No upcoming entry",
    started: "Started",
    ends: "Ends",
    never: "No end date",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
    edit: "Edit",
    pause: "Pause",
    resume: "Resume",
    delete: "Delete",
    deleteConfirm: "Delete this recurring schedule and all of its entries?",
    editTitle: "Edit recurring schedule",
    description: "Description",
    amount: "Amount",
    frequency: "Frequency",
    category: "Category",
    subcategory: "Details (optional)",
    noSubcategory: "No detail",
    endDate: "End date (optional)",
    note: "Note",
    save: "Save changes",
    cancel: "Cancel",
    loading: "Loading recurring schedules…",
    loadFailed: "We couldn’t load recurring schedules.",
    actionFailed: "We couldn’t update that schedule.",
    saved: "Recurring schedule updated.",
    deleted: "Recurring schedule deleted.",
    pausedToast: "Recurring schedule paused.",
    resumedToast: "Recurring schedule resumed.",
    language: "Language",
    activeStatus: "Active",
    pausedStatus: "Paused",
    endedStatus: "Ended",
    privateLedger: "Your private global ledger",
    logout: "Log out",
  },
  ko: {
    back: "대시보드",
    budgets: "예산 관리",
    title: "반복 거래 관리",
    subtitle: "반복 지출과 정기 수입을 통화별로 한곳에서 관리하세요.",
    add: "반복 거래 추가",
    active: "활성 일정",
    paused: "일시정지",
    expense: "예상 지출",
    income: "예상 수입",
    monthEstimate: "이번 달 USD 기준 예상 금액",
    all: "전체",
    activeFilter: "활성",
    pausedFilter: "일시정지",
    endedFilter: "종료",
    empty: "해당하는 반복 일정이 없습니다.",
    next: "다음 거래",
    noNext: "예정된 거래 없음",
    started: "시작일",
    ends: "종료일",
    never: "종료일 없음",
    weekly: "매주",
    monthly: "매월",
    yearly: "매년",
    edit: "수정",
    pause: "일시정지",
    resume: "재개",
    delete: "삭제",
    deleteConfirm: "이 반복 일정과 연결된 모든 거래를 삭제할까요?",
    editTitle: "반복 일정 수정",
    description: "설명",
    amount: "금액",
    frequency: "반복 주기",
    category: "카테고리",
    subcategory: "세부 카테고리(선택)",
    noSubcategory: "선택 안 함",
    endDate: "종료일 (선택)",
    note: "메모",
    save: "변경사항 저장",
    cancel: "취소",
    loading: "반복 일정을 불러오는 중…",
    loadFailed: "반복 일정을 불러오지 못했습니다.",
    actionFailed: "반복 일정을 변경하지 못했습니다.",
    saved: "반복 일정이 수정되었습니다.",
    deleted: "반복 일정이 삭제되었습니다.",
    pausedToast: "반복 일정을 일시정지했습니다.",
    resumedToast: "반복 일정을 재개했습니다.",
    language: "언어",
    activeStatus: "활성",
    pausedStatus: "일시정지",
    endedStatus: "종료",
    privateLedger: "나만의 글로벌 가계부",
    logout: "로그아웃",
  },
  ja: {
    back: "概要",
    budgets: "予算管理",
    title: "繰り返し取引",
    subtitle: "通貨をまたぐ定期支出と収入を見通しよく管理します。",
    add: "繰り返し取引を追加",
    active: "有効なスケジュール",
    paused: "一時停止",
    expense: "予想支出",
    income: "予想収入",
    monthEstimate: "今月のUSD換算予想額",
    all: "すべて",
    activeFilter: "有効",
    pausedFilter: "一時停止",
    endedFilter: "終了",
    empty: "該当する繰り返しスケジュールはありません。",
    next: "次回",
    noNext: "今後の予定なし",
    started: "開始日",
    ends: "終了日",
    never: "終了日なし",
    weekly: "毎週",
    monthly: "毎月",
    yearly: "毎年",
    edit: "編集",
    pause: "一時停止",
    resume: "再開",
    delete: "削除",
    deleteConfirm: "この繰り返しスケジュールと関連するすべての取引を削除しますか？",
    editTitle: "繰り返しスケジュールを編集",
    description: "説明",
    amount: "金額",
    frequency: "周期",
    category: "カテゴリー",
    subcategory: "詳細カテゴリー（任意）",
    noSubcategory: "指定なし",
    endDate: "終了日（任意）",
    note: "メモ",
    save: "変更を保存",
    cancel: "キャンセル",
    loading: "繰り返しスケジュールを読み込み中…",
    loadFailed: "繰り返しスケジュールを読み込めませんでした。",
    actionFailed: "スケジュールを更新できませんでした。",
    saved: "繰り返しスケジュールを更新しました。",
    deleted: "繰り返しスケジュールを削除しました。",
    pausedToast: "繰り返しスケジュールを一時停止しました。",
    resumedToast: "繰り返しスケジュールを再開しました。",
    language: "言語",
    activeStatus: "有効",
    pausedStatus: "一時停止",
    endedStatus: "終了",
    privateLedger: "自分だけのグローバル家計簿",
    logout: "ログアウト",
  },
  ru: {
    back: "Обзор",
    budgets: "Бюджеты",
    title: "Регулярные операции",
    subtitle: "Планируйте регулярные расходы и доходы в разных валютах.",
    add: "Добавить регулярную",
    active: "Активные расписания",
    paused: "Приостановлено",
    expense: "Ожидаемые расходы",
    income: "Ожидаемые доходы",
    monthEstimate: "Оценка на этот месяц в USD",
    all: "Все",
    activeFilter: "Активные",
    pausedFilter: "На паузе",
    endedFilter: "Завершённые",
    empty: "В этом разделе нет регулярных расписаний.",
    next: "Следующая",
    noNext: "Нет предстоящих записей",
    started: "Начало",
    ends: "Окончание",
    never: "Без даты окончания",
    weekly: "Еженедельно",
    monthly: "Ежемесячно",
    yearly: "Ежегодно",
    edit: "Изменить",
    pause: "Приостановить",
    resume: "Возобновить",
    delete: "Удалить",
    deleteConfirm: "Удалить это расписание и все связанные операции?",
    editTitle: "Изменить регулярное расписание",
    description: "Описание",
    amount: "Сумма",
    frequency: "Периодичность",
    category: "Категория",
    subcategory: "Подкатегория (необязательно)",
    noSubcategory: "Без уточнения",
    endDate: "Дата окончания (необязательно)",
    note: "Заметка",
    save: "Сохранить изменения",
    cancel: "Отмена",
    loading: "Загрузка регулярных расписаний…",
    loadFailed: "Не удалось загрузить регулярные расписания.",
    actionFailed: "Не удалось обновить расписание.",
    saved: "Регулярное расписание обновлено.",
    deleted: "Регулярное расписание удалено.",
    pausedToast: "Регулярное расписание приостановлено.",
    resumedToast: "Регулярное расписание возобновлено.",
    language: "Язык",
    activeStatus: "Активно",
    pausedStatus: "Приостановлено",
    endedStatus: "Завершено",
    privateLedger: "Ваш личный глобальный бюджет",
    logout: "Выйти",
  },
} as const;

function money(minor: number, currency: string, language: Language) {
  return new Intl.NumberFormat(LANGUAGE_LOCALES[language], {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(minor / 100);
}

function dateLabel(value: string, language: Language) {
  return new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function RecurringManager({ today }: { today: string }) {
  const [language, setLanguage] = useState<Language>("en");
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [summary, setSummary] = useState<RecurringResponse["summary"]>();
  const [filter, setFilter] = useState<"all" | SeriesStatus>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState<RecurringItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [category, setCategory] = useState("other");
  const [subcategory, setSubcategory] = useState("");
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [endsOn, setEndsOn] = useState("");
  const [note, setNote] = useState("");
  const copy = COPY[language];

  async function loadItems() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/recurring?today=${today}&month=${today.slice(0, 7)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as RecurringResponse;
      if (!response.ok || !Array.isArray(payload.data)) throw new Error();
      setItems(payload.data);
      setSummary(payload.summary);
    } catch {
      setError(copy.loadFailed);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem("globeledger-language");
      if (isLanguage(stored)) setLanguage(stored);
      void loadItems();
    });
    async function loadLanguage() {
      try {
        const response = await fetch("/api/preferences", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as PreferencesResponse;
        if (isLanguage(payload.data?.language)) {
          setLanguage(payload.data.language);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    void loadLanguage();
    return () => {
      controller.abort();
      window.cancelAnimationFrame(frame);
    };
    // Load only once; language changes translate existing data locally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("globeledger-language", language);
  }, [language]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleItems = useMemo(
    () => items.filter((item) => filter === "all" || item.status === filter),
    [filter, items],
  );

  function startEdit(item: RecurringItem) {
    setEditing(item);
    setDescription(item.description);
    setAmount(item.amount);
    setFrequency(item.frequency);
    setCategory(item.category);
    setSubcategory(item.subcategory ?? "");
    setIsCategoryPickerOpen(false);
    setEndsOn(item.endsOn ?? "");
    setNote(item.note);
    setError("");
  }

  async function mutate(id: string, body: Record<string, unknown>) {
    const response = await fetch(`/api/recurring?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error();
  }

  async function togglePause(item: RecurringItem) {
    setSaving(true);
    setError("");
    try {
      const resume = item.status === "paused";
      await mutate(item.id, { action: resume ? "resume" : "pause" });
      await loadItems();
      setToast(resume ? copy.resumedToast : copy.pausedToast);
    } catch {
      setError(copy.actionFailed);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSeries(item: RecurringItem) {
    if (!window.confirm(copy.deleteConfirm)) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/recurring?id=${encodeURIComponent(item.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error();
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setToast(copy.deleted);
    } catch {
      setError(copy.actionFailed);
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      await mutate(editing.id, {
        action: "update",
        description,
        amount,
        frequency,
        category,
        subcategory: subcategory || null,
        endsOn: endsOn || null,
        note,
      });
      setEditing(null);
      await loadItems();
      setToast(copy.saved);
    } catch {
      setError(copy.actionFailed);
    } finally {
      setSaving(false);
    }
  }

  const categoryGroups = categoryGroupsForKind(editing?.kind ?? "expense");
  const subcategoryOptions = subcategoryIdsForCategory(category);

  const statusText = (status: SeriesStatus) =>
    status === "active"
      ? copy.activeStatus
      : status === "paused"
        ? copy.pausedStatus
        : copy.endedStatus;

  function chooseLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    void fetch("/api/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language: nextLanguage }),
    }).catch(() => undefined);
  }

  return (
    <div className="recurring-page-shell">
      <main className="recurring-main">
        <header className="recurring-topbar">
          <div>
            <span className="eyebrow">GlobeLedger</span>
            <h1>{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </div>
          <div className="recurring-top-actions">
            <LanguagePicker value={language} label={copy.language} onChange={chooseLanguage} />
            <Link className="primary-button recurring-create" href="/?new=recurring">↻ {copy.add}</Link>
          </div>
        </header>

        <section className="recurring-summary-grid" aria-label={copy.monthEstimate}>
          <article><span>{copy.active}</span><strong>{summary?.active ?? 0}</strong><small>{copy.monthEstimate}</small></article>
          <article><span>{copy.paused}</span><strong>{summary?.paused ?? 0}</strong><small>{copy.monthEstimate}</small></article>
          <article className="expense"><span>{copy.expense}</span><strong>{money(summary?.expectedExpenseMinor ?? 0, "USD", language)}</strong><small>{copy.monthEstimate}</small></article>
          <article className="income"><span>{copy.income}</span><strong>{money(summary?.expectedIncomeMinor ?? 0, "USD", language)}</strong><small>{copy.monthEstimate}</small></article>
        </section>

        <section className="recurring-list-panel">
          <div className="recurring-list-heading">
            <div className="recurring-filters" role="group" aria-label={copy.title}>
              {(["all", "active", "paused", "ended"] as const).map((value) => (
                <button key={value} className={filter === value ? "selected" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>
                  {value === "all" ? copy.all : value === "active" ? copy.activeFilter : value === "paused" ? copy.pausedFilter : copy.endedFilter}
                </button>
              ))}
            </div>
            <span>{visibleItems.length}</span>
          </div>

          {error && <p className="recurring-error" role="alert">{error}</p>}
          {loading ? (
            <p className="recurring-empty">{copy.loading}</p>
          ) : visibleItems.length === 0 ? (
            <p className="recurring-empty">{copy.empty}</p>
          ) : (
            <div className="recurring-list">
              {visibleItems.map((item) => (
                <article className="recurring-series-card" key={item.id}>
                  <div className={`series-kind ${item.kind}`} aria-hidden="true">{item.kind === "income" ? "+" : "−"}</div>
                  <div className="series-primary">
                    <div className="series-title-row">
                      <strong>{item.description}</strong>
                      <span className={`series-status ${item.status}`}>{statusText(item.status)}</span>
                    </div>
                    <span>{categoryPathLabel(item.category, item.subcategory, language)} · {copy[item.frequency]}</span>
                    <div className="series-dates">
                      <span><b>{copy.next}</b> {item.nextOccurrence ? dateLabel(item.nextOccurrence, language) : copy.noNext}</span>
                      <span><b>{copy.started}</b> {dateLabel(item.startOn, language)}</span>
                      <span><b>{copy.ends}</b> {item.endsOn ? dateLabel(item.endsOn, language) : copy.never}</span>
                    </div>
                  </div>
                  <div className="series-value">
                    <strong>{item.amount} <small>{item.originalCurrency}</small></strong>
                    <span>{item.occurrenceCount}× · {money(item.estimatedBaseAmountMinor, "USD", language)}</span>
                  </div>
                  <div className="series-actions">
                    <button onClick={() => startEdit(item)} disabled={saving}>{copy.edit}</button>
                    {item.status !== "ended" && <button onClick={() => void togglePause(item)} disabled={saving}>{item.status === "paused" ? copy.resume : copy.pause}</button>}
                    <button className="danger" onClick={() => void deleteSeries(item)} disabled={saving}>{copy.delete}</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {editing && (
        <div className="recurring-dialog-layer">
          <button className="drawer-scrim" aria-label={copy.cancel} onClick={() => { setEditing(null); setIsCategoryPickerOpen(false); }} disabled={saving} />
          <section className="recurring-dialog" role="dialog" aria-modal="true" aria-labelledby="recurring-dialog-title">
            <div className="drawer-header">
              <div><span className="eyebrow">GlobeLedger</span><h2 id="recurring-dialog-title">{copy.editTitle}</h2><p>{editing.originalCurrency} · {copy[editing.frequency]}</p></div>
              <button className="drawer-close" aria-label={copy.cancel} onClick={() => { setEditing(null); setIsCategoryPickerOpen(false); }} disabled={saving}>×</button>
            </div>
            <form onSubmit={saveEdit}>
              <label className="field"><span>{copy.description}</span><input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={120} required /></label>
              <div className="field-row">
                <label className="field"><span>{copy.amount}</span><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
                <label className="field"><span>{copy.frequency}</span><select value={frequency} onChange={(event) => setFrequency(event.target.value as Frequency)}><option value="weekly">{copy.weekly}</option><option value="monthly">{copy.monthly}</option><option value="yearly">{copy.yearly}</option></select></label>
              </div>
              <div className="field-row">
                <div className="field recurring-category-field">
                  <span>{copy.category}</span>
                  <button
                    type="button"
                    className="recurring-category-trigger"
                    aria-haspopup="listbox"
                    aria-expanded={isCategoryPickerOpen}
                    onClick={() => setIsCategoryPickerOpen((open) => !open)}
                  >
                    <span aria-hidden="true">{categoryGlyph(category)}</span>
                    <strong>{categoryLabel(category, language)}</strong>
                    <i aria-hidden="true">⌄</i>
                  </button>
                  {isCategoryPickerOpen && (
                    <div className="recurring-category-options" role="listbox" aria-label={copy.category}>
                      {categoryGroups.map(({ group, categories }) => (
                        <section className="recurring-category-group" role="group" aria-label={categoryGroupLabel(group, language)} key={group}>
                          <span>{categoryGroupLabel(group, language)}</span>
                          {categories.map((key) => (
                            <button
                              type="button"
                              role="option"
                              aria-selected={category === key}
                              className={category === key ? "selected" : ""}
                              key={key}
                              onClick={() => {
                                setCategory(key);
                                setSubcategory("");
                                setIsCategoryPickerOpen(false);
                              }}
                            >
                              <span aria-hidden="true">{categoryGlyph(key)}</span>
                              <strong>{categoryLabel(key, language)}</strong>
                              <i aria-hidden="true">{category === key ? "✓" : ""}</i>
                            </button>
                          ))}
                        </section>
                      ))}
                    </div>
                  )}
                </div>
                <label className="field"><span>{copy.endDate}</span><input type="date" min={editing.startOn} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} /></label>
              </div>
              {subcategoryOptions.length > 0 && (
                <div className="field recurring-subcategory-field">
                  <span>{copy.subcategory}</span>
                  <div className="subcategory-options" role="group" aria-label={copy.subcategory}>
                    <button type="button" className={!subcategory ? "selected" : ""} aria-pressed={!subcategory} onClick={() => setSubcategory("")}>{copy.noSubcategory}</button>
                    {subcategoryOptions.map((item) => (
                      <button type="button" className={subcategory === item ? "selected" : ""} aria-pressed={subcategory === item} key={item} onClick={() => setSubcategory(item)}>{subcategoryLabel(item, language)}</button>
                    ))}
                  </div>
                </div>
              )}
              <label className="field"><span>{copy.note}</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} /></label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="drawer-actions"><button type="button" className="secondary-button" onClick={() => { setEditing(null); setIsCategoryPickerOpen(false); }} disabled={saving}>{copy.cancel}</button><button className="primary-button" aria-disabled={saving}>{copy.save}</button></div>
            </form>
          </section>
        </div>
      )}
      <div className={toast ? "toast visible" : "toast"} aria-live="polite">{toast}</div>
    </div>
  );
}
