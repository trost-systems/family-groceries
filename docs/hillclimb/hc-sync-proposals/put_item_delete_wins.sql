-- NEEDS_LEAD proposal from job 99 (hc-sync). Not a live migration: it lives here, not under
-- supabase/migrations, and nothing in the app calls it yet.
--
-- A delete wins over a replayed add. An add whose first answer was lost (the phone dropped off
-- the network after the server inserted the row) is retried by the app with the same id. If a
-- partner deleted the item in between, put_item finds no row and inserts it again: the delete is
-- undone for everyone (FUZZ_STRICT=1, 6 of seeds 1..1000; repro seed 44 in three steps). Only
-- the server can tell "never landed" from "landed and was deleted": item_events logs every
-- delete with the item id.
--
-- This overload takes p_restored (the app's AddItem.restored, the delete's undo). Without a
-- default, so PostgREST never has two candidates: today's apps send 11 arguments and keep the
-- old function; an app that sends p_restored gets this one. A plain add of a deleted id answers
-- no row, which the app already acknowledges as "gone" (SupabaseListRepository._add). The undo
-- of a delete passes p_restored = true and inserts as before.
--
-- To ship: copy to supabase/migrations/<timestamp>_put_item_delete_wins.sql, add a pgTAP case
-- (plain add of a deleted id: no row; restored: the row), and in the same PR send
-- 'p_restored': op.restored from SupabaseListRepository._add. The app change must not reach a
-- store build before this migration is deployed (PGRST202 otherwise).

create function public.put_item(
  p_id uuid,
  p_household uuid,
  p_name text,
  p_quantity text,
  p_brand text,
  p_properties text,
  p_category uuid,
  p_store uuid,
  p_sort_key double precision,
  p_status text,
  p_no_store boolean,
  p_restored boolean
) returns setof public.items
language plpgsql set search_path = '' as $$
begin
  if not p_restored
     and not exists (select from public.items where id = p_id)
     and exists (
       select from public.item_events e
       where e.household_id = p_household and e.item_id = p_id and e.action = 'deleted'
     ) then
    return;
  end if;
  return query select * from public.put_item(
    p_id, p_household, p_name, p_quantity, p_brand, p_properties, p_category, p_store,
    p_sort_key, p_status, p_no_store
  );
end $$;

revoke execute on function public.put_item(
  uuid, uuid, text, text, text, text, uuid, uuid, double precision, text, boolean, boolean
) from public, anon;
grant execute on function public.put_item(
  uuid, uuid, text, text, text, text, uuid, uuid, double precision, text, boolean, boolean
) to authenticated;
