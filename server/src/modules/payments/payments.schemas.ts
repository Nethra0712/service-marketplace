import { z } from 'zod';

const idParams = z.object({ id: z.uuid() });

export const paymentsSchemas = {
  /** GET /:id/payment and POST /:id/payment/checkout: `:id` is the booking id. */
  forBooking: z.object({ params: idParams }),

  /**
   * The webhook body is a gateway callback, not application input: its shape
   * varies by gateway and its authenticity is checked by
   * `PaymentProvider#verifyCallback` (a signature), not by this schema. Only
   * confirms the body is the object shape `express.json`/`express.urlencoded`
   * always produce for a POST.
   */
  webhook: z.object({ body: z.record(z.string(), z.unknown()) }),
};
