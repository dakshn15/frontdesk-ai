/**
 * Merges ranked lists of ids: each list adds 1 / (k + rank) for every id it contains, so ids
 * that rank well in several lists come first. k = 60 is the usual constant.
 */
export function reciprocalRankFusion(
  lists: string[][],
  k = 60,
): { id: string; score: number }[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, index) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1));
    });
  }
  return [...scores]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
