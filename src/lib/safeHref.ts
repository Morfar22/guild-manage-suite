/**
 * Returns the URL only when it uses a safe scheme (http, https, mailto).
 * Use for every href built from user- or database-provided values so that
 * `javascript:` / `data:` URLs can never execute in the dashboard.
 */
export function safeHref(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    return ["http:", "https:", "mailto:"].includes(url.protocol)
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}
