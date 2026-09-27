// Review counts beside every rating (#130, parent #129) — restaurants.ts's
// fixed `reviewCount` per restaurant, shown through this formatter at every
// site that already shows the rating: home cards, the restaurant page, and
// the flash-sheet rows.

/**
 * The exact number under 1,000; floored to whole thousands with "k+" at
 * 1,000 and above — 1,999 reads "1k+", never "2k+" (#130 AC2).
 */
export function formatReviewCount(count: number): string {
  if (count < 1000) return String(count);
  return `${Math.floor(count / 1000)}k+`;
}
