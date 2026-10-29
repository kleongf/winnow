/** The Episodes before and after `id` in the table's order, for J/K. */
export function neighbours(
  ids: string[],
  id: string,
): { prev: string | null; next: string | null } {
  const i = ids.indexOf(id);
  if (i < 0) return { prev: null, next: null };
  return { prev: ids[i - 1] ?? null, next: ids[i + 1] ?? null };
}
