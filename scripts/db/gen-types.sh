#!/bin/sh
# Regenerates types/supabase.ts from the local Supabase stack (run after adding a migration).
set -eu
cd "$(dirname "$0")/../.."
supabase gen types typescript --local --schema public > types/supabase.ts
pnpm exec prettier --write types/supabase.ts > /dev/null
echo "types/supabase.ts regenerated"
