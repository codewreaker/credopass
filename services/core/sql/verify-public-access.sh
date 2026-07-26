#!/usr/bin/env bash
# Probes every table through PostgREST with the PUBLIC anon key.
#
# Before 001_revoke_public_data_access.sql : every table answers 200 with rows.
# After                                    : every table answers 401, or 200 with
#                                            an empty array (RLS on, no policy).
#
# Usage: services/core/sql/verify-public-access.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
set -a; . "$ROOT/apps/web/.env"; set +a

: "${VITE_SUPABASE_URL:?}" "${VITE_SUPABASE_ANON_KEY:?}"

echo "Probing $VITE_SUPABASE_URL with the public anon key"
printf '%-18s %-6s %s\n' TABLE HTTP ROWS

exposed=0
for t in organizations users events event_members org_memberships attendance loyalty; do
  body=$(curl -s "$VITE_SUPABASE_URL/rest/v1/$t?select=*&limit=1" \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
    -w '\n%{http_code}')
  code="${body##*$'\n'}"
  json="${body%$'\n'*}"

  if [ "$code" = "200" ] && [ "$json" != "[]" ]; then
    rows="EXPOSED"; exposed=$((exposed + 1))
  else
    rows="ok"
  fi
  printf '%-18s %-6s %s\n' "$t" "$code" "$rows"
done

echo
if [ "$exposed" -gt 0 ]; then
  echo "FAIL: $exposed table(s) readable with the public key."
  echo "      Apply services/core/sql/001_revoke_public_data_access.sql"
  exit 1
fi
echo "PASS: no table returns data to the public key."
