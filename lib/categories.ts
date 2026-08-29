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
export type CategoryGlyphName =
  | "home"
  | "bolt"
  | "phone"
  | "cart"
  | "utensils"
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
  | "gift"
  | "shield"
  | "receipt"
  | "bank"
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
  home: { en: "Home & bills", ko: "주거·생활", ja: "住居・生活", ru: "Жильё и счета" },
  food: { en: "Food", ko: "식생활", ja: "食生活", ru: "Питание" },
  mobility: { en: "Mobility", ko: "이동", ja: "移動", ru: "Транспорт" },
  personal: { en: "Personal", ko: "개인", ja: "個人", ru: "Личные расходы" },
  family: { en: "Family & giving", ko: "가족·나눔", ja: "家族・贈答・寄付", ru: "Семья и подарки" },
  finance: { en: "Financial", ko: "금융", ja: "金融", ru: "Финансы" },
  other: { en: "Other", ko: "기타", ja: "その他", ru: "Другое" },
  income: { en: "Income", ko: "수입", ja: "収入", ru: "Доход" },
};

export const CATEGORY_META: Record<LedgerCategoryId, CategoryDefinition> = {
  housing: { kind: "expense", group: "home", color: "#4d6fdd", glyph: "home", labels: { en: "Housing", ko: "주거", ja: "住居", ru: "Жильё" } },
  utilities: { kind: "expense", group: "home", color: "#54a7a3", glyph: "bolt", labels: { en: "Utilities", ko: "공과금", ja: "光熱費", ru: "Коммунальные услуги" } },
  communication: { kind: "expense", group: "home", color: "#438da3", glyph: "phone", labels: { en: "Phone & internet", ko: "통신", ja: "通信", ru: "Связь и интернет" } },
  groceries: { kind: "expense", group: "food", color: "#4f8f6f", glyph: "cart", labels: { en: "Groceries", ko: "식료품", ja: "食料品", ru: "Продукты" } },
  dining: { kind: "expense", group: "food", color: "#ee6c4d", glyph: "utensils", labels: { en: "Dining out", ko: "외식·카페", ja: "外食・カフェ", ru: "Кафе и рестораны" } },
  transport: { kind: "expense", group: "mobility", color: "#d49b45", glyph: "train", labels: { en: "Public transport", ko: "대중교통", ja: "公共交通", ru: "Общественный транспорт" } },
  vehicle: { kind: "expense", group: "mobility", color: "#b8793d", glyph: "car", labels: { en: "Vehicle & fuel", ko: "차량·연료", ja: "車両・燃料", ru: "Автомобиль и топливо" } },
  travel: { kind: "expense", group: "mobility", color: "#2d8b9b", glyph: "plane", labels: { en: "Travel", ko: "여행", ja: "旅行", ru: "Путешествия" } },
  health: { kind: "expense", group: "personal", color: "#d9687b", glyph: "health", labels: { en: "Health", ko: "건강·의료", ja: "健康・医療", ru: "Здоровье" } },
  personal_care: { kind: "expense", group: "personal", color: "#c56e91", glyph: "sparkle", labels: { en: "Personal care", ko: "개인 관리", ja: "パーソナルケア", ru: "Уход за собой" } },
  education: { kind: "expense", group: "personal", color: "#6d81be", glyph: "book", labels: { en: "Education", ko: "교육", ja: "教育", ru: "Образование" } },
  shopping: { kind: "expense", group: "personal", color: "#d1749c", glyph: "bag", labels: { en: "Shopping", ko: "쇼핑", ja: "買い物", ru: "Покупки" } },
  entertainment: { kind: "expense", group: "personal", color: "#9b6acb", glyph: "play", labels: { en: "Entertainment", ko: "문화·여가", ja: "娯楽", ru: "Развлечения" } },
  subscriptions: { kind: "expense", group: "personal", color: "#7d78b8", glyph: "repeat", labels: { en: "Subscriptions", ko: "구독", ja: "サブスクリプション", ru: "Подписки" } },
  family: { kind: "expense", group: "family", color: "#c98258", glyph: "family", labels: { en: "Family & childcare", ko: "육아·가족", ja: "育児・家族", ru: "Семья и дети" } },
  pets: { kind: "expense", group: "family", color: "#9a795f", glyph: "paw", labels: { en: "Pets", ko: "반려동물", ja: "ペット", ru: "Питомцы" } },
  gifts: { kind: "expense", group: "family", color: "#c76378", glyph: "gift", labels: { en: "Gifts & donations", ko: "선물·기부", ja: "贈り物・寄付", ru: "Подарки и пожертвования" } },
  insurance: { kind: "expense", group: "finance", color: "#537ca4", glyph: "shield", labels: { en: "Insurance", ko: "보험", ja: "保険", ru: "Страхование" } },
  taxes: { kind: "expense", group: "finance", color: "#716a9b", glyph: "receipt", labels: { en: "Taxes", ko: "세금", ja: "税金", ru: "Налоги" } },
  financial: { kind: "expense", group: "finance", color: "#687889", glyph: "bank", labels: { en: "Fees & interest", ko: "금융 수수료·이자", ja: "手数料・利息", ru: "Комиссии и проценты" } },
  other: { kind: "expense", group: "other", color: "#7e8b86", glyph: "more", labels: { en: "Other", ko: "기타", ja: "その他", ru: "Другое" } },
  salary: { kind: "income", group: "income", color: "#278369", glyph: "briefcase", labels: { en: "Salary", ko: "급여", ja: "給与", ru: "Зарплата" } },
  freelance: { kind: "income", group: "income", color: "#2f8e72", glyph: "laptop", labels: { en: "Business & freelance", ko: "사업·프리랜서", ja: "事業・フリーランス", ru: "Бизнес и фриланс" } },
  investment_income: { kind: "income", group: "income", color: "#3e8564", glyph: "chart", labels: { en: "Interest & dividends", ko: "이자·배당", ja: "利息・配当", ru: "Проценты и дивиденды" } },
  refund: { kind: "income", group: "income", color: "#3d8c83", glyph: "refund", labels: { en: "Refund", ko: "환급", ja: "返金・精算", ru: "Возврат" } },
  gift_income: { kind: "income", group: "income", color: "#58926c", glyph: "gift", labels: { en: "Gift received", ko: "받은 선물", ja: "贈与・支援金", ru: "Полученный подарок" } },
  other_income: { kind: "income", group: "income", color: "#577d6f", glyph: "plus-circle", labels: { en: "Other income", ko: "기타 수입", ja: "その他の収入", ru: "Прочие доходы" } },
  income: { kind: "income", group: "income", color: "#278369", glyph: "income", labels: { en: "Income", ko: "수입", ja: "収入", ru: "Доход" } },
};

export const SUBCATEGORY_META = {
  rent_mortgage: { labels: { en: "Rent & mortgage payments", ko: "임대료·주택담보대출 상환", ja: "家賃・住宅ローン返済", ru: "Аренда и выплаты по ипотеке" } },
  home_maintenance: { labels: { en: "Repairs & maintenance", ko: "수리·유지보수", ja: "修理・メンテナンス", ru: "Ремонт и обслуживание" } },
  furniture: { labels: { en: "Furniture", ko: "가구", ja: "家具", ru: "Мебель" } },
  electricity_gas: { labels: { en: "Electricity & gas", ko: "전기·가스", ja: "電気・ガス", ru: "Электричество и газ" } },
  water: { labels: { en: "Water", ko: "수도", ja: "水道", ru: "Вода" } },
  waste_management: { labels: { en: "Waste collection", ko: "폐기물 처리", ja: "ごみ処理", ru: "Вывоз отходов" } },
  mobile_phone: { labels: { en: "Mobile phone bill", ko: "휴대전화 요금", ja: "携帯電話料金", ru: "Мобильная связь" } },
  internet: { labels: { en: "Internet", ko: "인터넷", ja: "インターネット", ru: "Интернет" } },
  postal_services: { labels: { en: "Post & delivery", ko: "우편·배송", ja: "郵便・配送", ru: "Почта и доставка" } },
  supermarket: { labels: { en: "Supermarket", ko: "마트", ja: "スーパーマーケット", ru: "Супермаркет" } },
  convenience_store: { labels: { en: "Convenience store", ko: "편의점", ja: "コンビニ", ru: "Магазин у дома" } },
  household_supplies: { labels: { en: "Household supplies", ko: "생활용품", ja: "日用品", ru: "Хозяйственные товары" } },
  restaurant: { labels: { en: "Restaurant", ko: "식당", ja: "レストラン", ru: "Ресторан" } },
  cafe: { labels: { en: "Cafe", ko: "카페", ja: "カフェ", ru: "Кафе" } },
  delivery_takeout: { labels: { en: "Delivery & takeout", ko: "배달·포장", ja: "デリバリー・持ち帰り", ru: "Доставка и еда навынос" } },
  bus_subway: { labels: { en: "Bus & subway", ko: "버스·지하철", ja: "バス・地下鉄", ru: "Автобус и метро" } },
  taxi_rideshare: { labels: { en: "Taxi & ride-hailing", ko: "택시·차량 호출", ja: "タクシー・配車サービス", ru: "Такси и сервисы заказа поездок" } },
  rail: { labels: { en: "Rail", ko: "철도", ja: "鉄道", ru: "Железнодорожный транспорт" } },
  fuel: { labels: { en: "Fuel", ko: "연료비", ja: "ガソリン・燃料", ru: "Топливо" } },
  parking_tolls: { labels: { en: "Parking & tolls", ko: "주차·통행료", ja: "駐車料金・通行料", ru: "Парковка и платные дороги" } },
  vehicle_maintenance: { labels: { en: "Maintenance", ko: "차량 정비", ja: "車両整備", ru: "Обслуживание автомобиля" } },
  flights: { labels: { en: "Flights", ko: "항공권", ja: "航空券", ru: "Авиабилеты" } },
  accommodation: { labels: { en: "Accommodation", ko: "숙박", ja: "宿泊", ru: "Проживание" } },
  travel_transport: { labels: { en: "Local transport", ko: "현지 교통", ja: "現地交通", ru: "Местный транспорт" } },
  travel_activities: { labels: { en: "Activities", ko: "관광·체험", ja: "観光・アクティビティ", ru: "Экскурсии и развлечения" } },
  visa_fees: { labels: { en: "Visa & entry fees", ko: "비자·입국 비용", ja: "ビザ・入国費用", ru: "Виза и сборы за въезд" } },
  clinic_hospital: { labels: { en: "Clinic & hospital", ko: "병원·의원", ja: "病院・クリニック", ru: "Клиника и больница" } },
  pharmacy: { labels: { en: "Pharmacy", ko: "약국", ja: "薬局", ru: "Аптека" } },
  dental: { labels: { en: "Dental", ko: "치과", ja: "歯科", ru: "Стоматология" } },
  vision: { labels: { en: "Eye care & eyewear", ko: "안과·안경", ja: "眼科・眼鏡", ru: "Офтальмология и очки" } },
  fitness: { labels: { en: "Fitness & sports", ko: "운동·스포츠", ja: "フィットネス・スポーツ", ru: "Фитнес и спорт" } },
  hair_beauty: { labels: { en: "Hair & beauty", ko: "헤어·미용", ja: "ヘア・美容", ru: "Парикмахерские и салоны красоты" } },
  skincare: { labels: { en: "Skincare", ko: "스킨케어", ja: "スキンケア", ru: "Уход за кожей" } },
  spa_wellness: { labels: { en: "Spa & wellness", ko: "스파·웰니스", ja: "スパ・ウェルネス", ru: "Спа и оздоровление" } },
  tuition: { labels: { en: "Tuition", ko: "학비", ja: "授業料", ru: "Плата за обучение" } },
  books_supplies: { labels: { en: "Books & supplies", ko: "도서·학용품", ja: "書籍・学用品", ru: "Книги и материалы" } },
  online_courses: { labels: { en: "Online courses", ko: "온라인 강의", ja: "オンライン講座", ru: "Онлайн-курсы" } },
  clothing: { labels: { en: "Clothing", ko: "의류", ja: "衣類", ru: "Одежда" } },
  electronics: { labels: { en: "Electronics", ko: "전자제품", ja: "電子機器", ru: "Электроника" } },
  home_goods: { labels: { en: "Home goods", ko: "가정용품", ja: "家庭用品", ru: "Товары для дома" } },
  movies_events: { labels: { en: "Movies & events", ko: "영화·공연", ja: "映画・イベント", ru: "Кино и мероприятия" } },
  games: { labels: { en: "Games", ko: "게임", ja: "ゲーム", ru: "Игры" } },
  hobbies: { labels: { en: "Hobbies", ko: "취미", ja: "趣味", ru: "Хобби" } },
  media_streaming: { labels: { en: "Media streaming", ko: "영상·음악 스트리밍", ja: "動画・音楽配信", ru: "Стриминг" } },
  software: { labels: { en: "Software", ko: "소프트웨어", ja: "ソフトウェア", ru: "Программы" } },
  memberships: { labels: { en: "Memberships", ko: "멤버십", ja: "メンバーシップ", ru: "Членские взносы" } },
  childcare: { labels: { en: "Childcare", ko: "육아", ja: "育児", ru: "Уход за детьми" } },
  school_support: { labels: { en: "School-related costs", ko: "자녀 교육 지원", ja: "子どもの学校関連費", ru: "Школьные расходы" } },
  eldercare: { labels: { en: "Eldercare", ko: "노인 돌봄·간병", ja: "高齢者ケア", ru: "Уход за пожилыми" } },
  pet_food: { labels: { en: "Pet food", ko: "반려동물 사료", ja: "ペットフード", ru: "Корм" } },
  veterinary: { labels: { en: "Veterinary care", ko: "동물병원", ja: "動物病院", ru: "Ветеринарные услуги" } },
  pet_grooming: { labels: { en: "Grooming", ko: "미용·관리", ja: "トリミング", ru: "Груминг" } },
  gifts_given: { labels: { en: "Gifts", ko: "선물", ja: "贈り物", ru: "Подарки" } },
  donations: { labels: { en: "Donations", ko: "기부", ja: "寄付", ru: "Пожертвования" } },
  celebrations: { labels: { en: "Celebrations", ko: "경조사", ja: "冠婚葬祭", ru: "Праздники и события" } },
  health_insurance: { labels: { en: "Health insurance", ko: "건강보험", ja: "健康保険", ru: "Медицинская страховка" } },
  life_insurance: { labels: { en: "Life insurance", ko: "생명보험", ja: "生命保険", ru: "Страхование жизни" } },
  property_insurance: { labels: { en: "Property insurance", ko: "재산보험", ja: "損害保険", ru: "Страхование имущества" } },
  income_tax: { labels: { en: "Income tax", ko: "소득세", ja: "所得税", ru: "Подоходный налог" } },
  property_tax: { labels: { en: "Property tax", ko: "재산세", ja: "固定資産税", ru: "Налог на имущество" } },
  government_fees: { labels: { en: "Government fees", ko: "행정 수수료", ja: "行政手数料", ru: "Государственные сборы" } },
  bank_fees: { labels: { en: "Bank fees", ko: "은행 수수료", ja: "銀行手数料", ru: "Банковские комиссии" } },
  card_fees: { labels: { en: "Card fees", ko: "카드 수수료", ja: "カード手数料", ru: "Комиссии по карте" } },
  loan_interest: { labels: { en: "Loan interest", ko: "대출 이자", ja: "ローン利息", ru: "Проценты по кредиту" } },
  base_salary: { labels: { en: "Base salary", ko: "기본급", ja: "基本給", ru: "Оклад" } },
  bonus: { labels: { en: "Bonus", ko: "보너스", ja: "ボーナス", ru: "Премия" } },
  allowance: { labels: { en: "Allowance", ko: "수당", ja: "手当", ru: "Надбавка" } },
  client_work: { labels: { en: "Client work", ko: "고객 업무", ja: "クライアント業務", ru: "Работа с клиентами" } },
  business_sales: { labels: { en: "Business sales", ko: "사업 매출", ja: "事業売上", ru: "Выручка от продаж" } },
  consulting: { labels: { en: "Consulting", ko: "컨설팅", ja: "コンサルティング", ru: "Консалтинг" } },
  interest_income: { labels: { en: "Interest", ko: "이자", ja: "利息", ru: "Проценты" } },
  dividends: { labels: { en: "Dividends", ko: "배당", ja: "配当", ru: "Дивиденды" } },
  capital_gains: { labels: { en: "Capital gains", ko: "매매차익", ja: "売却益", ru: "Доход от прироста капитала" } },
  purchase_refund: { labels: { en: "Purchase refund", ko: "구매 환불", ja: "購入代金の返金", ru: "Возврат средств за покупку" } },
  tax_refund: { labels: { en: "Tax refund", ko: "세금 환급", ja: "税金の還付", ru: "Возврат налога" } },
  reimbursement: { labels: { en: "Reimbursement", ko: "비용 환급", ja: "経費精算", ru: "Компенсация расходов" } },
  cash_gift: { labels: { en: "Cash gift", ko: "받은 현금", ja: "贈与金", ru: "Денежный подарок" } },
  family_support: { labels: { en: "Family support", ko: "가족 지원금", ja: "家族からの支援", ru: "Поддержка семьи" } },
  prizes: { labels: { en: "Prizes", ko: "상금", ja: "賞金", ru: "Призы" } },
  grants: { labels: { en: "Grants", ko: "지원금", ja: "助成金", ru: "Гранты" } },
} as const satisfies Record<string, SubcategoryDefinition>;

export type SubcategoryId = keyof typeof SUBCATEGORY_META;

export const SUBCATEGORY_IDS_BY_CATEGORY: Partial<
  Record<LedgerCategoryId, readonly SubcategoryId[]>
> = {
  housing: ["rent_mortgage", "home_maintenance", "furniture"],
  utilities: ["electricity_gas", "water", "waste_management"],
  communication: ["mobile_phone", "internet", "postal_services"],
  groceries: ["supermarket", "convenience_store", "household_supplies"],
  dining: ["restaurant", "cafe", "delivery_takeout"],
  transport: ["bus_subway", "taxi_rideshare", "rail"],
  vehicle: ["fuel", "parking_tolls", "vehicle_maintenance"],
  travel: ["flights", "accommodation", "travel_transport", "travel_activities", "visa_fees"],
  health: ["clinic_hospital", "pharmacy", "dental", "vision", "fitness"],
  personal_care: ["hair_beauty", "skincare", "spa_wellness"],
  education: ["tuition", "books_supplies", "online_courses"],
  shopping: ["clothing", "electronics", "home_goods"],
  entertainment: ["movies_events", "games", "hobbies"],
  subscriptions: ["media_streaming", "software", "memberships"],
  family: ["childcare", "school_support", "eldercare"],
  pets: ["pet_food", "veterinary", "pet_grooming"],
  gifts: ["gifts_given", "donations", "celebrations"],
  insurance: ["health_insurance", "life_insurance", "property_insurance"],
  taxes: ["income_tax", "property_tax", "government_fees"],
  financial: ["bank_fees", "card_fees", "loan_interest"],
  salary: ["base_salary", "bonus", "allowance"],
  freelance: ["client_work", "business_sales", "consulting"],
  investment_income: ["interest_income", "dividends", "capital_gains"],
  refund: ["purchase_refund", "tax_refund", "reimbursement"],
  gift_income: ["cash_gift", "family_support"],
  other_income: ["prizes", "grants"],
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
  return kind === "income"
    ? isIncomeCategory(category)
    : isExpenseCategory(category);
}

export function categoryIdsForKind(kind: CategoryKind) {
  return kind === "income" ? INCOME_CATEGORY_IDS : EXPENSE_CATEGORY_IDS;
}

export function categoryLabel(category: string, language: Language) {
  return (
    CATEGORY_META[category as LedgerCategoryId]?.labels[language] ??
    CATEGORY_META.other.labels[language]
  );
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
  return (
    SUBCATEGORY_META[subcategory as SubcategoryId]?.labels[language] ??
    CATEGORY_META.other.labels[language]
  );
}

export function categoryPathLabel(
  category: string,
  subcategory: string | null | undefined,
  language: Language,
) {
  const parent = categoryLabel(category, language);
  return subcategory
    ? `${parent} · ${subcategoryLabel(subcategory, language)}`
    : parent;
}
