"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { LanguagePicker } from "@/components/language-picker";
import {
  DEFAULT_LANGUAGE,
  isLanguage,
  LANGUAGE_STORAGE_KEY,
  persistLanguagePreference,
  type Language,
} from "@/lib/language";

type Mode = "login" | "register";

const COPY = {
  en: {
    eyebrow: "Multi-currency household ledger",
    title: "Your money, kept private.",
    subtitle: "One secure ledger for every currency you use.",
    login: "Log in",
    register: "Create account",
    loginIntro: "Welcome back. Enter your details to continue.",
    registerIntro: "Create an account to start your private ledger.",
    name: "Name",
    email: "Email",
    password: "Password",
    passwordHint: "10–128 characters with at least one letter and number.",
    submitLogin: "Log in to GlobeLedger",
    submitRegister: "Create my private ledger",
    working: "Please wait…",
    newHere: "New to GlobeLedger?",
    already: "Already have an account?",
    privateTitle: "Private by design",
    privateBody: "Every transaction and recurring schedule is linked to your account. No other user can view or change it.",
    rateTitle: "Transaction-date rates stay fixed",
    rateBody: "The original currency and saved exchange rate remain attached to every entry.",
    genericError: "We couldn’t complete that request. Please try again.",
    invalid: "Check your email and password.",
    duplicate: "An account already exists for this email.",
    weak: "Use at least 10 characters with a letter and number.",
    limited: "Too many attempts. Please wait 15 minutes.",
    language: "Language",
  },
  ko: {
    eyebrow: "다중 통화 가계부",
    title: "나만의 가계부를 안전하게.",
    subtitle: "사용하는 모든 통화를 하나의 보안 가계부에서 관리하세요.",
    login: "로그인",
    register: "회원가입",
    loginIntro: "다시 오신 것을 환영합니다. 로그인 정보를 입력하세요.",
    registerIntro: "계정을 만들고 나만의 가계부를 시작하세요.",
    name: "이름",
    email: "이메일",
    password: "비밀번호",
    passwordHint: "영문과 숫자를 포함한 10–128자로 입력하세요.",
    submitLogin: "GlobeLedger 로그인",
    submitRegister: "나만의 가계부 만들기",
    working: "처리 중…",
    newHere: "GlobeLedger가 처음인가요?",
    already: "이미 계정이 있나요?",
    privateTitle: "계정별 데이터 분리",
    privateBody: "모든 거래와 반복 일정은 내 계정에만 귀속되며 다른 사용자는 조회하거나 변경할 수 없습니다.",
    rateTitle: "거래 당시 환율 보존",
    rateBody: "원 결제 통화와 당시 환율이 거래마다 함께 저장됩니다.",
    genericError: "요청을 처리하지 못했습니다. 다시 시도해 주세요.",
    invalid: "이메일과 비밀번호를 확인해 주세요.",
    duplicate: "이미 가입된 이메일입니다.",
    weak: "영문과 숫자를 포함한 10자 이상의 비밀번호를 사용하세요.",
    limited: "시도 횟수가 너무 많습니다. 15분 후 다시 시도하세요.",
    language: "언어",
  },
  ja: {
    eyebrow: "多通貨対応の家計簿",
    title: "自分だけの家計簿を安全に。",
    subtitle: "あらゆる通貨を一つの安全な家計簿で管理できます。",
    login: "ログイン",
    register: "アカウント作成",
    loginIntro: "おかえりなさい。ログイン情報を入力してください。",
    registerIntro: "アカウントを作成して、自分の家計簿を始めましょう。",
    name: "名前",
    email: "メールアドレス",
    password: "パスワード",
    passwordHint: "英字と数字を含む10〜128文字で入力してください。",
    submitLogin: "GlobeLedgerにログイン",
    submitRegister: "自分の家計簿を作成",
    working: "処理中…",
    newHere: "GlobeLedgerは初めてですか？",
    already: "すでにアカウントをお持ちですか？",
    privateTitle: "アカウントごとにデータを分離",
    privateBody: "すべての取引と定期取引は自分のアカウントに紐づき、他のユーザーは閲覧・変更できません。",
    rateTitle: "取引時の為替レートを保存",
    rateBody: "元の通貨と取引時の為替レートが各取引に保存されます。",
    genericError: "リクエストを処理できませんでした。もう一度お試しください。",
    invalid: "メールアドレスとパスワードをご確認ください。",
    duplicate: "このメールアドレスはすでに登録されています。",
    weak: "英字と数字を含む10文字以上のパスワードを使用してください。",
    limited: "試行回数が多すぎます。15分後にもう一度お試しください。",
    language: "言語",
  },
  ru: {
    eyebrow: "Мультивалютный учёт семейных финансов",
    title: "Ваши финансы под надёжной защитой.",
    subtitle: "Единый защищённый учёт всех используемых валют.",
    login: "Войти",
    register: "Создать аккаунт",
    loginIntro: "С возвращением. Введите данные для входа.",
    registerIntro: "Создайте аккаунт и начните вести личный учёт финансов.",
    name: "Имя",
    email: "Электронная почта",
    password: "Пароль",
    passwordHint: "От 10 до 128 символов, включая букву и цифру.",
    submitLogin: "Войти в GlobeLedger",
    submitRegister: "Создать личный учёт финансов",
    working: "Подождите…",
    newHere: "Впервые в GlobeLedger?",
    already: "Уже есть аккаунт?",
    privateTitle: "Данные каждого пользователя изолированы",
    privateBody: "Все операции и расписания регулярных операций привязаны только к вашему аккаунту. Другие пользователи не могут их просматривать или изменять.",
    rateTitle: "Исторические курсы сохраняются",
    rateBody: "Исходная валюта и зафиксированный курс обмена сохраняются для каждой операции.",
    genericError: "Не удалось выполнить запрос. Попробуйте ещё раз.",
    invalid: "Проверьте электронную почту и пароль.",
    duplicate: "Аккаунт с этой почтой уже существует.",
    weak: "Используйте не менее 10 символов, включая букву и цифру.",
    limited: "Слишком много попыток. Повторите через 15 минут.",
    language: "Язык",
  },
} as const;

export function AuthScreen({
  returnTo,
  initialLanguage = DEFAULT_LANGUAGE,
}: {
  returnTo: string;
  initialLanguage?: Language;
}) {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [languageReady, setLanguageReady] = useState(false);
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
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (isLanguage(stored)) setLanguage(stored);
      setLanguageReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    if (languageReady) persistLanguagePreference(language);
  }, [language, languageReady]);

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
      if (mode === "register" || languageTouched) {
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
    persistLanguagePreference(nextLanguage);
    setLanguage(nextLanguage);
    setLanguageTouched(true);
    router.refresh();
  }

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand-lockup"><span className="brand-mark" aria-hidden="true"><span /></span><strong>GlobeLedger</strong></div>
        <div className="auth-message"><span className="eyebrow">{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.subtitle}</p></div>
        <div className="auth-benefits">
          <article><span aria-hidden="true">◎</span><div><strong>{copy.privateTitle}</strong><p>{copy.privateBody}</p></div></article>
          <article><span aria-hidden="true">↻</span><div><strong>{copy.rateTitle}</strong><p>{copy.rateBody}</p></div></article>
        </div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-card-top"><div className="auth-tabs" role="tablist"><button role="tab" aria-selected={mode === "login"} className={mode === "login" ? "selected" : ""} onClick={() => switchMode("login")}>{copy.login}</button><button role="tab" aria-selected={mode === "register"} className={mode === "register" ? "selected" : ""} onClick={() => switchMode("register")}>{copy.register}</button></div><LanguagePicker className="auth-language-picker" value={language} label={copy.language} onChange={chooseLanguage} /></div>
          <h2>{mode === "login" ? copy.login : copy.register}</h2>
          <p>{mode === "login" ? copy.loginIntro : copy.registerIntro}</p>
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
