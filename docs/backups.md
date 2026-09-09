# Backups

Use managed PostgreSQL/Supabase backups in production.

Recommended baseline:

- automatic daily backups
- 7–30 day retention
- point-in-time recovery when budget allows
- backup before every production migration
- restore test at least monthly and before first launch

## Manual backup

Example:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=scrapo-$(date +%Y%m%d).dump
```

Do not commit dumps. The repo ignores `*.dump`, `*.sql.gz`, and `backups/`.

## Restore test

Restore into an isolated database, never over production:

```bash
createdb scrapo_restore_test
pg_restore --dbname "$RESTORE_DATABASE_URL" scrapo-YYYYMMDD.dump
```

Verify:

- workspaces/users
- companies
- contacts
- leads
- outreach messages
- replies
- automation settings/runs
- integration connection records without exposing credentials
