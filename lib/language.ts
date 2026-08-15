export const SUPPORTED_LANGUAGES = ["en", "ko", "ja", "ru"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LOCALES: Record<Language, string> = {
  en: "en-US",
  ko: "ko-KR",
  ja: "ja-JP",
  ru: "ru-RU",
};

export function isLanguage(value: unknown): value is Language {
  return (
    typeof value === "string" &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  );
}
