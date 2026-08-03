/**
 * Pre-emptive usage warnings.
 *
 * Every successful metered call carries `x-misar-usage-*` headers describing
 * what the caller has left. Catching someone at 80% — while their task is still
 * working — converts far better than an error at 100%, and reads as helpful
 * rather than pushy.
 *
 * The last warning seen is stashed here and drained by the tool layer, so tools
 * do not each have to thread usage through their return path.
 */

export interface UsageWarning {
  feature: string;
  used: number;
  limit: number;
  remaining: number;
  ratio: number;
  upgradeUrl: string | null;
}

/** Warn from this fraction of the allowance onward. */
const WARN_THRESHOLD = 0.8;

let pending: UsageWarning | null = null;

/**
 * Read the usage headers off a response; stash a warning if we're close.
 *
 * Never throws. This runs on the hot path of EVERY API call, so a response
 * without a standard `headers` object — a proxy, a test double, an older
 * runtime — must degrade to "no warning", never break the call itself.
 */
export function noteUsage(headers: Headers | null | undefined): void {
  // Reset FIRST. Every response clears the previous state, so a warning raised
  // by an earlier metered write can never leak onto a later unrelated call —
  // which would show the user a footer that has nothing to do with what they
  // just did.
  pending = null;

  if (!headers || typeof headers.get !== "function") return;

  const feature = headers.get("x-misar-usage-feature");
  const usedRaw = headers.get("x-misar-usage-used");
  const limitRaw = headers.get("x-misar-usage-limit");
  if (!feature || usedRaw === null || limitRaw === null) return;

  const used = Number(usedRaw);
  const limit = Number(limitRaw);
  // limit <= 0 means unlimited (or nonsense) — nothing worth warning about.
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return;

  const remainingRaw = headers.get("x-misar-usage-remaining");
  const remaining =
    remainingRaw !== null && Number.isFinite(Number(remainingRaw))
      ? Number(remainingRaw)
      : Math.max(0, limit - used);

  const ratio = used / limit;
  // Below the threshold, or already blocked (the card covers that case).
  if (ratio < WARN_THRESHOLD || remaining <= 0) {
    pending = null;
    return;
  }

  pending = {
    feature,
    used,
    limit,
    remaining,
    ratio,
    upgradeUrl: headers.get("x-misar-upgrade-url"),
  };
}

/** Take (and clear) the pending warning as a one-line footer, if any. */
export function takeUsageFooter(): string | null {
  const warning = pending;
  pending = null;
  if (!warning) return null;

  const label = warning.feature.replace(/_/g, " ");
  const tail = warning.upgradeUrl ? `\n   More at ${warning.upgradeUrl}` : "";

  return (
    `\n\n⚡ ${warning.remaining.toLocaleString("en-US")} of ` +
    `${warning.limit.toLocaleString("en-US")} ${label} left. ` +
    `Run \`upgrade\` to see your options.${tail}`
  );
}

/** Append the pending warning to a tool's text result, when there is one. */
export function withUsageFooter(text: string): string {
  const footer = takeUsageFooter();
  return footer ? `${text}${footer}` : text;
}
