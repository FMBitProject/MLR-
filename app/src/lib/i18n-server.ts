import { cookies } from "next/headers";
import { dictionaries, type Dict, type Locale } from "./i18n";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const v = store.get("NEXT_LOCALE")?.value;
  return v === "en" ? "en" : "id";
}

export async function getDict(): Promise<{ dict: Dict; locale: Locale }> {
  const locale = await getLocale();
  return { dict: dictionaries[locale] as Dict, locale };
}
