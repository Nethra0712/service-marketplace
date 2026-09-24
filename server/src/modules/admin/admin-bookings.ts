import { alias } from 'drizzle-orm/pg-core';
import { and, desc, eq, ilike, or } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import {
  bookingOffers,
  bookingProviderReleases,
  bookings,
  cities,
  profiles,
  providerProfiles,
  serviceCategories,
  users,
  type BookingStatus,
} from '../../db/schema/index.js';

const customerProfile = alias(profiles, 'customer_profile');
const providerAccountProfile = alias(profiles, 'provider_account_profile');
const customerUser = alias(users, 'customer_user');

export interface AdminBookingRow {
  id: string;
  status: BookingStatus;
  categoryName: string;
  cityName: string;
  customerName: string | null;
  customerPhone: string;
  providerName: string | null;
  agreedAmount: string | null;
  createdAt: Date;
}

export interface AdminBookingDetail extends AdminBookingRow {
  scheduledAt: Date | null;
  serviceAddress: string;
  customerNotes: string | null;
  acceptedAt: Date | null;
  enRouteAt: Date | null;
  arrivedAt: Date | null;
  workStartedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelledByUserId: string | null;
  cancellationReason: string | null;
  offers: {
    id: string;
    providerProfileId: string;
    wave: number;
    status: string;
    offeredAt: Date;
    respondedAt: Date | null;
    distanceKm: string | null;
  }[];
  releases: { providerProfileId: string; reason: string | null; releasedAt: Date }[];
}

const summaryColumns = {
  id: bookings.id,
  status: bookings.status,
  categoryName: serviceCategories.name,
  cityName: cities.name,
  customerName: customerProfile.fullName,
  customerPhone: customerUser.phoneE164,
  providerName: providerAccountProfile.fullName,
  agreedAmount: bookings.agreedAmount,
  createdAt: bookings.createdAt,
};

function summaryQuery(db: Database) {
  return db
    .select(summaryColumns)
    .from(bookings)
    .innerJoin(serviceCategories, eq(serviceCategories.id, bookings.serviceCategoryId))
    .innerJoin(cities, eq(cities.id, bookings.cityId))
    .innerJoin(customerUser, eq(customerUser.id, bookings.customerId))
    .leftJoin(customerProfile, eq(customerProfile.userId, bookings.customerId))
    .leftJoin(providerProfiles, eq(providerProfiles.id, bookings.providerProfileId))
    .leftJoin(providerAccountProfile, eq(providerAccountProfile.userId, providerProfiles.userId));
}

export interface AdminBookingFilter {
  status?: BookingStatus | undefined;
  /** Matches the customer's or provider's name/phone. */
  search?: string | undefined;
  limit: number;
}

/** Read-only admin visibility into every booking: search, full detail, assignment and cancellation history. Nothing here writes. */
export function createAdminBookingsService({ db }: { db: Database }) {
  return {
    async list(filter: AdminBookingFilter): Promise<AdminBookingRow[]> {
      const conditions = [
        filter.status ? eq(bookings.status, filter.status) : undefined,
        filter.search
          ? or(
              ilike(customerProfile.fullName, `%${filter.search}%`),
              ilike(customerUser.phoneE164, `%${filter.search}%`),
              ilike(providerAccountProfile.fullName, `%${filter.search}%`),
            )
          : undefined,
      ].filter((c) => c !== undefined);

      return summaryQuery(db)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(bookings.createdAt))
        .limit(filter.limit);
    },

    async getDetail(id: string): Promise<AdminBookingDetail | undefined> {
      const [row] = await summaryQuery(db).where(eq(bookings.id, id));
      if (!row) return undefined;

      const [[full], offers, releases] = await Promise.all([
        db.select().from(bookings).where(eq(bookings.id, id)),
        db
          .select()
          .from(bookingOffers)
          .where(eq(bookingOffers.bookingId, id))
          .orderBy(bookingOffers.wave),
        db.select().from(bookingProviderReleases).where(eq(bookingProviderReleases.bookingId, id)),
      ]);
      if (!full) return undefined;

      return {
        ...row,
        scheduledAt: full.scheduledAt,
        serviceAddress: full.serviceAddress,
        customerNotes: full.customerNotes,
        acceptedAt: full.acceptedAt,
        enRouteAt: full.enRouteAt,
        arrivedAt: full.arrivedAt,
        workStartedAt: full.workStartedAt,
        completedAt: full.completedAt,
        cancelledAt: full.cancelledAt,
        cancelledByUserId: full.cancelledByUserId,
        cancellationReason: full.cancellationReason,
        offers: offers.map((o) => ({
          id: o.id,
          providerProfileId: o.providerProfileId,
          wave: o.wave,
          status: o.status,
          offeredAt: o.offeredAt,
          respondedAt: o.respondedAt,
          distanceKm: o.distanceKm,
        })),
        releases: releases.map((r) => ({
          providerProfileId: r.providerProfileId,
          reason: r.reason,
          releasedAt: r.releasedAt,
        })),
      };
    },
  };
}

export type AdminBookingsService = ReturnType<typeof createAdminBookingsService>;
