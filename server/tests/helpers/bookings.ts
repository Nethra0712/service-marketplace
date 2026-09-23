import type { BookingDetailView, QuoteView } from '../../src/modules/bookings/index.js';
import { only } from './factories.js';

/** The shape of the standard error envelope, typed enough for assertions. */
export interface ErrorBody {
  code: string;
  message: string;
  requestId?: string;
  details?: { path: string; message: string }[];
}

/** A booking response body, typed instead of `any` (supertest leaves `.body` untyped). */
export const bookingOf = (res: { body: unknown }): BookingDetailView =>
  res.body as BookingDetailView;

/** A `{ items: [...] }` list response body, typed. */
export const itemsOf = (res: { body: unknown }): BookingDetailView[] =>
  (res.body as { items: BookingDetailView[] }).items;

/** An `{ error: {...} }` response body, typed. */
export const errorOf = (res: { body: unknown }): ErrorBody =>
  (res.body as { error: ErrorBody }).error;

/** Asserts `value` is not null/undefined and narrows it, without `!`. */
export function mustExist<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`Expected ${what} to exist.`);
  return value;
}

/** The single quote on a booking response. Fails loudly if there isn't exactly one. */
export const firstQuote = (res: { body: unknown }): QuoteView => only(bookingOf(res).quotes);

/** The assigned provider on a booking response. Fails loudly if there is none. */
export const providerOf = (res: { body: unknown }) =>
  mustExist(bookingOf(res).provider, 'an assigned provider');
