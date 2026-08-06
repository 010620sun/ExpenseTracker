import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  const binding = env.DB;

  if (!binding) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Apply the generated Drizzle migration and deploy with the DB binding enabled.",
    );
  }

  return drizzle(binding, { schema });
}

export type AppDatabase = ReturnType<typeof getDb>;
