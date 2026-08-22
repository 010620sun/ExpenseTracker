export const SUPPORTED_LANGUAGES = ["en", "ko", "ja", "ru"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "en";
export const LANGUAGE_STORAGE_KEY = "globeledger-language";
export const LANGUAGE_COOKIE_NAME = "globeledger-language";

export const LANGUAGE_LOCALES: Record<Language, string> = {
  en: "en-US",
  ko: "ko-KR",
  ja: "ja-JP",
  ru: "ru-RU",
};

export type LocalizedCountUnit =
  | "transaction"
  | "entry"
  | "activeDay"
  | "currency"
  | "result";

const COUNT_PATTERNS: Record<
  Language,
  Record<LocalizedCountUnit, Record<string, string>>
> = {
  en: {
    transaction: { one: "{count} transaction", other: "{count} transactions" },
    entry: { one: "{count} entry", other: "{count} entries" },
    activeDay: { one: "{count} active day", other: "{count} active days" },
    currency: { one: "{count} currency", other: "{count} currencies" },
    result: { one: "{count} result", other: "{count} results" },
  },
  ko: {
    transaction: { other: "거래 {count}건" },
    entry: { other: "{count}건" },
    activeDay: { other: "거래일 {count}일" },
    currency: { other: "{count}개 통화" },
    result: { other: "결과 {count}건" },
  },
  ja: {
    transaction: { other: "取引{count}件" },
    entry: { other: "{count}件" },
    activeDay: { other: "{count}日（取引あり）" },
    currency: { other: "{count}通貨" },
    result: { other: "{count}件" },
  },
  ru: {
    transaction: {
      one: "{count} операция",
      few: "{count} операции",
      many: "{count} операций",
      other: "{count} операции",
    },
    entry: {
      one: "{count} запись",
      few: "{count} записи",
      many: "{count} записей",
      other: "{count} записи",
    },
    activeDay: {
      one: "{count} активный день",
      few: "{count} активных дня",
      many: "{count} активных дней",
      other: "{count} активного дня",
    },
    currency: {
      one: "{count} валюта",
      few: "{count} валюты",
      many: "{count} валют",
      other: "{count} валюты",
    },
    result: {
      one: "{count} результат",
      few: "{count} результата",
      many: "{count} результатов",
      other: "{count} результата",
    },
  },
};

export function formatLocalizedCount(
  count: number,
  language: Language,
  unit: LocalizedCountUnit,
) {
  const category = new Intl.PluralRules(LANGUAGE_LOCALES[language]).select(
    Math.abs(count),
  );
  const patterns = COUNT_PATTERNS[language][unit];
  const pattern = patterns[category] ?? patterns.other;
  return pattern.replace(
    "{count}",
    new Intl.NumberFormat(LANGUAGE_LOCALES[language]).format(count),
  );
}

export function isLanguage(value: unknown): value is Language {
  return (
    typeof value === "string" &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  );
}

export function persistLanguagePreference(language: Language) {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  document.cookie = `${LANGUAGE_COOKIE_NAME}=${language}; Max-Age=31536000; Path=/; SameSite=Lax`;
}
