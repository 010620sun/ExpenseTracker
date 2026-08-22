import { cookies } from "next/headers";

import {
  DEFAULT_LANGUAGE,
  isLanguage,
  LANGUAGE_COOKIE_NAME,
  type Language,
} from "@/lib/language";

export async function requestLanguage(): Promise<Language> {
  const cookieStore = await cookies();
  const stored = cookieStore.get(LANGUAGE_COOKIE_NAME)?.value;
  return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
}
