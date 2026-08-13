"use client";

import { type FormEvent, useState } from "react";

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
    language: "한국어",
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
    language: "EN",
  },
} as const;

export function AuthScreen({ returnTo }: { returnTo: string }) {
  const [language, setLanguage] = useState<"en" | "ko">("en");
  const [mode, setMode] = useState<Mode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const copy = COPY[language];

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
          <div className="auth-card-top"><div className="auth-tabs" role="tablist"><button role="tab" aria-selected={mode === "login"} className={mode === "login" ? "selected" : ""} onClick={() => switchMode("login")}>{copy.login}</button><button role="tab" aria-selected={mode === "register"} className={mode === "register" ? "selected" : ""} onClick={() => switchMode("register")}>{copy.register}</button></div><button className="auth-language" onClick={() => setLanguage(language === "en" ? "ko" : "en")}>{copy.language}</button></div>
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
