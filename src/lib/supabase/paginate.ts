/**
 * PostgREST returns at most 1 000 rows per request (Supabase default
 * `max-rows`). A single `.select()` over contacts / contact_tags
 * therefore silently truncates once an account grows past that — a
 * broadcast to "all contacts" stopped at 1 000, and the CSV import's
 * duplicate check missed every number after the first 1 000.
 *
 * `fetchAllPages` walks `.range()` windows until a short page comes
 * back. Callers MUST give the query a deterministic `.order()` so
 * pages don't overlap or skip rows.
 */
export const PAGE_SIZE = 1000;

export async function fetchAllPages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) return out;
  }
}

/**
 * `.in(column, ids)` is serialized into the request URL — a few
 * hundred UUIDs already exceed common URL limits. Slice id lists
 * before passing them to `.in()`.
 */
export const IN_CHUNK = 200;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
