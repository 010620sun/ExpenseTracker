"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { Language } from "@/lib/language";

const LANGUAGE_OPTIONS: Array<{
  code: Language;
  short: string;
  name: string;
  details: Record<Language, string>;
}> = [
  {
    code: "en",
    short: "EN",
    name: "English",
    details: { en: "English", ko: "영어", ja: "英語", ru: "Английский" },
  },
  {
    code: "ko",
    short: "KO",
    name: "한국어",
    details: { en: "Korean", ko: "한국어", ja: "韓国語", ru: "Корейский" },
  },
  {
    code: "ja",
    short: "JA",
    name: "日本語",
    details: { en: "Japanese", ko: "일본어", ja: "日本語", ru: "Японский" },
  },
  {
    code: "ru",
    short: "RU",
    name: "Русский",
    details: { en: "Russian", ko: "러시아어", ja: "ロシア語", ru: "Русский" },
  },
];

export function LanguagePicker({
  value,
  label,
  onChange,
  className = "",
}: {
  value: Language;
  label: string;
  onChange: (language: Language) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const selected =
    LANGUAGE_OPTIONS.find((option) => option.code === value) ??
    LANGUAGE_OPTIONS[0];

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  function chooseLanguage(language: Language) {
    onChange(language);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div
      ref={rootRef}
      className={`language-picker ${className}`.trim()}
    >
      <button
        ref={triggerRef}
        type="button"
        className="language-trigger"
        aria-label={`${label}: ${selected.name}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="language-globe" aria-hidden="true">◎</span>
        <span className="language-trigger-name">{selected.name}</span>
        <strong>{selected.short}</strong>
        <span className="language-chevron" aria-hidden="true">⌄</span>
      </button>

      {isOpen && (
        <div
          id={menuId}
          className="language-menu"
          role="listbox"
          aria-label={label}
        >
          <span className="language-menu-title">{label}</span>
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.code}
              type="button"
              role="option"
              aria-selected={option.code === value}
              className={option.code === value ? "selected" : ""}
              onClick={() => chooseLanguage(option.code)}
            >
              <span className="language-option-code">{option.short}</span>
              <span>
                <strong>{option.name}</strong>
                <small>{option.details[value]}</small>
              </span>
              <i aria-hidden="true">{option.code === value ? "✓" : ""}</i>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
