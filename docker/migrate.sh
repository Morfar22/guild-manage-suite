#!/bin/sh
set -eu

# Keep application migration history outside the exposed public schema.
psql -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS guildos_local;
CREATE TABLE IF NOT EXISTS guildos_local.schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

for migration in /migrations/*.sql; do
  filename="$(basename "$migration")"
  applied="$(psql -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM guildos_local.schema_migrations WHERE filename = '$filename'")"
  if [ "$applied" = "0" ]; then
    echo "Applying $filename"
    psql -v ON_ERROR_STOP=1 --single-transaction -f "$migration" \
      -c "INSERT INTO guildos_local.schema_migrations(filename) VALUES ('$filename')"
  fi
done

# Tell PostgREST to discover all migrated tables without waiting for a restart.
psql -v ON_ERROR_STOP=1 -c "NOTIFY pgrst, 'reload schema'"
