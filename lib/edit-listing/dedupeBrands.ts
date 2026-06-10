export type BrandListRow = {
  id: number;
  name: string;
  count: number;
};

/** Une seule ligne par nom (garde le plus grand compteur d’annonces). */
export function dedupeBrandsByName(rows: BrandListRow[]): BrandListRow[] {
  const byName = new Map<string, BrandListRow>();
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    if (!key) continue;
    const existing = byName.get(key);
    if (!existing || row.count > existing.count) {
      byName.set(key, row);
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}
