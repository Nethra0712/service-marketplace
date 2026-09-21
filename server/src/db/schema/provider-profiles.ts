import { pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { timestamps } from './columns.js';
import { providerAvailability } from './enums.js';
import { users } from './users.js';

/**
 * Provider-specific data for a user who offers services. Its existence is
 * what makes a user a provider. Which categories the provider may actually
 * serve is decided per category in `provider_services`, never here.
 */
export const providerProfiles = pgTable(
  'provider_profiles',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /**
     * The provider's own online/offline toggle. Only the persisted intent lives
     * here; live presence and location are handled elsewhere in a later sprint.
     */
    availability: providerAvailability().notNull().default('offline'),
    ...timestamps,
  },
  (t) => [
    // At most one provider profile per user; also indexes the user_id foreign key.
    uniqueIndex('provider_profiles_user_id_uidx').on(t.userId),
  ],
);

export type ProviderProfile = typeof providerProfiles.$inferSelect;
export type NewProviderProfile = typeof providerProfiles.$inferInsert;
