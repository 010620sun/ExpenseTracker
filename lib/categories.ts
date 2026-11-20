import type { Language } from "@/lib/language";

export const CATEGORY_VERSION = 2;

export const EXPENSE_CATEGORY_IDS = [
  "housing",
  "food",
  "transport",
  "care",
  "education",
  "shopping",
  "leisure",
  "digital",
  "finance",
  "giving",
  "other",
] as const;

export const INCOME_CATEGORY_IDS = [
  "employment",
  "business",
  "investments",
  "refunds",
  "support",
  "other_income",
] as const;

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORY_IDS)[number];
export type IncomeCategoryId = (typeof INCOME_CATEGORY_IDS)[number];
export type LedgerCategoryId = ExpenseCategoryId | IncomeCategoryId;
export type CategoryKind = "expense" | "income";

export const CATEGORY_GROUP_IDS = [
  "essentials",
  "lifestyle",
  "financial",
  "other",
  "income",
] as const;

export type CategoryGroupId = (typeof CATEGORY_GROUP_IDS)[number];

type Labels = Record<Language, string>;
export type CategoryGlyphName =
  | "home"
  | "bolt"
  | "utensils"
  | "cart"
  | "train"
  | "car"
  | "plane"
  | "health"
  | "sparkle"
  | "book"
  | "bag"
  | "play"
  | "repeat"
  | "family"
  | "paw"
  | "phone"
  | "bank"
  | "gift"
  | "shield"
  | "receipt"
  | "more"
  | "briefcase"
  | "laptop"
  | "chart"
  | "refund"
  | "plus-circle"
  | "income";

type CategoryDefinition = {
  kind: CategoryKind;
  group: CategoryGroupId;
  color: string;
  glyph: CategoryGlyphName;
  labels: Labels;
};

type SubcategoryDefinition = { labels: Labels };

export const CATEGORY_GROUP_LABELS: Record<CategoryGroupId, Labels> = {
  essentials: { en: "Essentials", ko: "생활", ja: "生活", ru: "Основное" },
  lifestyle: { en: "Lifestyle", ko: "생활 방식", ja: "ライフスタイル", ru: "Образ жизни" },
  financial: { en: "Money", ko: "금전", ja: "お金", ru: "Деньги" },
  other: { en: "Other", ko: "기타", ja: "その他", ru: "Другое" },
  income: { en: "Income", ko: "수입", ja: "収入", ru: "Доход" },
};

export const CATEGORY_META: Record<LedgerCategoryId, CategoryDefinition> = {
  housing: { kind: "expense", group: "essentials", color: "#4d6fdd", glyph: "home", labels: { en: "Housing", ko: "주거", ja: "住居", ru: "Жильё" } },
  food: { kind: "expense", group: "essentials", color: "#ee6c4d", glyph: "utensils", labels: { en: "Food", ko: "식음료", ja: "食費", ru: "Питание" } },
  transport: { kind: "expense", group: "essentials", color: "#d49b45", glyph: "train", labels: { en: "Transport", ko: "교통", ja: "交通", ru: "Транспорт" } },
  care: { kind: "expense", group: "essentials", color: "#d9687b", glyph: "health", labels: { en: "Care", ko: "건강·돌봄", ja: "健康・ケア", ru: "Здоровье" } },
  education: { kind: "expense", group: "essentials", color: "#6d81be", glyph: "book", labels: { en: "Education", ko: "교육", ja: "教育", ru: "Образование" } },
  shopping: { kind: "expense", group: "lifestyle", color: "#d1749c", glyph: "bag", labels: { en: "Shopping", ko: "쇼핑", ja: "買い物", ru: "Покупки" } },
  leisure: { kind: "expense", group: "lifestyle", color: "#9b6acb", glyph: "play", labels: { en: "Leisure", ko: "여가", ja: "娯楽", ru: "Досуг" } },
  digital: { kind: "expense", group: "lifestyle", color: "#438da3", glyph: "phone", labels: { en: "Digital", ko: "디지털", ja: "デジタル", ru: "Цифровое" } },
  finance: { kind: "expense", group: "financial", color: "#687889", glyph: "bank", labels: { en: "Finance", ko: "금융", ja: "金融", ru: "Финансы" } },
  giving: { kind: "expense", group: "financial", color: "#c76378", glyph: "gift", labels: { en: "Giving", ko: "나눔", ja: "贈与", ru: "Помощь" } },
  other: { kind: "expense", group: "other", color: "#7e8b86", glyph: "more", labels: { en: "Other", ko: "기타", ja: "その他", ru: "Другое" } },
  employment: { kind: "income", group: "income", color: "#278369", glyph: "briefcase", labels: { en: "Employment", ko: "근로", ja: "給与", ru: "Работа" } },
  business: { kind: "income", group: "income", color: "#2f8e72", glyph: "laptop", labels: { en: "Business", ko: "사업", ja: "事業", ru: "Бизнес" } },
  investments: { kind: "income", group: "income", color: "#3e8564", glyph: "chart", labels: { en: "Investments", ko: "투자", ja: "投資", ru: "Инвестиции" } },
  refunds: { kind: "income", group: "income", color: "#3d8c83", glyph: "refund", labels: { en: "Refunds", ko: "환불", ja: "返金", ru: "Возвраты" } },
  support: { kind: "income", group: "income", color: "#58926c", glyph: "gift", labels: { en: "Support", ko: "지원", ja: "支援", ru: "Поддержка" } },
  other_income: { kind: "income", group: "income", color: "#577d6f", glyph: "plus-circle", labels: { en: "Other income", ko: "기타 수입", ja: "その他収入", ru: "Прочий доход" } },
};

export const SUBCATEGORY_META = {
  rent: { labels: { en: "Rent", ko: "주거비", ja: "家賃", ru: "Аренда" } },
  lodging: { labels: { en: "Lodging", ko: "숙박", ja: "宿泊", ru: "Проживание" } },
  utilities: { labels: { en: "Utilities", ko: "공과금", ja: "光熱費", ru: "Коммунальные" } },
  repairs: { labels: { en: "Repairs", ko: "수리", ja: "修理", ru: "Ремонт" } },
  groceries: { labels: { en: "Groceries", ko: "장보기", ja: "食料品", ru: "Продукты" } },
  meals: { labels: { en: "Meals", ko: "식사", ja: "食事", ru: "Еда" } },
  cafe: { labels: { en: "Cafe", ko: "카페·간식", ja: "カフェ", ru: "Кафе" } },
  alcohol: { labels: { en: "Alcohol", ko: "주류", ja: "酒類", ru: "Алкоголь" } },
  transit: { labels: { en: "Transit", ko: "대중교통", ja: "公共交通", ru: "Общественный транспорт" } },
  taxi: { labels: { en: "Taxi", ko: "택시", ja: "タクシー", ru: "Такси" } },
  flights: { labels: { en: "Flights", ko: "항공·선박", ja: "航空・船舶", ru: "Авиа и паромы" } },
  fuel: { labels: { en: "Fuel", ko: "연료", ja: "燃料", ru: "Топливо" } },
  rentals: { labels: { en: "Rentals", ko: "차량 대여", ja: "レンタル", ru: "Аренда транспорта" } },
  maintenance: { labels: { en: "Maintenance", ko: "정비", ja: "整備", ru: "Обслуживание" } },
  parking: { labels: { en: "Parking", ko: "주차·통행료", ja: "駐車・通行料", ru: "Парковка" } },
  medical: { labels: { en: "Medical", ko: "의료", ja: "医療", ru: "Медицина" } },
  pharmacy: { labels: { en: "Pharmacy", ko: "약국", ja: "薬局", ru: "Аптека" } },
  dental: { labels: { en: "Dental", ko: "치과", ja: "歯科", ru: "Стоматология" } },
  vision: { labels: { en: "Vision", ko: "안과·안경", ja: "眼科・眼鏡", ru: "Зрение" } },
  fitness: { labels: { en: "Fitness", ko: "운동·웰니스", ja: "フィットネス", ru: "Фитнес" } },
  grooming: { labels: { en: "Grooming", ko: "미용", ja: "美容", ru: "Уход" } },
  caregiving: { labels: { en: "Caregiving", ko: "돌봄", ja: "介護・育児", ru: "Уход" } },
  vet: { labels: { en: "Vet", ko: "동물 의료", ja: "動物医療", ru: "Ветеринар" } },
  tuition: { labels: { en: "Tuition", ko: "학비", ja: "授業料", ru: "Обучение" } },
  materials: { labels: { en: "Materials", ko: "학습 자료", ja: "教材", ru: "Материалы" } },
  courses: { labels: { en: "Courses", ko: "강의·자격증", ja: "講座・資格", ru: "Курсы" } },
  clothing: { labels: { en: "Clothing", ko: "의류·신발", ja: "衣類・靴", ru: "Одежда" } },
  electronics: { labels: { en: "Electronics", ko: "전자제품", ja: "電子機器", ru: "Электроника" } },
  home_goods: { labels: { en: "Home goods", ko: "가정용품", ja: "家庭用品", ru: "Товары для дома" } },
  essentials: { labels: { en: "Essentials", ko: "생활용품", ja: "日用品", ru: "Бытовые товары" } },
  toiletries: { labels: { en: "Toiletries", ko: "관리 제품", ja: "ケア用品", ru: "Уходовые товары" } },
  pet_supplies: { labels: { en: "Pet supplies", ko: "반려동물용품", ja: "ペット用品", ru: "Товары для питомцев" } },
  tobacco: { labels: { en: "Tobacco", ko: "담배", ja: "たばこ", ru: "Табак" } },
  other_goods: { labels: { en: "Other goods", ko: "기타 상품", ja: "その他商品", ru: "Другие товары" } },
  events: { labels: { en: "Events", ko: "공연·관광", ja: "イベント・観光", ru: "События" } },
  games: { labels: { en: "Games", ko: "게임", ja: "ゲーム", ru: "Игры" } },
  hobbies: { labels: { en: "Hobbies", ko: "취미", ja: "趣味", ru: "Хобби" } },
  streaming: { labels: { en: "Streaming", ko: "스트리밍", ja: "ストリーミング", ru: "Стриминг" } },
  activities: { labels: { en: "Activities", ko: "레저", ja: "アクティビティ", ru: "Активности" } },
  mobile: { labels: { en: "Mobile", ko: "휴대전화", ja: "携帯電話", ru: "Мобильная связь" } },
  internet: { labels: { en: "Internet", ko: "인터넷", ja: "インターネット", ru: "Интернет" } },
  software: { labels: { en: "Software", ko: "소프트웨어", ja: "ソフトウェア", ru: "Программы" } },
  cloud: { labels: { en: "Cloud", ko: "클라우드", ja: "クラウド", ru: "Облако" } },
  insurance: { labels: { en: "Insurance", ko: "보험", ja: "保険", ru: "Страхование" } },
  taxes: { labels: { en: "Taxes", ko: "세금", ja: "税金", ru: "Налоги" } },
  bank_fees: { labels: { en: "Bank fees", ko: "금융 수수료", ja: "銀行手数料", ru: "Комиссии" } },
  interest: { labels: { en: "Interest", ko: "이자", ja: "利息", ru: "Проценты" } },
  government_fees: { labels: { en: "Government fees", ko: "행정 수수료", ja: "行政手数料", ru: "Госсборы" } },
  fines: { labels: { en: "Fines", ko: "벌금", ja: "罰金", ru: "Штрафы" } },
  donations: { labels: { en: "Donations", ko: "기부", ja: "寄付", ru: "Пожертвования" } },
  cash_gifts: { labels: { en: "Cash gifts", ko: "현금 선물", ja: "現金贈与", ru: "Денежные подарки" } },
  support_given: { labels: { en: "Support", ko: "지원금", ja: "支援金", ru: "Поддержка" } },
  transfers: { labels: { en: "Transfers", ko: "기타 이전", ja: "送金", ru: "Переводы" } },
  postage: { labels: { en: "Postage", ko: "우편·배송", ja: "郵便・配送", ru: "Почта" } },
  laundry: { labels: { en: "Laundry", ko: "세탁", ja: "洗濯", ru: "Прачечная" } },
  storage: { labels: { en: "Storage", ko: "보관", ja: "保管", ru: "Хранение" } },
  services: { labels: { en: "Services", ko: "기타 서비스", ja: "その他サービス", ru: "Услуги" } },
  unknown: { labels: { en: "Unknown", ko: "분류 불가", ja: "不明", ru: "Неизвестно" } },
  salary: { labels: { en: "Salary", ko: "급여", ja: "給与", ru: "Зарплата" } },
  bonus: { labels: { en: "Bonus", ko: "보너스", ja: "ボーナス", ru: "Премия" } },
  allowance: { labels: { en: "Allowance", ko: "수당", ja: "手当", ru: "Надбавка" } },
  severance: { labels: { en: "Severance", ko: "퇴직금", ja: "退職金", ru: "Выходное пособие" } },
  freelance: { labels: { en: "Freelance", ko: "프리랜서", ja: "フリーランス", ru: "Фриланс" } },
  consulting: { labels: { en: "Consulting", ko: "컨설팅", ja: "コンサルティング", ru: "Консалтинг" } },
  sales: { labels: { en: "Sales", ko: "매출", ja: "売上", ru: "Продажи" } },
  royalties: { labels: { en: "Royalties", ko: "저작권료", ja: "ロイヤリティ", ru: "Роялти" } },
  investment_interest: { labels: { en: "Interest", ko: "이자", ja: "利息", ru: "Проценты" } },
  dividends: { labels: { en: "Dividends", ko: "배당", ja: "配当", ru: "Дивиденды" } },
  gains: { labels: { en: "Gains", ko: "매매차익", ja: "売却益", ru: "Прибыль" } },
  rent_income: { labels: { en: "Rent", ko: "임대 수입", ja: "家賃収入", ru: "Арендный доход" } },
  purchase_refund: { labels: { en: "Purchase", ko: "구매 환불", ja: "購入返金", ru: "Возврат покупки" } },
  tax_refund: { labels: { en: "Tax", ko: "세금 환급", ja: "税金還付", ru: "Возврат налога" } },
  reimbursement: { labels: { en: "Reimbursement", ko: "비용 환급", ja: "経費精算", ru: "Возмещение" } },
  insurance_claim: { labels: { en: "Insurance", ko: "보험금", ja: "保険金", ru: "Страховая выплата" } },
  gifts_received: { labels: { en: "Gifts", ko: "받은 선물", ja: "贈与", ru: "Подарки" } },
  family_support: { labels: { en: "Family", ko: "가족 지원", ja: "家族支援", ru: "Семейная помощь" } },
  grants: { labels: { en: "Grants", ko: "보조금", ja: "助成金", ru: "Гранты" } },
  prizes: { labels: { en: "Prizes", ko: "상금", ja: "賞金", ru: "Призы" } },
  unknown_income: { labels: { en: "Unknown", ko: "분류 불가", ja: "不明", ru: "Неизвестно" } },
} as const satisfies Record<string, SubcategoryDefinition>;

export type SubcategoryId = keyof typeof SUBCATEGORY_META;

export const SUBCATEGORY_IDS_BY_CATEGORY: Record<LedgerCategoryId, readonly SubcategoryId[]> = {
  housing: ["rent", "lodging", "utilities", "repairs"],
  food: ["groceries", "meals", "cafe", "alcohol"],
  transport: ["transit", "taxi", "flights", "fuel", "rentals", "maintenance", "parking"],
  care: ["medical", "pharmacy", "dental", "vision", "fitness", "grooming", "caregiving", "vet"],
  education: ["tuition", "materials", "courses"],
  shopping: ["clothing", "electronics", "home_goods", "essentials", "toiletries", "pet_supplies", "tobacco", "other_goods"],
  leisure: ["events", "games", "hobbies", "streaming", "activities"],
  digital: ["mobile", "internet", "software", "cloud"],
  finance: ["insurance", "taxes", "bank_fees", "interest", "government_fees", "fines"],
  giving: ["donations", "cash_gifts", "support_given", "transfers"],
  other: ["postage", "laundry", "storage", "services", "unknown"],
  employment: ["salary", "bonus", "allowance", "severance"],
  business: ["freelance", "consulting", "sales", "royalties"],
  investments: ["investment_interest", "dividends", "gains", "rent_income"],
  refunds: ["purchase_refund", "tax_refund", "reimbursement", "insurance_claim"],
  support: ["gifts_received", "family_support", "grants", "prizes"],
  other_income: ["unknown_income"],
};

const EXPENSE_SET = new Set<string>(EXPENSE_CATEGORY_IDS);
const INCOME_SET = new Set<string>(INCOME_CATEGORY_IDS);

export function isExpenseCategory(category: string): category is ExpenseCategoryId {
  return EXPENSE_SET.has(category);
}

export function isIncomeCategory(category: string): category is IncomeCategoryId {
  return INCOME_SET.has(category);
}

export function isCategoryForKind(category: string, kind: CategoryKind) {
  return kind === "income" ? isIncomeCategory(category) : isExpenseCategory(category);
}

export function categoryIdsForKind(kind: CategoryKind) {
  return kind === "income" ? INCOME_CATEGORY_IDS : EXPENSE_CATEGORY_IDS;
}

export function categoryLabel(category: string, language: Language) {
  return CATEGORY_META[category as LedgerCategoryId]?.labels[language] ?? CATEGORY_META.other.labels[language];
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

export function subcategoryIdsForCategory(category: string): readonly SubcategoryId[] {
  return SUBCATEGORY_IDS_BY_CATEGORY[category as LedgerCategoryId] ?? [];
}

export function isSubcategoryForCategory(category: string, subcategory: string) {
  return subcategoryIdsForCategory(category).some((item) => item === subcategory);
}

export function subcategoryLabel(subcategory: string, language: Language) {
  return SUBCATEGORY_META[subcategory as SubcategoryId]?.labels[language] ?? CATEGORY_META.other.labels[language];
}

export function categoryPathLabel(
  category: string,
  subcategory: string | null | undefined,
  language: Language,
) {
  const parent = categoryLabel(category, language);
  return subcategory ? `${parent} · ${subcategoryLabel(subcategory, language)}` : parent;
}
