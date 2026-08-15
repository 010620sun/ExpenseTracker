"use client";

import { type FormEvent, useEffect, useState } from "react";

import { isLanguage, type Language } from "@/lib/language";

type Mode = "login" | "register";

const COPY = {
  en: {
    title: "Your money, kept private.",
    subtitle: "One secure ledger for every currency you use.",
    login: "Log in",
    register: "Create account",
    name: "Name",
    email: "Email",
    password: "Password",
    passwordHint: "10–128 characters with at least one letter and number.",
    submitLogin: "Log in to GlobeLedger",
    submitRegister: "Create my private ledger",
    working: "Please wait…",
    newHere: "New to GlobeLedger?",
    already: "Already have an account?",
    privateTitle: "Member-isolated by design",
    privateBody: "Every transaction and recurring schedule is keyed to your account. Other members cannot read or modify it.",
    rateTitle: "Historical rates stay stable",
    rateBody: "Original currency and the exchange-rate snapshot remain attached to every entry.",
    genericError: "We couldn’t complete that request. Please try again.",
    invalid: "Check your email and password.",
    duplicate: "An account already exists for this email.",
    weak: "Use at least 10 characters with a letter and number.",
    limited: "Too many attempts. Please wait 15 minutes.",
    language: "Language",
  },
  ko: {
    title: "나만의 가계부를 안전하게.",
    subtitle: "사용하는 모든 통화를 하나의 보안 가계부에서 관리하세요.",
    login: "로그인",
    register: "회원가입",
    name: "이름",
    email: "이메일",
    password: "비밀번호",
    passwordHint: "영문과 숫자를 포함한 10–128자로 입력하세요.",
    submitLogin: "GlobeLedger 로그인",
    submitRegister: "나만의 가계부 만들기",
    working: "처리 중…",
    newHere: "GlobeLedger가 처음인가요?",
    already: "이미 계정이 있나요?",
    privateTitle: "회원별로 완전히 분리",
    privateBody: "모든 거래와 반복 일정은 회원 계정에 귀속되며 다른 회원은 조회하거나 변경할 수 없습니다.",
    rateTitle: "과거 환율 기록 보존",
    rateBody: "원 결제 통화와 당시 환율이 거래마다 함께 저장됩니다.",
    genericError: "요청을 처리하지 못했습니다. 다시 시도해 주세요.",
    invalid: "이메일과 비밀번호를 확인해 주세요.",
    duplicate: "이미 가입된 이메일입니다.",
    weak: "영문과 숫자를 포함한 10자 이상의 비밀번호를 사용하세요.",
    limited: "시도 횟수가 너무 많습니다. 15분 후 다시 시도하세요.",
    language: "언어",
  },
  ja: {
    title: "自分だけの家計簿を安全に。",
    subtitle: "あらゆる通貨を一つの安全な家計簿で管理できます。",
    login: "ログイン",
    register: "アカウント作成",
    name: "名前",
    email: "メールアドレス",
    password: "パスワード",
    passwordHint: "英字と数字を含む10〜128文字で入力してください。",
    submitLogin: "GlobeLedgerにログイン",
    submitRegister: "自分の家計簿を作成",
    working: "処理中…",
    newHere: "GlobeLedgerは初めてですか？",
    already: "すでにアカウントをお持ちですか？",
    privateTitle: "会員ごとに完全分離",
    privateBody: "すべての取引と繰り返しスケジュールはあなたのアカウントに紐づき、他の会員は閲覧・変更できません。",
    rateTitle: "過去のレートを安定して保存",
    rateBody: "元の通貨と取引時の為替レートが各取引に保存されます。",
    genericError: "リクエストを処理できませんでした。もう一度お試しください。",
    invalid: "メールアドレスとパスワードをご確認ください。",
    duplicate: "このメールアドレスはすでに登録されています。",
    weak: "英字と数字を含む10文字以上のパスワードを使用してください。",
    limited: "試行回数が多すぎます。15分後にもう一度お試しください。",
    language: "言語",
  },
  ru: {
    title: "Ваши финансы под надёжной защитой.",
    subtitle: "Единый безопасный бюджет для всех используемых валют.",
    login: "Войти",
    register: "Создать аккаунт",
    name: "Имя",
    email: "Электронная почта",
    password: "Пароль",
    passwordHint: "От 10 до 128 символов, включая букву и цифру.",
    submitLogin: "Войти в GlobeLedger",
    submitRegister: "Создать личный бюджет",
    working: "Подождите…",
    newHere: "Впервые в GlobeLedger?",
    already: "Уже есть аккаунт?",
    privateTitle: "Данные участников полностью разделены",
    privateBody: "Каждая операция и регулярное расписание принадлежат только вашему аккаунту. Другие участники не могут их просматривать или изменять.",
    rateTitle: "Исторические курсы сохраняются",
    rateBody: "Исходная валюта и снимок обменного курса остаются привязаны к каждой записи.",
    genericError: "Не удалось выполнить запрос. Попробуйте ещё раз.",
    invalid: "Проверьте электронную почту и пароль.",
    duplicate: "Аккаунт с этой почтой уже существует.",
    weak: "Используйте не менее 10 символов, включая букву и цифру.",
    limited: "Слишком много попыток. Повторите через 15 минут.",
    language: "Язык",
  },
} as const;

export function AuthScreen({ returnTo }: { returnTo: string }) {
  const [language, setLanguage] = useState<Language>("en");
  const [languageTouched, setLanguageTouched] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const copy = COPY[language];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem("globeledger-language");
      if (isLanguage(stored)) setLanguage(stored);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("globeledger-language", language);
  }, [language]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      });
      const payload = (await response.json()) as { error?: { code?: string } };
      if (!response.ok) {
        const code = payload.error?.code;
        setError(
          code === "INVALID_CREDENTIALS"
            ? copy.invalid
            : code === "EMAIL_ALREADY_REGISTERED"
              ? copy.duplicate
              : code === "WEAK_PASSWORD"
                ? copy.weak
                : code === "TOO_MANY_ATTEMPTS"
                  ? copy.limited
                  : copy.genericError,
        );
        return;
      }
      if (languageTouched) {
        try {
          await fetch("/api/preferences", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ language }),
          });
        } catch {
          // Authentication succeeded; the dashboard can retry the preference.
        }
      }
      window.location.assign(returnTo);
    } catch {
      setError(copy.genericError);
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
  }

  function chooseLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    setLanguageTouched(true);
  }

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand-lockup"><span className="brand-mark" aria-hidden="true"><span /></span><strong>GlobeLedger</strong></div>
        <div className="auth-message"><span className="eyebrow">Multi-currency household ledger</span><h1>{copy.title}</h1><p>{copy.subtitle}</p></div>
        <div className="auth-benefits">
          <article><span aria-hidden="true">◎</span><div><strong>{copy.privateTitle}</strong><p>{copy.privateBody}</p></div></article>
          <article><span aria-hidden="true">↻</span><div><strong>{copy.rateTitle}</strong><p>{copy.rateBody}</p></div></article>
        </div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-card-top"><div className="auth-tabs" role="tablist"><button role="tab" aria-selected={mode === "login"} className={mode === "login" ? "selected" : ""} onClick={() => switchMode("login")}>{copy.login}</button><button role="tab" aria-selected={mode === "register"} className={mode === "register" ? "selected" : ""} onClick={() => switchMode("register")}>{copy.register}</button></div><select className="auth-language" value={language} onChange={(event) => chooseLanguage(event.target.value as Language)} aria-label={copy.language}><option value="en">English</option><option value="ko">한국어</option><option value="ja">日本語</option><option value="ru">Русский</option></select></div>
          <h2>{mode === "login" ? copy.login : copy.register}</h2>
          <p>{mode === "login" ? copy.already : copy.newHere}</p>
          <form onSubmit={submit}>
            {mode === "register" && <label className="field"><span>{copy.name}</span><input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} required /></label>}
            <label className="field"><span>{copy.email}</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required /></label>
            <label className="field"><span>{copy.password}</span><input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} maxLength={128} required /><small>{copy.passwordHint}</small></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button auth-submit" disabled={busy}>{busy ? copy.working : mode === "login" ? copy.submitLogin : copy.submitRegister}</button>
          </form>
          <p className="auth-switch-copy">{mode === "login" ? copy.newHere : copy.already} <button onClick={() => switchMode(mode === "login" ? "register" : "login")}>{mode === "login" ? copy.register : copy.login}</button></p>
        </div>
      </section>
    </main>
  );
}
