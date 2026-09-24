-- Reuses the set_updated_at() function created in 0002 for the new tables.
-- payment_ledger_entries is an immutable log (no updated_at column), so it
-- gets no trigger.
CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON "payments"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER provider_payouts_set_updated_at BEFORE UPDATE ON "provider_payouts"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
