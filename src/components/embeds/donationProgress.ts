export function buildProgressBar(
  current: number,
  goal: number,
  length = 16,
): string {
  const pct = goal > 0 ? Math.max(0, Math.min(1, current / goal)) : 0;
  const filled = Math.round(pct * length);
  return "█".repeat(filled) + "░".repeat(length - filled);
}
