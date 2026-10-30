#!/usr/bin/env bash
# Spec #8 AC4 (job 32a): classifies every row of wordlist.tsv on the local stack and prints the
# rows it gets wrong and the rates: correct per kind, misspellings right, and false matches (a row
# put in a category that is neither the expected one nor "other"). Exits 1 when misspellings are
# under 90% right or false matches reach 1% of all rows. With $GITHUB_STEP_SUMMARY set (CI), the
# rates also go to the job summary.
# CLASSIFIER_PSQL="psql -h ... -d ..." runs it against another database (default: the local stack).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
project_id="$(sed -n 's/^project_id = "\(.*\)"$/\1/p' "$here/../config.toml")"
db() {
  if [[ -n ${CLASSIFIER_PSQL:-} ]]; then $CLASSIFIER_PSQL "$@"; else docker exec -i "supabase_db_$project_id" psql -U postgres "$@"; fi
}
rows="$(grep -v '^#' "$here/wordlist.tsv" | python3 -I -c 'import sys, json; print(json.dumps([l.rstrip("\n").split("\t") for l in sys.stdin if l.strip()]))')"
result="$(db -v ON_ERROR_STOP=1 -At -F $'\t' <<SQL
begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f8', 'wordlist@example.com');
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f8", "role": "authenticated"}', true);
create temp table h as select id from public.create_household('Wordlist');
select 'row', r->>0, r->>1, r->>2, c.seed_key, d.via
from json_array_elements(\$rows\$$rows\$rows\$::json) with ordinality t(r, n)
cross join lateral public.classify_item_detail((select id from h), r->>0) d
join public.categories c on c.id = d.category_id
order by n;
rollback;
SQL
)"
report="$(awk -F'\t' '
  $1 == "row" {
    total++; kind[$4]++
    if ($5 == $3) right[$4]++
    else {
      if ($5 != "other") { wrong++; tag = "FALSE MATCH" } else tag = "miss"
      misses = misses sprintf("  %-11s %s: expected %s, got %s (%s)\n", tag, $2, $3, $5, $6)
    }
  }
  END {
    printf "Classifier word list (supabase/classifier/wordlist.tsv), %d rows\n", total
    split("word misspelling variant negative", kinds, " ")
    for (i = 1; i <= 4; i++) { k = kinds[i]; printf "  %-12s %3d/%3d right (%.1f%%)\n", k, right[k], kind[k], 100 * right[k] / kind[k] }
    printf "Misspellings classified right: %.1f%% (target >= 90%%)\n", 100 * right["misspelling"] / kind["misspelling"]
    printf "False-match rate: %d/%d = %.2f%% (target < 1%%)\n", wrong, total, 100 * wrong / total
    printf "%s", misses
    if (right["misspelling"] < 0.9 * kind["misspelling"] || wrong >= 0.01 * total) exit 1
  }' <<<"$result")" && status=0 || status=$?
echo "$report"
if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
  { echo '### Classifier word list (AC4)'; echo; echo '~~~'; echo "$report"; echo '~~~'; } >>"$GITHUB_STEP_SUMMARY"
fi
exit "$status"
