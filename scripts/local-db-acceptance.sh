#!/usr/bin/env bash
# Local-only database acceptance for SQL changes (first used for #341).
#
# Builds a DISPOSABLE Supabase Postgres from this repo (schema.sql -> phase-*.sql ->
# supabase/migrations/*.sql) inside a throwaway Docker container, then runs one acceptance file
# against it. Nothing here connects to production, reads secrets or publishes anything.
#
#   scripts/local-db-acceptance.sh [tests/sql/<file>.sql]
#
# Requires Docker. On an empty database a handful of repo scripts are expected to fail (data
# backfills that look up real clients, and scripts that need the storage schema); they are
# reported but do not stop the run. The acceptance file itself must pass completely.
set -euo pipefail

IMAGE="${CG_LOCAL_PG_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.159}"
NAME="${CG_LOCAL_PG_NAME:-cg-local-acceptance}"
ACCEPTANCE="${1:-tests/sql/341_client_workspace_acceptance.sql}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export MSYS_NO_PATHCONV=1

[ -f "$ROOT/$ACCEPTANCE" ] || { echo "No acceptance file at $ACCEPTANCE" >&2; exit 2; }

docker rm -f "$NAME" > /dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres -v "$ROOT/supabase:/sb:ro" -v "$ROOT/tests/sql:/acceptance:ro" "$IMAGE" > /dev/null
trap 'docker rm -f "$NAME" > /dev/null 2>&1 || true' EXIT
# The Supabase image restarts Postgres once after its init scripts, so a single successful
# pg_isready is not enough: early scripts would fail on a dropped connection. Wait for five
# consecutive successful queries instead.
docker exec "$NAME" bash -c 'ok=0; for i in $(seq 1 240); do if psql -U supabase_admin -d postgres -Atqc "select 1" > /dev/null 2>&1; then ok=$((ok + 1)); [ "$ok" -ge 5 ] && exit 0; else ok=0; fi; sleep 1; done; exit 1'

docker exec -e PGOPTIONS='-c search_path=public,extensions' "$NAME" bash -c '
  PSQL="psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q"
  failures=0
  run() {
    if ! $PSQL -f "$1" > /tmp/out.txt 2>&1; then
      failures=$((failures + 1))
      echo "  expected-on-empty-db failure: $(basename "$1") :: $(grep -m1 ERROR /tmp/out.txt | cut -c1-160)"
    fi
  }
  run /sb/schema.sql
  for f in $(ls /sb/phase-*.sql | sort -V); do run "$f"; done
  for f in $(ls /sb/migrations/*.sql | sort); do run "$f"; done
  echo "repo SQL applied ($failures scripts failed on the empty database)"
'

docker exec -e PGOPTIONS='-c search_path=public,extensions' "$NAME" \
  psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f "/acceptance/$(basename "$ACCEPTANCE")"
