"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LanguagePicker } from "@/components/language-picker";
import {
  DEFAULT_LANGUAGE,
  isLanguage,
  LANGUAGE_STORAGE_KEY,
  persistLanguagePreference,
  type Language,
} from "@/lib/language";

type GuideItem = { title: string; body: string };
type FeatureItem = GuideItem & { action: string };
type GuideCopy = {
  title: string;
  subtitle: string;
  language: string;
  start: string;
  quickStart: string;
  quickStartHint: string;
  steps: GuideItem[];
  explore: string;
  exploreHint: string;
  features: FeatureItem[];
  goodToKnow: string;
  goodToKnowHint: string;
  notes: GuideItem[];
  faq: string;
  faqHint: string;
  questions: GuideItem[];
  closingTitle: string;
  closingBody: string;
  addTransaction: string;
  viewDashboard: string;
};

const COPY = {
  en: {
    title: "Get to know GlobeLedger",
    subtitle: "A practical guide to recording, planning, and reviewing money across currencies.",
    language: "Language",
    start: "Start here",
    quickStart: "Set up your ledger in three steps",
    quickStartHint: "You can change every setting later.",
    steps: [
      { title: "Choose your base currency", body: "Pick the currency you use to understand your overall balance. Each transaction still keeps its original currency." },
      { title: "Add your first transaction", body: "Enter an expense or income, then choose its date, category, payment currency, and optional details." },
      { title: "Review the month", body: "Use the calendar, recent activity, budgets, and reports to see where your money moved." },
    ],
    explore: "What you can do",
    exploreHint: "Open a feature to put it into practice.",
    features: [
      { title: "Overview", body: "See monthly cash flow, calendar totals, recent transactions, category spending, and currencies at a glance.", action: "Open overview" },
      { title: "Transactions", body: "Browse the full history and narrow it by text, type, category, or currency. Edit or remove entries when needed.", action: "View transactions" },
      { title: "Recurring transactions", body: "Manage repeating expenses and regular income separately, including schedules, pauses, and end dates.", action: "Manage recurring" },
      { title: "Budgets", body: "Set monthly limits by category, reuse last month’s plan, and track spending before it runs over.", action: "Plan a budget" },
      { title: "Reports", body: "Compare income and expenses, inspect daily flow, and break spending down by category, currency, and destination.", action: "Open reports" },
      { title: "Split and installments", body: "Distribute a total across several dates—for a hotel stay—or create monthly installment payments from one purchase.", action: "Add a transaction" },
    ],
    goodToKnow: "Built for multi-currency records",
    goodToKnowHint: "Three details that keep your totals understandable.",
    notes: [
      { title: "Original amounts stay original", body: "GlobeLedger saves the amount and currency you entered, so the source record does not drift with exchange rates." },
      { title: "Choose how to value history", body: "Reports can use the rate from each transaction date or today’s rate. No conversion is performed when payment and base currencies match." },
      { title: "Your ledger is account-specific", body: "Transactions, recurring items, budgets, and preferences belong to your signed-in account and are not shared with other members." },
    ],
    faq: "Common questions",
    faqHint: "Quick answers for the parts that are easy to miss.",
    questions: [
      { title: "Can I record a future transaction?", body: "Yes. Future entries are allowed. When no future exchange rate exists, GlobeLedger clearly marks the available rate basis." },
      { title: "Do I need to choose a subcategory?", body: "No. A main category is enough; subcategories are optional and only add detail to reports and searches." },
      { title: "Does my transaction currency change my base currency?", body: "No. The last-used transaction currency and your app-wide base currency are remembered independently." },
    ],
    closingTitle: "Ready to make the month clearer?",
    closingBody: "Start with one transaction. The calendar and reports will build themselves from there.",
    addTransaction: "Add transaction",
    viewDashboard: "View dashboard",
  },
  ko: {
    title: "GlobeLedger 사용법",
    subtitle: "여러 통화로 기록하고, 계획하고, 돌아보는 방법을 간결하게 안내합니다.",
    language: "언어",
    start: "처음 시작하기",
    quickStart: "세 단계로 가계부 설정하기",
    quickStartHint: "모든 설정은 나중에 다시 변경할 수 있습니다.",
    steps: [
      { title: "기준 통화 선택", body: "전체 자산 흐름을 확인할 기준 통화를 선택하세요. 각 거래의 원래 결제 통화는 그대로 보존됩니다." },
      { title: "첫 거래 추가", body: "지출 또는 수입을 선택하고 날짜, 카테고리, 결제 통화와 필요한 세부 내용을 입력하세요." },
      { title: "한 달의 흐름 확인", body: "달력과 최근 거래, 예산, 리포트를 통해 돈의 흐름을 확인하세요." },
    ],
    explore: "주요 기능",
    exploreHint: "설명이 필요한 기능을 바로 열어 사용해 보세요.",
    features: [
      { title: "대시보드", body: "월간 현금 흐름과 달력 합계, 최근 거래, 카테고리별 지출과 사용 통화를 한눈에 확인합니다.", action: "대시보드 열기" },
      { title: "거래 내역", body: "전체 기록을 보고 검색어, 거래 유형, 카테고리, 통화로 범위를 좁힙니다. 필요하면 수정하거나 삭제할 수 있습니다.", action: "거래 내역 보기" },
      { title: "반복 거래", body: "반복 지출과 정기 수입의 주기, 일시 정지, 종료일을 별도로 관리합니다.", action: "반복 거래 관리" },
      { title: "예산", body: "카테고리별 월간 한도를 설정하고 지난달 계획을 재사용하며 초과 전에 지출을 확인합니다.", action: "예산 계획하기" },
      { title: "리포트", body: "수입과 지출을 비교하고 일별 흐름, 카테고리, 통화, 사용처별 지출을 분석합니다.", action: "리포트 열기" },
      { title: "기간 분할 및 할부", body: "호텔 숙박처럼 총액을 여러 날짜에 나누거나 한 번의 구매를 월별 할부 거래로 생성합니다.", action: "거래 추가하기" },
    ],
    goodToKnow: "다중 통화 기록 방식",
    goodToKnowHint: "합계를 정확히 이해하는 데 필요한 세 가지 정보입니다.",
    notes: [
      { title: "원금액은 그대로 보존", body: "입력한 금액과 통화를 그대로 저장하므로 환율이 바뀌어도 원본 거래 기록은 변하지 않습니다." },
      { title: "과거 금액의 환산 기준 선택", body: "리포트에서 거래일 환율 또는 현재 환율을 선택할 수 있습니다. 결제 통화와 기준 통화가 같으면 환산하지 않습니다." },
      { title: "회원별 독립 데이터", body: "거래, 반복 항목, 예산과 설정은 로그인한 계정에만 속하며 다른 회원과 공유되지 않습니다." },
    ],
    faq: "자주 묻는 질문",
    faqHint: "놓치기 쉬운 기능을 빠르게 확인하세요.",
    questions: [
      { title: "미래 거래도 기록할 수 있나요?", body: "가능합니다. 미래 환율이 아직 없을 때는 현재 사용할 수 있는 환율 기준을 명확히 표시합니다." },
      { title: "세부 카테고리를 반드시 선택해야 하나요?", body: "아닙니다. 기본 카테고리만으로 저장할 수 있으며 세부 카테고리는 리포트와 검색을 더 자세하게 만들 때 선택합니다." },
      { title: "거래 통화를 바꾸면 기준 통화도 바뀌나요?", body: "바뀌지 않습니다. 마지막 거래 통화와 앱의 기준 통화는 서로 독립적으로 기억됩니다." },
    ],
    closingTitle: "이번 달의 흐름을 정리해 볼까요?",
    closingBody: "거래 하나부터 기록해 보세요. 달력과 리포트는 기록을 바탕으로 자동으로 완성됩니다.",
    addTransaction: "거래 추가",
    viewDashboard: "대시보드 보기",
  },
  ja: {
    title: "GlobeLedgerの使い方",
    subtitle: "複数の通貨で記録し、計画し、振り返る方法を分かりやすくご案内します。",
    language: "言語",
    start: "はじめに",
    quickStart: "3ステップで家計簿を準備",
    quickStartHint: "すべての設定は後から変更できます。",
    steps: [
      { title: "基本通貨を選ぶ", body: "家計全体を把握するための通貨を選びます。各取引の元の決済通貨はそのまま保存されます。" },
      { title: "最初の取引を追加", body: "支出または収入を選び、日付、カテゴリー、決済通貨、必要な詳細を入力します。" },
      { title: "1か月の流れを確認", body: "カレンダー、最近の取引、予算、レポートでお金の動きを確認します。" },
    ],
    explore: "主な機能",
    exploreHint: "気になる機能を開いて実際に使ってみましょう。",
    features: [
      { title: "ダッシュボード", body: "月間キャッシュフロー、カレンダー集計、最近の取引、カテゴリー別支出、使用通貨を一覧できます。", action: "ダッシュボードを開く" },
      { title: "取引履歴", body: "すべての履歴を確認し、キーワード、取引種別、カテゴリー、通貨で絞り込みます。編集や削除もできます。", action: "取引履歴を見る" },
      { title: "定期取引", body: "定期的な支出と収入について、頻度、一時停止、終了日を個別に管理します。", action: "定期取引を管理" },
      { title: "予算", body: "カテゴリーごとの月間上限を設定し、前月の計画を再利用して、超過する前に支出を確認します。", action: "予算を立てる" },
      { title: "レポート", body: "収入と支出を比較し、日別の流れ、カテゴリー、通貨、利用先ごとの支出を分析します。", action: "レポートを開く" },
      { title: "期間分割と分割払い", body: "ホテル滞在のように合計額を複数の日付へ分けたり、一度の購入を月々の分割取引として作成したりできます。", action: "取引を追加" },
    ],
    goodToKnow: "多通貨記録の仕組み",
    goodToKnowHint: "合計を正しく理解するための3つのポイントです。",
    notes: [
      { title: "元の金額をそのまま保存", body: "入力した金額と通貨が保存されるため、為替レートが変わっても元の取引記録は変わりません。" },
      { title: "過去の換算基準を選択", body: "レポートでは取引日のレートまたは現在のレートを選べます。決済通貨と基本通貨が同じ場合は換算しません。" },
      { title: "アカウントごとに独立", body: "取引、定期項目、予算、設定はログイン中のアカウントだけに属し、他の利用者とは共有されません。" },
    ],
    faq: "よくある質問",
    faqHint: "見落としやすい機能をすぐに確認できます。",
    questions: [
      { title: "未来の取引も記録できますか？", body: "はい。未来のレートがまだない場合は、現在利用できる為替レートの基準を明確に表示します。" },
      { title: "サブカテゴリーは必須ですか？", body: "いいえ。メインカテゴリーだけで保存できます。サブカテゴリーはレポートや検索を詳しくしたいときに選択します。" },
      { title: "取引通貨を変えると基本通貨も変わりますか？", body: "変わりません。最後に使用した取引通貨とアプリの基本通貨は別々に記憶されます。" },
    ],
    closingTitle: "今月のお金の流れを整理しましょう",
    closingBody: "まずは取引を1件記録してください。カレンダーとレポートは記録から自動で作られます。",
    addTransaction: "取引を追加",
    viewDashboard: "ダッシュボードを見る",
  },
  ru: {
    title: "Как пользоваться GlobeLedger",
    subtitle: "Краткое руководство по учёту, планированию и анализу финансов в разных валютах.",
    language: "Язык",
    start: "С чего начать",
    quickStart: "Настройте учёт за три шага",
    quickStartHint: "Все настройки можно изменить позже.",
    steps: [
      { title: "Выберите основную валюту", body: "Выберите валюту для общей картины финансов. Исходная валюта каждой операции при этом сохраняется." },
      { title: "Добавьте первую операцию", body: "Укажите расход или доход, дату, категорию, валюту платежа и при необходимости дополнительные сведения." },
      { title: "Оцените итоги месяца", body: "Просматривайте движение денег в календаре, последних операциях, бюджетах и отчётах." },
    ],
    explore: "Возможности",
    exploreHint: "Откройте нужный раздел и попробуйте его в работе.",
    features: [
      { title: "Обзор", body: "Просматривайте денежный поток за месяц, итоги календаря, последние операции, расходы по категориям и используемые валюты.", action: "Открыть обзор" },
      { title: "Операции", body: "Просматривайте всю историю и фильтруйте её по тексту, типу, категории или валюте. Записи можно изменять и удалять.", action: "Смотреть операции" },
      { title: "Регулярные операции", body: "Отдельно управляйте повторяющимися расходами и доходами: расписанием, паузами и датами окончания.", action: "Управлять регулярными" },
      { title: "Бюджеты", body: "Задавайте месячные лимиты по категориям, переносите план прошлого месяца и следите за расходами до превышения.", action: "Составить бюджет" },
      { title: "Отчёты", body: "Сравнивайте доходы и расходы, анализируйте движение по дням, категориям, валютам и местам покупок.", action: "Открыть отчёты" },
      { title: "Распределение и рассрочка", body: "Распределяйте общую сумму по нескольким датам — например, за проживание — или создавайте ежемесячные платежи по одной покупке.", action: "Добавить операцию" },
    ],
    goodToKnow: "Как устроен мультивалютный учёт",
    goodToKnowHint: "Три важных принципа, которые делают итоги понятными.",
    notes: [
      { title: "Исходные суммы сохраняются", body: "GlobeLedger хранит введённые сумму и валюту, поэтому исходная запись не меняется вслед за курсом." },
      { title: "Выбирайте способ оценки истории", body: "В отчётах можно использовать курс на дату операции или текущий курс. Если валюты платежа и учёта совпадают, пересчёта нет." },
      { title: "Данные разделены по аккаунтам", body: "Операции, регулярные записи, бюджеты и настройки относятся только к вашему аккаунту и не видны другим пользователям." },
    ],
    faq: "Частые вопросы",
    faqHint: "Короткие ответы о функциях, которые легко упустить.",
    questions: [
      { title: "Можно ли записать будущую операцию?", body: "Да. Если будущего курса ещё нет, GlobeLedger явно укажет, какой доступный курс используется." },
      { title: "Подкатегория обязательна?", body: "Нет. Достаточно основной категории; подкатегория лишь добавляет подробности в отчёты и поиск." },
      { title: "Валюта операции меняет основную валюту?", body: "Нет. Последняя валюта операции и основная валюта приложения запоминаются независимо друг от друга." },
    ],
    closingTitle: "Готовы увидеть месяц яснее?",
    closingBody: "Начните с одной операции — календарь и отчёты сформируются на основе ваших записей.",
    addTransaction: "Добавить операцию",
    viewDashboard: "Открыть обзор",
  },
} satisfies Record<Language, GuideCopy>;

const FEATURE_META = [
  { href: "/", glyph: "◷" },
  { href: "/transactions", glyph: "≡" },
  { href: "/recurring", glyph: "↻" },
  { href: "/budgets", glyph: "◎" },
  { href: "/reports", glyph: "◫" },
  { href: "/?new=transaction", glyph: "÷" },
] as const;

const NOTE_GLYPHS = ["¤", "↔", "⌂"] as const;

export function GuideContent({
  initialLanguage = DEFAULT_LANGUAGE,
}: {
  initialLanguage?: Language;
}) {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const copy = COPY[language];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (isLanguage(stored)) setLanguage(stored);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

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

  return (
    <div className="guide-page-shell">
      <main className="guide-main">
        <header className="guide-topbar">
          <div>
            <span className="eyebrow">GlobeLedger · {copy.start}</span>
            <h1>{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </div>
          <LanguagePicker value={language} label={copy.language} onChange={chooseLanguage} />
        </header>

        <section className="guide-hero" aria-labelledby="guide-quick-start">
          <div className="guide-section-heading">
            <span>01</span>
            <div><h2 id="guide-quick-start">{copy.quickStart}</h2><p>{copy.quickStartHint}</p></div>
          </div>
          <ol className="guide-steps">
            {copy.steps.map((step, index) => (
              <li key={step.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><h3>{step.title}</h3><p>{step.body}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section className="guide-section" aria-labelledby="guide-features">
          <div className="guide-section-heading">
            <span>02</span>
            <div><h2 id="guide-features">{copy.explore}</h2><p>{copy.exploreHint}</p></div>
          </div>
          <div className="guide-feature-grid">
            {copy.features.map((feature, index) => (
              <article key={feature.title}>
                <span className="guide-feature-glyph" aria-hidden="true">{FEATURE_META[index].glyph}</span>
                <div><h3>{feature.title}</h3><p>{feature.body}</p></div>
                <Link href={FEATURE_META[index].href}>{feature.action}<span aria-hidden="true">→</span></Link>
              </article>
            ))}
          </div>
        </section>

        <section className="guide-section guide-knowledge" aria-labelledby="guide-knowledge">
          <div className="guide-section-heading">
            <span>03</span>
            <div><h2 id="guide-knowledge">{copy.goodToKnow}</h2><p>{copy.goodToKnowHint}</p></div>
          </div>
          <div className="guide-note-grid">
            {copy.notes.map((note, index) => (
              <article key={note.title}>
                <span aria-hidden="true">{NOTE_GLYPHS[index]}</span>
                <div><h3>{note.title}</h3><p>{note.body}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section className="guide-section guide-faq" aria-labelledby="guide-faq">
          <div className="guide-section-heading">
            <span>04</span>
            <div><h2 id="guide-faq">{copy.faq}</h2><p>{copy.faqHint}</p></div>
          </div>
          <div className="guide-faq-list">
            {copy.questions.map((question, index) => (
              <details key={question.title} open={index === 0}>
                <summary>{question.title}<span aria-hidden="true">+</span></summary>
                <p>{question.body}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="guide-closing">
          <div><span className="eyebrow">GlobeLedger</span><h2>{copy.closingTitle}</h2><p>{copy.closingBody}</p></div>
          <div>
            <Link className="primary-button" href="/?new=transaction">+ {copy.addTransaction}</Link>
            <Link className="guide-secondary-link" href="/">{copy.viewDashboard}</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
