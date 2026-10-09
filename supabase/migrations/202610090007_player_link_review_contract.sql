-- Deploy this database contract before the matching portal API.
-- This repair works even when migration 006 was not applied to the live project.
create or replace function public.review_player_link_v2(p_request_id uuid,p_approve boolean)
returns void language plpgsql security definer set search_path='' as $$
declare r public.player_link_requests; v_league uuid;
begin
  select league_id into v_league from public.player_link_requests where id=p_request_id;
  perform 1 from public.leagues where id=v_league for share;
  if not found then raise exception using errcode='P0002',message='Link request not found.'; end if;
  perform public.lock_league_access(v_league,array['owner','admin']);
  select * into r from public.player_link_requests where id=p_request_id for update;
  if not found then raise exception using errcode='P0002',message='Link request not found.'; end if;
  if r.status<>'pending' then raise exception using errcode='40001',message='This request has already been reviewed.'; end if;
  if p_approve is null then raise exception using errcode='22023',message='Choose approve or reject.'; end if;
  perform 1 from public.users where id=r.user_id for update;
  if p_approve then
    insert into public.player_links(league_id,user_id,player_id) values(r.league_id,r.user_id,r.player_id);
  end if;
  update public.player_link_requests set status=case when p_approve then 'approved' else 'rejected' end,
    reviewed_at=now(),reviewed_by=auth.uid() where id=r.id;
end;
$$;

-- Keep existing clients on the same authorization and self-review rules.
create or replace function public.review_player_link(p_request_id uuid,p_approve boolean)
returns void language sql security definer set search_path='' as $$
  select public.review_player_link_v2(p_request_id,p_approve);
$$;

revoke all on function public.review_player_link_v2(uuid,boolean),public.review_player_link(uuid,boolean) from public,anon,authenticated;
grant execute on function public.review_player_link_v2(uuid,boolean),public.review_player_link(uuid,boolean) to authenticated,service_role;
notify pgrst, 'reload schema';
