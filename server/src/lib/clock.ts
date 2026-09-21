/**
 * Source of "now". Injected everywhere time matters (expiry, cooldowns, token
 * lifetimes) so tests can move time deterministically instead of sleeping.
 */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}
