import { useSearch } from "@tanstack/react-router";

/**
 * React Router compatible shim over TanStack Router's useSearch.
 * Returns a URLSearchParams instance built from the current query string.
 */
export function useSearchParams(): [URLSearchParams] {
  const search = useSearch({ strict: false });
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  }
  return [params];
}
