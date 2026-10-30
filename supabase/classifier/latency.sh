#!/usr/bin/env bash
# Spec #8 AC8 (job 32a): the classifier stays as fast as before. Times public.classify_item against
# main's classifier from before job 32a (copied below verbatim from 20261022233800_classifier_stores
# .sql, as temp functions), each word of wordlist.tsv in turn, alternating, 5 rounds, on the same
# database in the same session, and prints p50/p95/max per classifier. Exits 1 when the new p95 is
# more than 10% above the old one. With $GITHUB_STEP_SUMMARY set (CI), the table goes to the job
# summary too. No network calls either way: both run inside Postgres.
# CLASSIFIER_PSQL="psql -h ... -d ..." runs it against another database (default: the local stack).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
project_id="$(sed -n 's/^project_id = "\(.*\)"$/\1/p' "$here/../config.toml")"
db() {
  if [[ -n ${CLASSIFIER_PSQL:-} ]]; then $CLASSIFIER_PSQL "$@"; else docker exec -i "supabase_db_$project_id" psql -U postgres "$@"; fi
}
words="$(grep -v '^#' "$here/wordlist.tsv" | cut -f1 | grep . | python3 -I -c 'import sys, json; print(json.dumps([l.strip() for l in sys.stdin]))')"
result="$(db -v ON_ERROR_STOP=1 -At -F $'\t' <<SQL
begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f7', 'latency@example.com');
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f7", "role": "authenticated"}', true);
create temp table h as select id from public.create_household('Latency');
create temp table words as select json_array_elements_text(\$w\$$words\$w\$::json) as word;
-- The classifier before job 32a, verbatim but for the pg_temp names (classify_item from
-- 20261022233800_classifier_stores.sql, dictionary_category from the same file).
create function pg_temp.dictionary_category_main(p_key text) returns text
language sql stable as \$\$
  with words as (
    select w, ord from unnest(string_to_array(p_key, ' ')) with ordinality as t (w, ord) where w <> ''
  ),
  hits as (
    select d.category, 5 as tier, char_length(d.key) as len, 0::bigint as ord
    from public.classifier_terms d
    where d.key like '% %' and ' ' || p_key || ' ' like '% ' || d.key || ' %'
    union all
    select d.category, 4, char_length(d.key), 0
    from public.classifier_terms d
    where d.key = p_key
    union all
    select 'frozen', 3, 0, w.ord
    from words w
    where w.w = 'tk' or w.w like 'tiefkuhl%' or w.w like 'tiefgekuhl%' or w.w like 'gefror%'
    union all
    select d.category, 2, char_length(d.key), w.ord
    from words w join public.classifier_terms d
      on d.key not like '% %'
     and (w.w = d.key or (char_length(d.key) >= 3 and w.w like '%' || d.key))
    union all
    select d.category, 1, char_length(d.key), w.ord
    from words w join public.classifier_terms d
      on d.key not like '% %' and char_length(d.key) >= 4 and w.w like d.key || '%'
  )
  select category from hits order by tier desc, len desc, ord desc, category limit 1;
\$\$;
create function pg_temp.classify_item_main(p_household uuid, p_name text) returns uuid
language plpgsql stable as \$\$
declare
  v_key text := public.item_key(p_name);
  v_learned uuid;
  v_seed text;
begin
  if auth.uid() is not null and not public.is_household_member(p_household) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  select m.category_id into v_learned
  from public.category_memory m
  where m.household_id = p_household and m.item_key = v_key
  order by m.updated_at desc, m.corrections desc
  limit 1;
  if v_learned is not null then
    return v_learned;
  end if;
  v_seed := pg_temp.dictionary_category_main(v_key);
  return coalesce(
    (select c.id from public.categories c
     where c.household_id = p_household and v_seed is not null
       and (c.seed_key = v_seed or v_seed = any (c.absorbed_seed_keys))
     order by c.seed_key = v_seed desc
     limit 1),
    (select c.id from public.categories c where c.household_id = p_household and c.seed_key = 'other')
  );
end \$\$;
create temp table timings (classifier text, ms double precision);
do \$\$
declare
  v_word text;
  v_at timestamptz;
  v_category uuid;
  v_household uuid := (select id from h);
begin
  for round in 1..5 loop
    foreach v_word in array (select array_agg(word) from words) loop
      v_at := clock_timestamp();
      v_category := pg_temp.classify_item_main(v_household, v_word);
      insert into timings values ('before 32a', extract(epoch from clock_timestamp() - v_at) * 1000);
      v_at := clock_timestamp();
      v_category := public.classify_item(v_household, v_word);
      insert into timings values ('job 32a', extract(epoch from clock_timestamp() - v_at) * 1000);
    end loop;
  end loop;
end \$\$;
select classifier, count(*),
  round(percentile_cont(0.5) within group (order by ms)::numeric, 3),
  round(percentile_cont(0.95) within group (order by ms)::numeric, 3),
  round(max(ms)::numeric, 3)
from timings group by classifier order by classifier desc;
rollback;
SQL
)"
report="$(awk -F'\t' '
  NF == 5 { n[$1] = $2; p50[$1] = $3; p95[$1] = $4; mx[$1] = $5; order[++k] = $1 }
  END {
    print "Classifier latency per call (ms), wordlist.tsv x 5 rounds, alternating, same session"
    printf "  %-11s %6s %8s %8s %8s\n", "classifier", "calls", "p50", "p95", "max"
    for (i = 1; i <= k; i++) { c = order[i]; printf "  %-11s %6d %8.3f %8.3f %8.3f\n", c, n[c], p50[c], p95[c], mx[c] }
    old = p95["before 32a"]; new = p95["job 32a"]
    printf "p95: job 32a %.3f ms vs before %.3f ms (%+.0f%%, limit +10%%)\n", new, old, 100 * (new - old) / old
    if (new > 1.10 * old) exit 1
  }' <<<"$result")" && status=0 || status=$?
echo "$report"
if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
  { echo '### Classifier latency (AC8)'; echo; echo '~~~'; echo "$report"; echo '~~~'; } >>"$GITHUB_STEP_SUMMARY"
fi
exit "$status"
