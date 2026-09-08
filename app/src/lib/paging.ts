// Server-side paging for the list pages. Every list here reads a tenant's
// whole history, which only grows, so the page size is what keeps a request's
// cost flat rather than proportional to how long the workspace has existed.

export const PAGE_SIZE = 25;

/**
 * Reads a 1-based page number off a search param. Anything that isn't a
 * positive integer (missing, "0", "-3", "abc", "2.5") means page 1, so a
 * hand-edited URL can't produce a negative OFFSET or a NaN query.
 */
export function pageParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** OFFSET for a 1-based page. */
export function offsetFor(page: number, pageSize = PAGE_SIZE): number {
  return (page - 1) * pageSize;
}

/**
 * Builds the pager's hrefs, preserving the filters already in the URL.
 * Page 1 drops the param so the canonical list URL stays clean.
 */
export function pageHref(
  basePath: string,
  params: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page") continue;
    const v = Array.isArray(value) ? value[0] : value;
    if (v) qs.set(key, v);
  }
  if (page > 1) qs.set("page", String(page));
  const q = qs.toString();
  return q ? `${basePath}?${q}` : basePath;
}
