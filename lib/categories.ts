import type { Language } from "@/lib/language";

export const EXPENSE_CATEGORY_IDS = [
  "housing",
  "utilities",
  "communication",
  "groceries",
  "dining",
  "transport",
  "vehicle",
  "travel",
  "health",
  "personal_care",
  "education",
  "shopping",
  "entertainment",
  "subscriptions",
  "family",
  "pets",
  "gifts",
  "insurance",
  "taxes",
  "financial",
  "other",
] as const;

export const INCOME_CATEGORY_IDS = [
  "salary",
  "freelance",
  "investment_income",
  "refund",
  "gift_income",
  "other_income",
  "income",
] as const;

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORY_IDS)[number];
export type IncomeCategoryId = (typeof INCOME_CATEGORY_IDS)[number];
export type LedgerCategoryId = ExpenseCategoryId | IncomeCategoryId;
export type CategoryKind = "expense" | "income";

export const CATEGORY_GROUP_IDS = [
  "home",
  "food",
  "mobility",
  "personal",
  "family",
  "finance",
  "other",
  "income",
] as const;

export type CategoryGroupId = (typeof CATEGORY_GROUP_IDS)[number];

type Labels = Record<Language, string>;
type CategoryDefinition = {
  kind: CategoryKind;
  group: CategoryGroupId;
  color: string;
  glyph: string;
  labels: Labels;
};

export const CATEGORY_GROUP_LABELS: Record<CategoryGroupId, Labels> = {
  home: { en: "Home & bills", ko: "주거·생활", ja: "住居・生活", ru: "Дом и счета" },
  food: { en: "Food", ko: "식생활", ja: "食生活", ru: "Питание" },
  mobility: { en: "Mobility", ko: "이동", ja: "移動", ru: "Транспорт" },
  personal: { en: "Personal", ko: "개인", ja: "個人", ru: "Личное" },
  family: { en: "Family & giving", ko: "가족·나눔", ja: "家族・贈り物", ru: "Семья и подарки" },
  finance: { en: "Financial", ko: "금융", ja: "金融", ru: "Финансы" },
  other: { en: "Other", ko: "기타", ja: "その他", ru: "Другое" },
  income: { en: "Income", ko: "수입", ja: "収入", ru: "Доход" },
};

export const CATEGORY_META: Record<LedgerCategoryId, CategoryDefinition> = {
  housing: { kind: "expense", group: "home", color: "#4d6fdd", glyph: "🏠", labels: { en: "Housing", ko: "주거", ja: "住居", ru: "Жильё" } },
  utilities: { kind: "expense", group: "home", color: "#54a7a3", glyph: "💡", labels: { en: "Utilities", ko: "공과금", ja: "光熱費", ru: "Коммунальные услуги" } },
  communication: { kind: "expense", group: "home", color: "#438da3", glyph: "📱", labels: { en: "Phone & internet", ko: "통신", ja: "通信", ru: "Связь и интернет" } },
  groceries: { kind: "expense", group: "food", color: "#4f8f6f", glyph: "🛒", labels: { en: "Groceries", ko: "식료품", ja: "食料品", ru: "Продукты" } },
  dining: { kind: "expense", group: "food", color: "#ee6c4d", glyph: "🍽️", labels: { en: "Food & drink", ko: "외식·음료", ja: "外食・飲料", ru: "Кафе и рестораны" } },
  transport: { kind: "expense", group: "mobility", color: "#d49b45", glyph: "🚆", labels: { en: "Public transport", ko: "대중교통", ja: "公共交通", ru: "Общественный транспорт" } },
  vehicle: { kind: "expense", group: "mobility", color: "#b8793d", glyph: "🚗", labels: { en: "Vehicle & fuel", ko: "차량·연료", ja: "車・燃料", ru: "Автомобиль и топливо" } },
  travel: { kind: "expense", group: "mobility", color: "#2d8b9b", glyph: "✈️", labels: { en: "Travel", ko: "여행", ja: "旅行", ru: "Путешествия" } },
  health: { kind: "expense", group: "personal", color: "#d9687b", glyph: "🩺", labels: { en: "Health", ko: "건강·의료", ja: "健康・医療", ru: "Здоровье" } },
  personal_care: { kind: "expense", group: "personal", color: "#c56e91", glyph: "✨", labels: { en: "Personal care", ko: "개인 관리", ja: "パーソナルケア", ru: "Уход за собой" } },
  education: { kind: "expense", group: "personal", color: "#6d81be", glyph: "🎓", labels: { en: "Education", ko: "교육", ja: "教育", ru: "Образование" } },
  shopping: { kind: "expense", group: "personal", color: "#d1749c", glyph: "🛍️", labels: { en: "Shopping", ko: "쇼핑", ja: "買い物", ru: "Покупки" } },
  entertainment: { kind: "expense", group: "personal", color: "#9b6acb", glyph: "🎬", labels: { en: "Entertainment", ko: "문화·여가", ja: "娯楽", ru: "Развлечения" } },
  subscriptions: { kind: "expense", group: "personal", color: "#7d78b8", glyph: "↻", labels: { en: "Subscriptions", ko: "구독", ja: "サブスクリプション", ru: "Подписки" } },
  family: { kind: "expense", group: "family", color: "#c98258", glyph: "👪", labels: { en: "Family & childcare", ko: "육아·가족", ja: "育児・家族", ru: "Семья и дети" } },
  pets: { kind: "expense", group: "family", color: "#9a795f", glyph: "🐾", labels: { en: "Pets", ko: "반려동물", ja: "ペット", ru: "Питомцы" } },
  gifts: { kind: "expense", group: "family", color: "#c76378", glyph: "🎁", labels: { en: "Gifts & donations", ko: "선물·기부", ja: "贈り物・寄付", ru: "Подарки и пожертвования" } },
  insurance: { kind: "expense", group: "finance", color: "#537ca4", glyph: "🛡️", labels: { en: "Insurance", ko: "보험", ja: "保険", ru: "Страхование" } },
  taxes: { kind: "expense", group: "finance", color: "#716a9b", glyph: "🧾", labels: { en: "Taxes", ko: "세금", ja: "税金", ru: "Налоги" } },
  financial: { kind: "expense", group: "finance", color: "#687889", glyph: "🏦", labels: { en: "Fees & interest", ko: "금융 수수료·이자", ja: "手数料・利息", ru: "Комиссии и проценты" } },
  other: { kind: "expense", group: "other", color: "#7e8b86", glyph: "•••", labels: { en: "Other", ko: "기타", ja: "その他", ru: "Другое" } },
  salary: { kind: "income", group: "income", color: "#278369", glyph: "💼", labels: { en: "Salary", ko: "급여", ja: "給与", ru: "Зарплата" } },
  freelance: { kind: "income", group: "income", color: "#2f8e72", glyph: "🧑‍💻", labels: { en: "Business & freelance", ko: "사업·프리랜서", ja: "事業・フリーランス", ru: "Бизнес и фриланс" } },
  investment_income: { kind: "income", group: "income", color: "#3e8564", glyph: "📈", labels: { en: "Interest & dividends", ko: "이자·배당", ja: "利息・配当", ru: "Проценты и дивиденды" } },
  refund: { kind: "income", group: "income", color: "#3d8c83", glyph: "↩", labels: { en: "Refund", ko: "환급", ja: "返金", ru: "Возврат" } },
  gift_income: { kind: "income", group: "income", color: "#58926c", glyph: "🎁", labels: { en: "Gift received", ko: "받은 선물", ja: "受け取った贈り物", ru: "Полученный подарок" } },
  other_income: { kind: "income", group: "income", color: "#577d6f", glyph: "+", labels: { en: "Other income", ko: "기타 수입", ja: "その他の収入", ru: "Другой доход" } },
  income: { kind: "income", group: "income", color: "#278369", glyph: "+", labels: { en: "Income", ko: "수입", ja: "収入", ru: "Доход" } },
};

const EXPENSE_SET = new Set<string>(EXPENSE_CATEGORY_IDS);
const INCOME_SET = new Set<string>(INCOME_CATEGORY_IDS);

export function isExpenseCategory(category: string): category is ExpenseCategoryId {
  return EXPENSE_SET.has(category);
}

export function isIncomeCategory(category: string): category is IncomeCategoryId {
  return INCOME_SET.has(category);
}

export function categoryIdsForKind(kind: CategoryKind) {
  return kind === "income" ? INCOME_CATEGORY_IDS : EXPENSE_CATEGORY_IDS;
}

export function categoryLabel(category: string, language: Language) {
  return CATEGORY_META[category as LedgerCategoryId]?.labels[language] ?? category;
}

export function categoryGlyph(category: string) {
  return CATEGORY_META[category as LedgerCategoryId]?.glyph ?? CATEGORY_META.other.glyph;
}

export function categoryColor(category: string) {
  return CATEGORY_META[category as LedgerCategoryId]?.color ?? CATEGORY_META.other.color;
}

export function categoryGroupLabel(group: CategoryGroupId, language: Language) {
  return CATEGORY_GROUP_LABELS[group][language];
}

export function categoryGroupsForKind(kind: CategoryKind) {
  const categoryIds = categoryIdsForKind(kind);
  return CATEGORY_GROUP_IDS.flatMap((group) => {
    const categories = categoryIds.filter((category) => CATEGORY_META[category].group === group);
    return categories.length > 0 ? [{ group, categories }] : [];
  });
}
