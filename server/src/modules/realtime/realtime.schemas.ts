import { z } from 'zod';

/** `booking:join` / `booking:leave` payload. */
export const bookingRoomSchema = z.strictObject({ bookingId: z.uuid() });

/**
 * `location:update` payload. Only latitude/longitude are required; the rest
 * describe the reading and are optional because not every device/provider
 * reports them.
 */
export const locationUpdateSchema = z.strictObject({
  bookingId: z.uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  /** Compass heading in degrees, 0-360. */
  heading: z.number().min(0).max(360).nullish(),
  /** Ground speed in metres/second. */
  speed: z.number().min(0).nullish(),
  /** The device's own accuracy estimate, in metres. */
  accuracyMeters: z.number().min(0).nullish(),
});

export type LocationUpdatePayload = z.infer<typeof locationUpdateSchema>;
