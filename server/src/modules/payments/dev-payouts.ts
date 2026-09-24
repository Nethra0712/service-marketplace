// DEVELOPMENT-ONLY CLI: `npm run dev:payouts -- <command> ...`
//
// There is no scheduler anywhere in this codebase and payout execution (the
// actual bank transfer) is a manual, admin-side step in V1 — see
// `payments.service.ts`'s doc comment. This stands in for that admin
// tooling while developing: it calculates a period's payouts and marks one
// paid once the transfer has actually been made outside this app. Refuses
// to run in production.
//
//   npm run dev:payouts -- calculate 2026-09-14T00:00:00Z 2026-09-21T00:00:00Z
//   npm run dev:payouts -- list <providerProfileId>
//   npm run dev:payouts -- pay <payoutId> [note]
import '../../config/dotenv.js';

import { loadDatabaseEnv } from '../../config/env.js';
import { createDatabase } from '../../db/client.js';
import { systemClock } from '../../lib/clock.js';
import { assertDevelopmentOnly } from '../../lib/dev-only.js';
import { createLogger } from '../../lib/logger.js';
import { createPaymentsService } from './payments.service.js';
import { MockPaymentProvider } from './mock-payment-provider.js';

const USAGE = `Usage:
  npm run dev:payouts -- calculate <periodStartISO> <periodEndISO>
  npm run dev:payouts -- list <providerProfileId>
  npm run dev:payouts -- pay <payoutId> [note]`;

const config = loadDatabaseEnv();
assertDevelopmentOnly(config.nodeEnv, 'the dev payouts script');

const [command, ...rest] = process.argv.slice(2);
if (!command) {
  console.error(USAGE);
  process.exit(1);
}

const handle = createDatabase(config.databaseUrl);
const logger = createLogger({ logLevel: 'silent' });
// A real gateway is never contacted by this script: `calculate` only reads
// already-succeeded payments, and `pay` only records that a transfer already
// happened elsewhere. The provider instance here exists solely to satisfy
// the service's dependency; it neither creates checkouts nor refunds anything.
const payments = createPaymentsService({
  db: handle.db,
  clock: systemClock,
  provider: new MockPaymentProvider(logger),
  commissionBasisPoints: 0, // Unused by `calculate`/`pay`: they read stored, already-computed amounts.
  publicApiBaseUrl: 'http://localhost',
});

try {
  if (command === 'calculate') {
    const [startIso, endIso] = rest;
    if (!startIso || !endIso) throw new Error(USAGE);
    const periodStart = new Date(startIso);
    const periodEnd = new Date(endIso);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      throw new Error('Both dates must be valid ISO timestamps.');
    }
    const payouts = await payments.calculatePayoutsForPeriod(periodStart, periodEnd);
    if (payouts.length === 0) {
      console.log('No succeeded, unpaid-out payments in that period.');
    }
    for (const p of payouts) {
      console.log(
        `${p.providerProfileId}: LKR ${p.totalProviderEarningAmount} payable ` +
          `(${p.paymentCount} payment(s), status=${p.status}) [payout ${p.id}]`,
      );
    }
  } else if (command === 'list') {
    const [providerProfileId] = rest;
    if (!providerProfileId) throw new Error(USAGE);
    const payouts = await payments.listPayoutsForProvider(providerProfileId);
    if (payouts.length === 0) console.log('No payouts for that provider yet.');
    for (const p of payouts) {
      console.log(
        `${p.periodStart} - ${p.periodEnd}: LKR ${p.totalProviderEarningAmount} ` +
          `(${p.status}${p.paidAt ? `, paid ${p.paidAt}` : ''}) [${p.id}]`,
      );
    }
  } else if (command === 'pay') {
    const [payoutId, ...note] = rest;
    if (!payoutId) throw new Error(USAGE);
    const payout = await payments.markPayoutPaid(payoutId, note.join(' ') || null);
    console.log(`Payout ${payout.id} marked paid.`);
  } else {
    throw new Error(USAGE);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await handle.close();
}
