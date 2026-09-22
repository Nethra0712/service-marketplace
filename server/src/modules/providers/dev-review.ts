// DEVELOPMENT-ONLY CLI: `npm run dev:review -- <phone> ...`
//
// There is no admin app yet, so this stands in for a reviewer while developing:
// it approves, rejects or suspends providers and their category applications
// so the provider screens can be exercised end to end. It calls the same review
// service the future admin tooling will, and refuses to run in production.
//
//   npm run dev:review -- +94771234567 profile verified|rejected [note]
//   npm run dev:review -- +94771234567 service <category-slug> approved|rejected|suspended [note]
//   npm run dev:review -- +94771234567 show
import '../../config/dotenv.js';

import { and, eq, isNull } from 'drizzle-orm';

import { loadDatabaseEnv } from '../../config/env.js';
import { createDatabase } from '../../db/client.js';
import {
  cities,
  providerProfiles,
  providerServices,
  serviceCategories,
  users,
} from '../../db/schema/index.js';
import { systemClock } from '../../lib/clock.js';
import { assertDevelopmentOnly } from '../../lib/dev-only.js';
import {
  createReviewService,
  type ApplicationDecision,
  type ProfileDecision,
} from './review.service.js';

const USAGE = `Usage:
  npm run dev:review -- <phone> show
  npm run dev:review -- <phone> profile <verified|rejected> [note]
  npm run dev:review -- <phone> service <category-slug> <approved|rejected|suspended> [note]`;

const config = loadDatabaseEnv();
assertDevelopmentOnly(config.nodeEnv, 'the dev review script');

const [phone, command, ...rest] = process.argv.slice(2);
if (!phone || !command) {
  console.error(USAGE);
  process.exit(1);
}

const handle = createDatabase(config.databaseUrl);
const review = createReviewService({ db: handle.db, clock: systemClock });

try {
  const [profile] = await handle.db
    .select({ id: providerProfiles.id, status: providerProfiles.verificationStatus })
    .from(providerProfiles)
    .innerJoin(users, eq(users.id, providerProfiles.userId))
    .where(and(eq(users.phoneE164, phone), isNull(users.deletedAt)));
  if (!profile) throw new Error(`No provider profile for ${phone}. Create it in the app first.`);

  if (command === 'show') {
    const applications = await handle.db
      .select({ slug: serviceCategories.slug, city: cities.slug, status: providerServices.status })
      .from(providerServices)
      .innerJoin(serviceCategories, eq(serviceCategories.id, providerServices.serviceCategoryId))
      .innerJoin(cities, eq(cities.id, providerServices.cityId))
      .where(eq(providerServices.providerProfileId, profile.id));
    console.log(`Profile: ${profile.status}`);
    for (const a of applications) console.log(`  ${a.slug} (${a.city}): ${a.status}`);
  } else if (command === 'profile') {
    const [decision, ...note] = rest;
    if (decision !== 'verified' && decision !== 'rejected') throw new Error(USAGE);
    await review.reviewProfile({
      providerProfileId: profile.id,
      decision: decision satisfies ProfileDecision,
      note: note.join(' '),
    });
    console.log(`Profile is now ${decision}.`);
  } else if (command === 'service') {
    const [slug, decision, ...note] = rest;
    if (!slug || (decision !== 'approved' && decision !== 'rejected' && decision !== 'suspended')) {
      throw new Error(USAGE);
    }
    const [application] = await handle.db
      .select({ id: providerServices.id })
      .from(providerServices)
      .innerJoin(serviceCategories, eq(serviceCategories.id, providerServices.serviceCategoryId))
      .where(
        and(eq(providerServices.providerProfileId, profile.id), eq(serviceCategories.slug, slug)),
      );
    if (!application) throw new Error(`${phone} has no application for "${slug}".`);
    await review.reviewApplication({
      applicationId: application.id,
      decision: decision satisfies ApplicationDecision,
      note: note.join(' '),
    });
    console.log(`Application for "${slug}" is now ${decision}.`);
  } else {
    throw new Error(USAGE);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await handle.close();
}
