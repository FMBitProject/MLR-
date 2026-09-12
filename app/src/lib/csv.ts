/** Escape structure and force potentially executable spreadsheet cells to text.
 * Include CR and leading whitespace/control characters: CSV quoting alone does
 * not stop spreadsheet formula evaluation. */
export function csvEscape(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
