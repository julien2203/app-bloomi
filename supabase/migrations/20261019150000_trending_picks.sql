-- Sélection éditoriale du rail Tendances.
-- L'admin épingle jusqu'à 10 annonces publiées (ordre + fin optionnelle).
-- L'app mobile les place devant le score automatique.
-- La fenêtre de 7 jours du score ne s'applique pas à ces pins.

begin;

create table if not exists public.trending_picks (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  "position" smallint not null,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint trending_picks_position_range check ("position" between 1 and 10),
  constraint trending_picks_position_unique unique ("position")
);

comment on table public.trending_picks is
  'Annonces épinglées en tête du rail Tendances. Géré depuis l’admin app. Max 10, une position chacune.';

comment on column public.trending_picks.ends_at is
  'Fin d’affichage. Null = sans date de fin. La fenêtre de 7 jours du score tendance ne s’applique pas.';

alter table public.trending_picks enable row level security;

drop policy if exists "Anyone can read active trending picks" on public.trending_picks;
create policy "Anyone can read active trending picks"
  on public.trending_picks
  for select
  to anon, authenticated
  using (
    (ends_at is null or ends_at > now())
    and exists (
      select 1
      from public.listings l
      where l.id = trending_picks.listing_id
        and l.status = 'published'
    )
  );

drop policy if exists "Admins can read all trending picks" on public.trending_picks;
create policy "Admins can read all trending picks"
  on public.trending_picks
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can insert trending picks" on public.trending_picks;
create policy "Admins can insert trending picks"
  on public.trending_picks
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update trending picks" on public.trending_picks;
create policy "Admins can update trending picks"
  on public.trending_picks
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete trending picks" on public.trending_picks;
create policy "Admins can delete trending picks"
  on public.trending_picks
  for delete
  to authenticated
  using (public.is_admin());

grant select on public.trending_picks to anon, authenticated;
grant insert, update, delete on public.trending_picks to authenticated;

-- Liste admin : annonces publiées, tri likes puis vues.
create or replace function public.admin_list_trending_candidates(
  p_search text default null,
  p_limit int default 40,
  p_offset int default 0
)
returns table (
  id uuid,
  title text,
  price numeric,
  brand text,
  status text,
  views_count int,
  likes_count int,
  published_at timestamptz,
  seller_display_name text,
  cover_photo_url text,
  is_pinned boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_limit int := least(greatest(coalesce(p_limit, 40), 1), 100);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_pattern text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_pattern is not null then
    v_pattern := replace(replace(replace(v_pattern, '\', '\\'), '%', '\%'), '_', '\_');
  end if;

  return query
  with like_counts as (
    select lk.listing_id, count(*)::int as likes_count
    from public.likes lk
    group by lk.listing_id
  ),
  ranked as (
    select
      l.id,
      l.title,
      l.price,
      l.brand,
      l.status::text as status,
      coalesce(l.views_count, 0)::int as views_count,
      coalesce(lc.likes_count, 0)::int as likes_count,
      l.published_at,
      coalesce(
        nullif(btrim(p.display_name), ''),
        nullif(btrim(p.company_name), '')
      ) as seller_display_name,
      exists (
        select 1 from public.trending_picks tp where tp.listing_id = l.id
      ) as is_pinned
    from public.listings l
    join public.profiles p on p.id = l.seller_id
    left join like_counts lc on lc.listing_id = l.id
    where l.status = 'published'
      and (
        v_pattern is null
        or l.title ilike '%' || v_pattern || '%' escape '\'
        or coalesce(l.brand, '') ilike '%' || v_pattern || '%' escape '\'
        or coalesce(p.display_name, '') ilike '%' || v_pattern || '%' escape '\'
        or coalesce(p.company_name, '') ilike '%' || v_pattern || '%' escape '\'
      )
    order by coalesce(lc.likes_count, 0) desc, coalesce(l.views_count, 0) desc, l.published_at desc nulls last, l.id
    limit v_limit
    offset v_offset
  )
  select
    r.id,
    r.title,
    r.price,
    r.brand,
    r.status,
    r.views_count,
    r.likes_count,
    r.published_at,
    r.seller_display_name,
    lp_cover.url as cover_photo_url,
    r.is_pinned
  from ranked r
  left join lateral (
    select lp.url
    from public.listing_photos lp
    where lp.listing_id = r.id
    order by lp.order_index asc, lp.created_at asc, lp.id asc
    limit 1
  ) lp_cover on true
  order by r.likes_count desc, r.views_count desc, r.published_at desc nulls last, r.id;
end;
$$;

comment on function public.admin_list_trending_candidates(text, int, int) is
  'Admin only: annonces publiées triées par likes puis vues, pour choisir le rail Tendances.';

revoke all on function public.admin_list_trending_candidates(text, int, int) from public;
grant execute on function public.admin_list_trending_candidates(text, int, int) to authenticated;

-- Pins actuels, y compris expirés ou annonce plus publiée (l’admin doit pouvoir les retirer).
create or replace function public.admin_list_trending_picks()
returns table (
  listing_id uuid,
  "position" smallint,
  ends_at timestamptz,
  title text,
  price numeric,
  brand text,
  status text,
  views_count int,
  likes_count int,
  published_at timestamptz,
  seller_display_name text,
  cover_photo_url text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    tp.listing_id,
    tp."position",
    tp.ends_at,
    l.title,
    l.price,
    l.brand,
    l.status::text as status,
    coalesce(l.views_count, 0)::int as views_count,
    coalesce((
      select count(*)::int from public.likes lk where lk.listing_id = l.id
    ), 0)::int as likes_count,
    l.published_at,
    coalesce(
      nullif(btrim(p.display_name), ''),
      nullif(btrim(p.company_name), '')
    ) as seller_display_name,
    lp_cover.url as cover_photo_url
  from public.trending_picks tp
  join public.listings l on l.id = tp.listing_id
  join public.profiles p on p.id = l.seller_id
  left join lateral (
    select lp.url
    from public.listing_photos lp
    where lp.listing_id = l.id
    order by lp.order_index asc, lp.created_at asc, lp.id asc
    limit 1
  ) lp_cover on true
  order by tp."position" asc;
end;
$$;

comment on function public.admin_list_trending_picks() is
  'Admin only: sélection Tendances actuelle, ordre des positions.';

revoke all on function public.admin_list_trending_picks() from public;
grant execute on function public.admin_list_trending_picks() to authenticated;

-- Remplace toute la sélection. Tableau vide = tout retirer.
-- Élément : {"listing_id":"<uuid>","position":1,"ends_at":null}
create or replace function public.admin_replace_trending_picks(p_picks jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_picks is null or jsonb_typeof(p_picks) <> 'array' then
    raise exception 'invalid_payload';
  end if;

  if jsonb_array_length(p_picks) > 10 then
    raise exception 'too_many_picks';
  end if;

  drop table if exists _trending_picks_in;
  create temp table _trending_picks_in (
    listing_id uuid,
    "position" int,
    ends_at timestamptz
  ) on commit drop;

  begin
    insert into _trending_picks_in (listing_id, "position", ends_at)
    select
      (elem->>'listing_id')::uuid,
      (elem->>'position')::int,
      case
        when elem->>'ends_at' is null or btrim(elem->>'ends_at') = '' then null
        else (elem->>'ends_at')::timestamptz
      end
    from jsonb_array_elements(p_picks) as elem;
  exception
    when invalid_text_representation or datetime_field_overflow then
      raise exception 'invalid_payload';
  end;

  select count(*) into v_count from _trending_picks_in;

  if exists (
    select 1 from _trending_picks_in where listing_id is null or "position" is null
  ) then
    raise exception 'invalid_payload';
  end if;

  if exists (
    select 1 from _trending_picks_in where "position" < 1 or "position" > 10
  ) then
    raise exception 'invalid_position';
  end if;

  if (
    select count(distinct listing_id) from _trending_picks_in
  ) <> v_count then
    raise exception 'duplicate_listing';
  end if;

  if (
    select count(distinct "position") from _trending_picks_in
  ) <> v_count then
    raise exception 'duplicate_position';
  end if;

  if exists (
    select 1
    from _trending_picks_in i
    left join public.listings l on l.id = i.listing_id
    where l.id is null or l.status is distinct from 'published'
  ) then
    raise exception 'listing_not_published';
  end if;

  delete from public.trending_picks;

  insert into public.trending_picks (listing_id, "position", ends_at, updated_by)
  select listing_id, "position", ends_at, auth.uid()
  from _trending_picks_in;
end;
$$;

comment on function public.admin_replace_trending_picks(jsonb) is
  'Admin only: remplace la sélection Tendances (max 10 annonces publiées). [] vide tout.';

revoke all on function public.admin_replace_trending_picks(jsonb) from public;
grant execute on function public.admin_replace_trending_picks(jsonb) to authenticated;

commit;
