import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { adminAuditLog, providerServices } from '../../src/db/schema/index.js';
import { bodyOf, itemsOf, signInAdmin } from '../helpers/admin.js';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { createCatalogue, type Catalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { createApprovedProvider, createProvider } from '../helpers/factories.js';
import { signInUser } from '../helpers/providers.js';

const handle = createTestDatabase();
const { db } = handle;
afterAll(() => handle.close());

let t: TestApp;
let catalogue: Catalogue;
beforeEach(async () => {
  await resetDatabase(db);
  catalogue = await createCatalogue(db);
  t = buildTestApp({ db });
});

describe('GET /api/admin/providers', () => {
  it('lists providers, searchable by name/phone', async () => {
    const { user, profile } = await createApprovedProvider(
      db,
      catalogue.cleaning,
      catalogue.colombo,
    );
    const { api } = await signInAdmin(t.app, db);

    const res = await api.get(`/api/admin/providers?q=${encodeURIComponent(user.phoneE164)}`);
    expect(res.status).toBe(200);
    expect(itemsOf<{ id: string }>(res).map((p) => p.id)).toContain(profile.id);
  });

  it('filters by verification status', async () => {
    await createApprovedProvider(db, catalogue.cleaning, catalogue.colombo); // verified
    await createProvider(db); // draft

    const { api } = await signInAdmin(t.app, db);
    const res = await api.get('/api/admin/providers?verificationStatus=verified');
    expect(res.status).toBe(200);
    expect(itemsOf(res)).toHaveLength(1);
  });
});

describe('GET /api/admin/providers/:id', () => {
  it('shows the provider and their category applications', async () => {
    const { profile, application } = await createApprovedProvider(
      db,
      catalogue.cleaning,
      catalogue.colombo,
    );
    const { api } = await signInAdmin(t.app, db);

    const res = await api.get(`/api/admin/providers/${profile.id}`);
    expect(res.status).toBe(200);
    const body = bodyOf<{ provider: { id: string }; applications: { id: string }[] }>(res);
    expect(body.provider.id).toBe(profile.id);
    expect(body.applications.map((a) => a.id)).toContain(application.id);
  });

  it('404s for a provider that does not exist', async () => {
    const { api } = await signInAdmin(t.app, db);
    const res = await api.get('/api/admin/providers/00000000-0000-4000-8000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('provider approval: POST /api/admin/providers/:id/applications/:applicationId/review', () => {
  it('approves a pending application and records an audit log entry', async () => {
    const { profile, application } = await createApprovedProvider(
      db,
      catalogue.cleaning,
      catalogue.colombo,
    );
    // Put it back to pending so there is something meaningful to approve.
    await db
      .update(providerServices)
      .set({ status: 'pending' })
      .where(eq(providerServices.id, application.id));

    const { admin, api } = await signInAdmin(t.app, db);
    const res = await api.post(
      `/api/admin/providers/${profile.id}/applications/${application.id}/review`,
      { decision: 'approved', note: 'Looks good' },
    );
    expect(res.status).toBe(204);

    const [entry] = await db
      .select()
      .from(adminAuditLog)
      .where(eq(adminAuditLog.targetId, application.id));
    expect(entry).toMatchObject({
      adminUserId: admin.id,
      action: 'provider_application_reviewed',
      targetType: 'provider_application',
      details: { decision: 'approved', note: 'Looks good' },
    });
  });

  it('a bad transition (e.g. approving an already-approved application) surfaces the same 409 the underlying rule gives', async () => {
    const { profile, application } = await createApprovedProvider(
      db,
      catalogue.cleaning,
      catalogue.colombo,
    );
    const { api } = await signInAdmin(t.app, db);
    const res = await api.post(
      `/api/admin/providers/${profile.id}/applications/${application.id}/review`,
      { decision: 'approved' },
    );
    expect(res.status).toBe(409);
  });

  it('rejects an invalid decision value', async () => {
    const { profile, application } = await createApprovedProvider(
      db,
      catalogue.cleaning,
      catalogue.colombo,
    );
    const { api } = await signInAdmin(t.app, db);
    const res = await api.post(
      `/api/admin/providers/${profile.id}/applications/${application.id}/review`,
      { decision: 'not-a-real-decision' },
    );
    expect(res.status).toBe(400);
  });
});

describe('provider profile verification: POST /api/admin/providers/:id/profile/review', () => {
  it('verifies a submitted profile and records an audit log entry', async () => {
    const { user, profile } = await createProvider(db);
    const { api: providerApi } = await signInUser(t.app, t.sms, user.phoneE164);
    await providerApi.put('/api/provider/profile', {
      fullName: 'Nimal Perera',
      bio: 'Experienced.',
      yearsOfExperience: 5,
    });
    // Submitting requires at least one service application.
    await providerApi.post('/api/provider/services', {
      categorySlug: 'plumbing',
      citySlug: 'colombo',
    });
    const submitted = await providerApi.post('/api/provider/profile/submit');
    expect(submitted.status).toBe(200);

    const { admin, api } = await signInAdmin(t.app, db);
    const res = await api.post(`/api/admin/providers/${profile.id}/profile/review`, {
      decision: 'verified',
    });
    expect(res.status).toBe(204);

    const [entry] = await db
      .select()
      .from(adminAuditLog)
      .where(eq(adminAuditLog.targetId, profile.id));
    expect(entry).toMatchObject({
      adminUserId: admin.id,
      action: 'provider_profile_reviewed',
      details: { decision: 'verified' },
    });
  });
});
