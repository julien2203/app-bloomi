/** Affiche un entier de façon compacte (ex. 1200 → « 1.2K »). */
export function formatCompactCount(value: number): string {
  const n = Math.max(0, Math.round(Number(value) || 0));
  if (n < 1000) return String(n);
  if (n < 10_000) {
    const compact = Math.round(n / 100) / 10;
    return Number.isInteger(compact) ? `${compact}K` : `${compact.toFixed(1)}K`;
  }
  if (n < 1_000_000) return `${Math.round(n / 1000)}K`;
  const compact = Math.round(n / 100_000) / 10;
  return Number.isInteger(compact) ? `${compact}M` : `${compact.toFixed(1)}M`;
}
