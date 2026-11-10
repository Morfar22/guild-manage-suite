export function hasFreshLogTelemetry(
  observedAt: string | null | undefined,
  now = Date.now(),
) {
  const timestamp = observedAt ? Date.parse(observedAt) : NaN;
  return (
    Number.isFinite(timestamp) &&
    timestamp > now - 120_000 &&
    timestamp <= now + 60_000
  );
}
export function logCountDisplay(
  count: number | undefined,
  unavailable: boolean,
  telemetryFresh: boolean,
): number | "—" {
  if (unavailable || count === undefined || (count === 0 && !telemetryFresh))
    return "—";
  return count;
}
