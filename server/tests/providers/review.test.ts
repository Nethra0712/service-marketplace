import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { providerProfiles, providerServices } from '../../src/db/schema/index.js';
import type {
  ProviderServiceStatus,
  ProviderVerificationStatus,
} from '../../src/db/schema/index.js';
import { AppError } from '../../src/lib/errors.js';
import {
  APPLICATION_TRANSITIONS,
  createReviewService,
} from '../../src/modules/providers/review.service.js';
import { FakeClock } from '../helpers/app.js';
import { createCatalogue, type Catalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { createApplication, createProvider, only } from '../helpers/factories.js';

/**
 * The reviewer state machine. No HTTP route reaches it; these tests are what
 * guarantees the rules before an admin app exists.
 */
const handle = createTestDatabase();
const { db } = handle;

let catalogue: Catalogue;
beforeEach(async () => {
  await resetDatabase(db);
  catalogue = await createCatalogue(db);
});
afterAll(() => handle.close());

const setup = () => {
  const clock = new FakeClock();
  return { clock, review: createReviewService({ db, clock: clock.now }) };
};

const statusOf = async (id: string) =>
  only(await db.select().from(providerServices).where(eq(providerServices.id, id)));

async function applicationIn(state: ProviderServiceStatus) {
  const { profile } = await createProvider(db);
  return createApplication(db, profile.id, catalogue.plumbing, catalogue.colombo, state);
}

async function expectRejection(promise: Promise<unknown>, status: number, code: string) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ status, code });
}

describe('reviewing a category application', () => {
  it.each([
    ['pending', 'approved'],
    ['pending', 'rejected'],
    ['approved', 'suspended'],
    ['suspended', 'approved'],
    ['rejected', 'approved'],
  ] as const)('allows %s -> %s', async (from, to) => {
    const { review, clock } = setup();
    const application = await applicationIn(from);

    await review.reviewApplication({
      applicationId: application.id,
      decision: to,
      note: 'Because.',
    });

    const after = await statusOf(application.id);
    expect(after.status).toBe(to);
    expect(after.reviewNote).toBe('Because.');
    expect(after.reviewedAt?.getTime()).toBe(clock.now().getTime());
  });

  it.each([
    ['approved', 'approved'],
    ['approved', 'rejected'],
    ['suspended', 'rejected'],
    ['suspended', 'suspended'],
    ['rejected', 'rejected'],
    ['rejected', 'suspended'],
    ['pending', 'suspended'],
  ] as const)('refuses %s -> %s with 409 and changes nothing', async (from, to) => {
    const { review } = setup();
    const application = await applicationIn(from);
    const before = await statusOf(application.id);

    await expectRejection(
      review.reviewApplication({ applicationId: application.id, decision: to }),
      409,
      'INVALID_STATE',
    );

    expect(await statusOf(application.id)).toEqual(before);
  });

  it('covers every decision a reviewer can make', () => {
    expect(Object.keys(APPLICATION_TRANSITIONS).sort()).toEqual([
      'approved',
      'rejected',
      'suspended',
    ]);
    // A reviewer can never move an application to "pending": only the provider re-opens one.
    expect(Object.keys(APPLICATION_TRANSITIONS)).not.toContain('pending');
  });

  it('always records when a decision was made, so the database constraint is never violated', async () => {
    const { review } = setup();
    const application = await applicationIn('pending');

    await review.reviewApplication({ applicationId: application.id, decision: 'approved' });

    expect((await statusOf(application.id)).reviewedAt).not.toBeNull();
  });

  it('trims and caps the note, and treats a blank one as none', async () => {
    const { review } = setup();
    const a = await applicationIn('pending');
    const b = await applicationIn('pending');

    await review.reviewApplication({
      applicationId: a.id,
      decision: 'rejected',
      note: `  ${'x'.repeat(600)}  `,
    });
    await review.reviewApplication({ applicationId: b.id, decision: 'rejected', note: '   ' });

    expect((await statusOf(a.id)).reviewNote).toBe('x'.repeat(500));
    expect((await statusOf(b.id)).reviewNote).toBeNull();
  });

  it('reports an unknown application as 404', async () => {
    const { review } = setup();

    await expectRejection(
      review.reviewApplication({
        applicationId: '00000000-0000-4000-8000-000000000000',
        decision: 'approved',
      }),
      404,
      'NOT_FOUND',
    );
  });

  it('decides each category separately for the same provider', async () => {
    const { review } = setup();
    const { profile } = await createProvider(db);
    const plumbing = await createApplication(db, profile.id, catalogue.plumbing, catalogue.colombo);
    const electrical = await createApplication(
      db,
      profile.id,
      catalogue.electrical,
      catalogue.colombo,
    );

    await review.reviewApplication({ applicationId: plumbing.id, decision: 'approved' });

    expect((await statusOf(plumbing.id)).status).toBe('approved');
    expect((await statusOf(electrical.id)).status).toBe('pending');
  });

  it('never leaves a half-applied decision when two conflicting decisions arrive at once', async () => {
    const { review } = setup();
    const application = await applicationIn('pending');

    const outcomes = await Promise.allSettled([
      review.reviewApplication({ applicationId: application.id, decision: 'approved' }),
      review.reviewApplication({ applicationId: application.id, decision: 'rejected' }),
    ]);

    // Approved may follow rejected (a reviewer changing their mind), so both can succeed in
    // sequence; what must never happen is a lost update leaving the row in an invalid state.
    expect(outcomes.some((o) => o.status === 'fulfilled')).toBe(true);
    const final = (await statusOf(application.id)).status;
    expect(['approved', 'rejected']).toContain(final);
    expect((await statusOf(application.id)).reviewedAt).not.toBeNull();
  });
});

describe('reviewing a provider profile', () => {
  async function profileIn(state: ProviderVerificationStatus) {
    const { profile } = await createProvider(db);
    const decided = state === 'verified' || state === 'rejected';
    await db
      .update(providerProfiles)
      .set({
        verificationStatus: state,
        submittedAt: state === 'draft' ? null : new Date(),
        reviewedAt: decided ? new Date() : null,
      })
      .where(eq(providerProfiles.id, profile.id));
    return profile.id;
  }
  const verificationOf = async (id: string) =>
    only(await db.select().from(providerProfiles).where(eq(providerProfiles.id, id)));

  it.each([
    ['submitted', 'verified'],
    ['submitted', 'rejected'],
    ['rejected', 'verified'],
  ] as const)('allows %s -> %s', async (from, to) => {
    const { review, clock } = setup();
    const id = await profileIn(from);

    await review.reviewProfile({ providerProfileId: id, decision: to, note: 'Checked.' });

    const after = await verificationOf(id);
    expect(after.verificationStatus).toBe(to);
    expect(after.reviewNote).toBe('Checked.');
    expect(after.reviewedAt?.getTime()).toBe(clock.now().getTime());
  });

  it.each([
    ['draft', 'verified'],
    ['draft', 'rejected'],
    ['verified', 'verified'],
    ['verified', 'rejected'],
    ['rejected', 'rejected'],
  ] as const)('refuses %s -> %s with 409', async (from, to) => {
    const { review } = setup();
    const id = await profileIn(from);

    await expectRejection(
      review.reviewProfile({ providerProfileId: id, decision: to }),
      409,
      'INVALID_STATE',
    );

    expect((await verificationOf(id)).verificationStatus).toBe(from);
  });

  it('cannot verify a profile that was never submitted', async () => {
    const { review } = setup();
    const id = await profileIn('draft');

    await expectRejection(
      review.reviewProfile({ providerProfileId: id, decision: 'verified' }),
      409,
      'INVALID_STATE',
    );
  });

  it('reports an unknown profile as 404', async () => {
    const { review } = setup();

    await expectRejection(
      review.reviewProfile({
        providerProfileId: '00000000-0000-4000-8000-000000000000',
        decision: 'verified',
      }),
      404,
      'NOT_FOUND',
    );
  });
});
