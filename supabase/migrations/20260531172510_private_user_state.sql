-- Private user state contract (F-02)
--
-- Creates per-user climb log and projects tables anchored to Strapi catalog
-- routes by `route_id text` (Strapi `documentId`). No foreign key or CHECK
-- constraint links `route_id` back to Strapi — the catalog lives in an
-- external store and integrity is enforced at the app boundary via
-- `@/lib/private-state`'s route-id validation against `@/lib/catalog`.
--
-- Privacy boundary: row-level security is enabled on both tables BEFORE any
-- per-operation policy is created so a non-superuser role can never write
-- against a wide-open table. Per-operation policies are granted only to the
-- `authenticated` role, every one scoped to `auth.uid() = user_id`. The
-- `anon` role is denied by default (no explicit policies).

-- ---------------------------------------------------------------------------
-- climbs: many rows allowed per (user_id, route_id) — same route can be
-- climbed many times.
-- ---------------------------------------------------------------------------

create table public.climbs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  route_id text not null,
  climbed_on date not null,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.climbs is
  'Per-user climb log entries (F-02). Anchored to Strapi catalog routes by route_id (documentId). RLS-scoped to auth.uid().';
comment on column public.climbs.route_id is
  'Strapi catalog route documentId. No FK; integrity enforced at the app boundary by @/lib/private-state.';

-- FR-010 history page: order by date desc, with created_at as a stable
-- secondary sort for same-day climbs.
create index climbs_user_id_climbed_on_created_at_idx
  on public.climbs (user_id, climbed_on desc, created_at desc);

-- Per-route "have I climbed this?" lookups for S-04.
create index climbs_route_id_idx on public.climbs (route_id);

-- ---------------------------------------------------------------------------
-- projects: a route is either on a climber's projects list or not.
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  route_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, route_id)
);

comment on table public.projects is
  'Per-user projects list (F-02). Anchored to Strapi catalog routes by route_id (documentId). RLS-scoped to auth.uid().';
comment on column public.projects.route_id is
  'Strapi catalog route documentId. No FK; integrity enforced at the app boundary by @/lib/private-state.';

-- FR-013 projects list: order by created_at desc.
create index projects_user_id_created_at_idx
  on public.projects (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- RLS is enabled FIRST, then per-operation policies are granted to the
-- `authenticated` role. No grants to `anon` — RLS denies anonymous access by
-- default once enabled.
-- ---------------------------------------------------------------------------

alter table public.climbs enable row level security;
alter table public.projects enable row level security;

-- climbs: per-operation policies for the authenticated role
create policy "climbs_select_own"
  on public.climbs
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "climbs_insert_own"
  on public.climbs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "climbs_update_own"
  on public.climbs
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "climbs_delete_own"
  on public.climbs
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- projects: per-operation policies for the authenticated role
create policy "projects_select_own"
  on public.projects
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "projects_insert_own"
  on public.projects
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "projects_update_own"
  on public.projects
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "projects_delete_own"
  on public.projects
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance for climbs
--
-- A single before-update trigger function in the `public` schema refreshes
-- `updated_at` to now() on every row update. Not attached to projects — that
-- table has no `updated_at` column (immutable after insert, deletes only).
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
  returns trigger
  language plpgsql
  as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger function: refreshes updated_at to now() before each row update.';

create trigger climbs_set_updated_at
  before update on public.climbs
  for each row
  execute function public.set_updated_at();
