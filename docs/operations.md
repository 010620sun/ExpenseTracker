# GlobeLedger operations guide

This guide covers Cloudflare Workers and D1 operations for GlobeLedger. It is
intended for maintainers with access to the Cloudflare account used by
`wrangler.jsonc`.

## Safe deployment order

1. Review the generated migration and run the checks locally.
2. Capture a D1 Time Travel bookmark before altering production data.
3. Apply the remote migration.
4. Confirm data counts and foreign-key integrity.
5. Deploy the Worker.

```bash
npm run lint
npm test
npm run db:generate
npx wrangler d1 time-travel info globeledger-db --json
npm run db:migrate:remote
npm run deploy
```

## Migration rules

`user_states` is the parent table for transactions, budgets, recurring series,
and recurring exceptions. Do not replace, drop, or rename this table in a
production migration. Its child tables use cascading foreign keys.

For an additive nullable field, use `ALTER TABLE ... ADD COLUMN` rather than a
table rebuild. For example:

```sql
ALTER TABLE `user_states`
ADD COLUMN `example_at_ms` integer;
```

Before applying any migration, inspect it for `DROP TABLE`, a temporary
replacement table, or an altered foreign-key relationship. Treat any of those
as a data-risking change that needs a reviewed backup and explicit recovery
plan.

## Post-migration verification

Use read-only counts for the ledger tables that matter to members:

```bash
npx wrangler d1 execute globeledger-db --remote --command "SELECT (SELECT COUNT(*) FROM members) AS members, (SELECT COUNT(*) FROM transactions) AS transactions, (SELECT COUNT(*) FROM monthly_budgets) AS monthly_budgets, (SELECT COUNT(*) FROM recurring_series) AS recurring_series, (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_violations;"
```

The expected value for `foreign_key_violations` is `0`.

## D1 recovery

Cloudflare D1 Time Travel can restore the database to a previous bookmark or a
timestamp within its retention window. Restoring rewinds the whole database,
including sessions and migration history, so use it only after identifying the
target point and with explicit authorization.

```bash
# Find a bookmark for a known safe moment
npx wrangler d1 time-travel info globeledger-db --timestamp 2026-09-01T08:45:00Z --json

# Destructive: restores the entire database to that bookmark
npx wrangler d1 time-travel restore globeledger-db --bookmark <bookmark>
```

After a restore, verify the ledger counts, apply only a reviewed safe migration
if the restored schema needs one, and then deploy the compatible Worker.
