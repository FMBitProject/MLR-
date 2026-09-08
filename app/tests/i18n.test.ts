import { test } from "node:test";
import assert from "node:assert/strict";
import { dictionaries, formatDate, daysUntil, relativeDays } from "../src/lib/i18n.ts";

/** Every leaf key path in a nested dictionary object. */
function keyPaths(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k),
  );
}

test("i18n: both locales exist", () => {
  assert.ok(dictionaries.id);
  assert.ok(dictionaries.en);
});

test("i18n: the English dictionary has exactly the same keys as Indonesian", () => {
  const id = keyPaths(dictionaries.id).sort();
  const en = keyPaths(dictionaries.en).sort();
  const missingInEn = id.filter((k) => !en.includes(k));
  const extraInEn = en.filter((k) => !id.includes(k));
  assert.deepEqual(missingInEn, [], "keys present in id but missing from en");
  assert.deepEqual(extraInEn, [], "keys present in en but missing from id");
});

test("i18n: no translation string is empty", () => {
  for (const [locale, dict] of Object.entries(dictionaries)) {
    const walk = (obj: unknown, path: string) => {
      if (typeof obj === "string") {
        assert.ok(obj.trim().length > 0, `${locale}.${path} is empty`);
        return;
      }
      if (obj && typeof obj === "object")
        for (const [k, v] of Object.entries(obj)) walk(v, path ? `${path}.${k}` : k);
    };
    walk(dict, "");
  }
});

test("i18n: matching keys hold the same value type in both locales", () => {
  const walk = (a: unknown, b: unknown, path: string) => {
    assert.equal(typeof a, typeof b, `type mismatch at ${path}`);
    assert.equal(Array.isArray(a), Array.isArray(b), `array mismatch at ${path}`);
    if (a && typeof a === "object" && !Array.isArray(a))
      for (const k of Object.keys(a as object))
        walk((a as never)[k], (b as never)[k], path ? `${path}.${k}` : k);
  };
  walk(dictionaries.id, dictionaries.en, "");
});

test("i18n: formatDate renders per locale and handles nullish input", () => {
  const d = new Date("2026-03-15T00:00:00Z");
  assert.equal(formatDate(null, "id"), "—");
  assert.equal(formatDate(undefined, "en"), "—");
  assert.match(formatDate(d, "id"), /2026/);
  assert.match(formatDate(d, "en"), /2026/);
  assert.match(formatDate(d, "en"), /Mar/);
  assert.notEqual(formatDate(d, "id"), formatDate(d, "en"), "locales must differ");
});

test("i18n: formatDate accepts a timestamp as well as a Date", () => {
  const d = new Date("2026-03-15T00:00:00Z");
  assert.equal(formatDate(d.getTime(), "en"), formatDate(d, "en"));
});

test("i18n: daysUntil counts forward in both languages", () => {
  // daysUntil ceils, so "n days minus a moment" is the n-day reading; a date
  // n full days out plus any remainder already reads as n+1.
  const inDays = (n: number) => Date.now() + n * 86_400_000 - 1000;
  assert.equal(daysUntil(inDays(1), "id"), "1 hari lagi");
  assert.equal(daysUntil(inDays(1), "en"), "1 day left");
  assert.equal(daysUntil(inDays(5), "id"), "5 hari lagi");
  assert.equal(daysUntil(inDays(5), "en"), "5 days left");
});

test("i18n: daysUntil rounds a partial day up (30d + 1h reads as 31)", () => {
  // Deliberate: an expiry later today must never read as "0 days left".
  assert.equal(daysUntil(Date.now() + 86_400_000 + 3_600_000, "en"), "2 days left");
  assert.equal(daysUntil(Date.now() + 3_600_000, "en"), "1 day left");
});

test("i18n: daysUntil collapses today and the past to 'last day'", () => {
  assert.equal(daysUntil(Date.now() - 1000, "id"), "hari terakhir");
  assert.equal(daysUntil(Date.now() - 90 * 86_400_000, "en"), "last day");
});

test("i18n: relativeDays counts backward in both languages", () => {
  const agoDays = (n: number) => Date.now() - n * 86_400_000 - 1000;
  assert.equal(relativeDays(agoDays(0), "id"), "hari ini");
  assert.equal(relativeDays(agoDays(1), "id"), "1 hari lalu");
  assert.equal(relativeDays(agoDays(1), "en"), "1 day ago");
  assert.equal(relativeDays(agoDays(30), "en"), "30 days ago");
});

test("i18n: a future date reads as 'today', not a negative count", () => {
  assert.equal(relativeDays(Date.now() + 86_400_000, "id"), "hari ini");
  assert.equal(relativeDays(Date.now() + 86_400_000, "en"), "today");
});

test("i18n: relativeDays uses the singular for exactly one day", () => {
  // Regression: relativeDays had no singular branch and rendered "1 days ago",
  // while daysUntil in the same file already special-cased 1.
  const oneDayAgo = Date.now() - 86_400_000 - 1000;
  assert.equal(relativeDays(oneDayAgo, "en"), "1 day ago");
  assert.equal(relativeDays(oneDayAgo, "id"), "1 hari lalu");
});

test("i18n: the two day-counting helpers agree on singular handling", () => {
  // daysUntil and relativeDays are siblings; neither should pluralise a 1.
  assert.equal(daysUntil(Date.now() + 86_400_000 - 1000, "en"), "1 day left");
  assert.equal(relativeDays(Date.now() - 86_400_000 - 1000, "en"), "1 day ago");
});

test("i18n: plurals are still used for every other count", () => {
  assert.equal(relativeDays(Date.now() - 2 * 86_400_000 - 1000, "en"), "2 days ago");
  assert.equal(relativeDays(Date.now() - 30 * 86_400_000 - 1000, "en"), "30 days ago");
});
