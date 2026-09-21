import { randomUUID } from 'node:crypto';

import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { authSessions, otpChallenges, refreshTokens, users } from '../../src/db/schema/index.js';
import { addSeconds } from '../../src/lib/clock.js';
import { createTestDatabase, expectPgError, PgCode, resetDatabase } from '../helpers/database.js';
import { createUser, only } from '../helpers/factories.js';

const handle = createTestDatabase();
const { db } = handle;

beforeEach(() => resetDatabase(db));
afterAll(() => handle.close());

const HASH = 'a'.repeat(64);
const now = () => new Date();
const inOneHour = () => addSeconds(new Date(), 3600);

async function insertSession(
  userId: string,
  overrides: Partial<typeof authSessions.$inferInsert> = {},
) {
  return only(
    await db
      .insert(authSessions)
      .values({ userId, expiresAt: inOneHour(), ...overrides })
      .returning(),
  );
}

describe('otp_challenges', () => {
  const valid = () => ({
    phoneE164: '+94771234567',
    codeHash: HASH,
    expiresAt: inOneHour(),
  });

  it('stores a challenge with sensible defaults, without needing an account', async () => {
    const row = only(await db.insert(otpChallenges).values(valid()).returning());

    expect(row.attempts).toBe(0);
    expect(row.consumedAt).toBeNull();
    expect(row.invalidatedAt).toBeNull();
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it.each([
    [
      'a code hash that is not 64 hex characters',
      { codeHash: '123456' },
      'otp_challenges_code_hash_format',
    ],
    ['an upper-case hash', { codeHash: 'A'.repeat(64) }, 'otp_challenges_code_hash_format'],
    ['a malformed phone number', { phoneE164: '0771234567' }, 'otp_challenges_phone_e164_format'],
    ['negative attempts', { attempts: -1 }, 'otp_challenges_attempts_non_negative'],
    [
      'an expiry before creation',
      { expiresAt: new Date(Date.now() - 1000) },
      'otp_challenges_expiry_after_creation',
    ],
  ])('rejects %s', async (_name, override, constraint) => {
    const error = await expectPgError(() =>
      db.insert(otpChallenges).values({ ...valid(), ...override }),
    );
    expect(error).toEqual({ code: PgCode.checkViolation, constraint });
  });

  it('maintains updated_at when attempts change', async () => {
    const row = only(await db.insert(otpChallenges).values(valid()).returning());

    await db.update(otpChallenges).set({ attempts: 1 }).where(eq(otpChallenges.id, row.id));
    const after = only(await db.select().from(otpChallenges));

    expect(after.updatedAt.getTime()).toBeGreaterThan(row.updatedAt.getTime());
  });
});

describe('auth_sessions', () => {
  it('belongs to a user and starts active', async () => {
    const user = await createUser(db);
    const session = await insertSession(user.id);

    expect(session.revokedAt).toBeNull();
    expect(session.revokedReason).toBeNull();
    expect(session.userId).toBe(user.id);
  });

  it('records a revocation together with its reason, never one without the other', async () => {
    const user = await createUser(db);

    const both = await insertSession(user.id, { revokedAt: now(), revokedReason: 'logout' });
    expect(both.revokedReason).toBe('logout');

    const noReason = await expectPgError(() => insertSession(user.id, { revokedAt: now() }));
    const noTime = await expectPgError(() => insertSession(user.id, { revokedReason: 'logout' }));
    expect(noReason.constraint).toBe('auth_sessions_revocation_consistent');
    expect(noTime.constraint).toBe('auth_sessions_revocation_consistent');
  });

  it('accepts only the known revocation reasons', async () => {
    const user = await createUser(db);
    const session = await insertSession(user.id);

    const error = await expectPgError(() =>
      db.execute(
        sql`update auth_sessions set revoked_at = now(), revoked_reason = 'because' where id = ${session.id}`,
      ),
    );
    expect(error.code).toBe(PgCode.invalidEnumValue);
  });

  it('must end after it starts', async () => {
    const user = await createUser(db);
    const error = await expectPgError(() =>
      insertSession(user.id, { expiresAt: new Date(Date.now() - 1000) }),
    );
    expect(error.constraint).toBe('auth_sessions_expiry_after_creation');
  });

  it('cannot outlive its user: a user with sessions cannot be hard-deleted', async () => {
    const user = await createUser(db);
    await insertSession(user.id);

    const error = await expectPgError(() => db.delete(users).where(eq(users.id, user.id)));

    expect(error.code).toBe(PgCode.foreignKeyViolation);
  });

  it('rejects a session for a user that does not exist', async () => {
    const error = await expectPgError(() => insertSession(randomUUID()));
    expect(error.code).toBe(PgCode.foreignKeyViolation);
  });
});

describe('refresh_tokens', () => {
  async function setup() {
    const user = await createUser(db);
    return { user, session: await insertSession(user.id) };
  }

  it('links to a session and starts unused', async () => {
    const { session } = await setup();
    const token = only(
      await db
        .insert(refreshTokens)
        .values({ sessionId: session.id, tokenHash: HASH, expiresAt: inOneHour() })
        .returning(),
    );

    expect(token.usedAt).toBeNull();
    expect(token.sessionId).toBe(session.id);
  });

  it('never stores the same token hash twice', async () => {
    const { session } = await setup();
    const values = { sessionId: session.id, tokenHash: HASH, expiresAt: inOneHour() };
    await db.insert(refreshTokens).values(values);

    const error = await expectPgError(() => db.insert(refreshTokens).values(values));

    expect(error).toEqual({
      code: PgCode.uniqueViolation,
      constraint: 'refresh_tokens_token_hash_uidx',
    });
  });

  it('rejects a value that is not a SHA-256 hex digest (so a raw token cannot be stored by mistake)', async () => {
    const { session } = await setup();
    const error = await expectPgError(() =>
      db.insert(refreshTokens).values({
        sessionId: session.id,
        tokenHash: 'raw-token-abcdefghijklmnopqrstuvwxyz0123456789ABCDEF',
        expiresAt: inOneHour(),
      }),
    );
    expect(error.constraint).toBe('refresh_tokens_token_hash_format');
  });

  it('rejects tokens for a session that does not exist, and blocks deleting a session that has tokens', async () => {
    const { session } = await setup();
    const orphan = await expectPgError(() =>
      db
        .insert(refreshTokens)
        .values({ sessionId: randomUUID(), tokenHash: HASH, expiresAt: inOneHour() }),
    );
    expect(orphan.code).toBe(PgCode.foreignKeyViolation);

    await db
      .insert(refreshTokens)
      .values({ sessionId: session.id, tokenHash: HASH, expiresAt: inOneHour() });
    const blocked = await expectPgError(() =>
      db.delete(authSessions).where(eq(authSessions.id, session.id)),
    );
    expect(blocked.code).toBe(PgCode.foreignKeyViolation);
  });

  it('must expire after it is created', async () => {
    const { session } = await setup();
    const error = await expectPgError(() =>
      db.insert(refreshTokens).values({
        sessionId: session.id,
        tokenHash: HASH,
        expiresAt: new Date(Date.now() - 1000),
      }),
    );
    expect(error.constraint).toBe('refresh_tokens_expiry_after_creation');
  });
});
