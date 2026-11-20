import type { Language } from "@/lib/language";

export const TRANSACTION_TAG_IDS = [
  "travel",
  "business",
  "family",
  "child",
  "pet",
  "gift",
  "birthday",
  "wedding",
  "holiday",
  "reimbursable",
] as const;

export type TransactionTagId = (typeof TRANSACTION_TAG_IDS)[number];

const TAG_LABELS: Record<TransactionTagId, Record<Language, string>> = {
  travel: { en: "Travel", ko: "여행", ja: "旅行", ru: "Поездка" },
  business: { en: "Business", ko: "업무", ja: "仕事", ru: "Работа" },
  family: { en: "Family", ko: "가족", ja: "家族", ru: "Семья" },
  child: { en: "Child", ko: "자녀", ja: "子ども", ru: "Ребёнок" },
  pet: { en: "Pet", ko: "반려동물", ja: "ペット", ru: "Питомец" },
  gift: { en: "Gift", ko: "선물", ja: "贈り物", ru: "Подарок" },
  birthday: { en: "Birthday", ko: "생일", ja: "誕生日", ru: "День рождения" },
  wedding: { en: "Wedding", ko: "결혼식", ja: "結婚式", ru: "Свадьба" },
  holiday: { en: "Holiday", ko: "휴일", ja: "祝日", ru: "Праздник" },
  reimbursable: { en: "Reimbursable", ko: "환급 예정", ja: "精算予定", ru: "К возмещению" },
};

export function transactionTagLabel(tag: string, language: Language) {
  return TAG_LABELS[tag as TransactionTagId]?.[language] ?? tag;
}
