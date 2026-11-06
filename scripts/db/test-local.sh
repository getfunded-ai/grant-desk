#!/bin/sh
# Runs the migration and row-level-security tests against the local Supabase stack instead of PGlite.
# Needs `supabase start`. Resets the local database first so every migration applies from empty.
# Local only: the harness refuses any database that is not on this machine.
set -eu
cd "$(dirname "$0")/../.."
supabase db reset --local
TEST_DATABASE_URL="$(supabase status -o env 2>/dev/null | sed -n 's/^DB_URL="\(.*\)"$/\1/p')"
if [ -z "$TEST_DATABASE_URL" ]; then
  echo "The local Supabase stack is not running. Start it with: supabase start" >&2
  exit 1
fi
export TEST_DATABASE_URL
exec pnpm exec vitest run tests "$@"
