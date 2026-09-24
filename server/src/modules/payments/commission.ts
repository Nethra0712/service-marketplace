/** The financial split of a completed booking's service amount. */
export interface CommissionBreakdown {
  /** Echoed back, formatted to 2dp, for convenience. */
  serviceAmount: string;
  /** The platform's cut. */
  commissionAmount: string;
  /** What the provider actually earns: always `serviceAmount - commissionAmount`, exactly. */
  providerEarningAmount: string;
}

const toCents = (decimalAmount: string): number => Math.round(Number(decimalAmount) * 100);
const fromCents = (cents: number): string => (cents / 100).toFixed(2);

/**
 * Splits a service amount into the platform's commission and the provider's
 * earning, using `commissionBasisPoints` (1500 = 15.00%). All arithmetic is
 * done in integer cents to avoid floating-point drift.
 *
 * The commission is rounded to the nearest cent (half up); the provider's
 * earning is then whatever is left over (`serviceCents - commissionCents`),
 * never independently rounded. This guarantees
 * `commissionAmount + providerEarningAmount === serviceAmount` exactly, so a
 * rounding remainder can never silently vanish or be double-counted — it
 * always lands with the provider, never inflating the platform's cut.
 *
 * This is the only place commission math happens; nothing else in the
 * codebase should compute a percentage of a service amount by hand.
 */
export function calculateCommission(
  serviceAmount: string,
  commissionBasisPoints: number,
): CommissionBreakdown {
  if (commissionBasisPoints < 0 || commissionBasisPoints > 10_000) {
    throw new RangeError('commissionBasisPoints must be between 0 and 10000');
  }
  const serviceCents = toCents(serviceAmount);
  if (!Number.isFinite(serviceCents) || serviceCents <= 0) {
    throw new RangeError('serviceAmount must be a positive decimal amount');
  }
  const commissionCents = Math.round((serviceCents * commissionBasisPoints) / 10_000);
  const providerEarningCents = serviceCents - commissionCents;
  return {
    serviceAmount: fromCents(serviceCents),
    commissionAmount: fromCents(commissionCents),
    providerEarningAmount: fromCents(providerEarningCents),
  };
}
