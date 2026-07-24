-- Tetik: схема БД, RLS, полнотекстовый поиск, storage, автомодерация
-- Колонки в camelCase (в кавычках) — синхронно с фронтендом.

create extension if not exists pgcrypto;

/* ================= Таблицы ================= */

create table if not exists public.profiles (
  id uuid primary key,
  email text not null,
  "displayName" text not null default 'Пользователь',
  city text,
  phone text,
  whatsapp text,
  "photoURL" text,
  role text not null default 'user' check (role in ('user','admin')),
  lang text default 'ru',
  "createdAt" timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 5 and 120),
  "desc" text not null default '' check (char_length("desc") <= 2000),
  price integer not null check (price >= 0 and price < 100000000),
  currency text not null default 'KGS' check (currency = 'KGS'),
  category text not null check (category in ('engine','suspension','body','electrics','interior','brakes','wheels','oils','accessories','tools')),
  brand text not null default 'Другая',
  model text not null default '',
  year text default '',
  condition text not null default 'used' check (condition in ('new','used')),
  origin text check (origin in ('original','aftermarket')),
  city text not null default 'Бишкек',
  photos jsonb not null default '[]'::jsonb check (jsonb_array_length(photos) <= 8),
  "sellerId" uuid not null,
  "sellerName" text not null default 'Продавец',
  phone text not null default '',
  whatsapp text,
  status text not null default 'active' check (status in ('active','sold','archived','blocked')),
  "blockedReason" text,
  views integer not null default 0,
  "createdAt" timestamptz not null default now(),
  "bumpedAt" timestamptz not null default now(),
  fts tsvector generated always as (
    to_tsvector('russian',
      coalesce(title,'') || ' ' || coalesce("desc",'') || ' ' ||
      coalesce(brand,'') || ' ' || coalesce(model,'') || ' ' || coalesce(city,''))
  ) stored
);

create index if not exists listings_fts_idx on public.listings using gin (fts);
create index if not exists listings_status_bumped_idx on public.listings (status, "bumpedAt" desc);
create index if not exists listings_category_idx on public.listings (category) where status = 'active';
create index if not exists listings_brand_idx on public.listings (brand) where status = 'active';
create index if not exists listings_city_idx on public.listings (city) where status = 'active';
create index if not exists listings_seller_idx on public.listings ("sellerId", "createdAt" desc);

create table if not exists public.chats (
  id text primary key,
  type text not null check (type in ('group','dm')),
  title text not null default '',
  region text default '',
  topic text default '',
  members uuid[] not null default '{}',
  "memberNames" jsonb default '{}'::jsonb,
  "lastMsg" text,
  "lastMsgAt" timestamptz,
  "createdAt" timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  "chatId" text not null references public.chats(id) on delete cascade,
  "senderId" uuid not null,
  "senderName" text not null default '',
  text text not null check (char_length(text) between 1 and 2000),
  "imageUrl" text,
  "createdAt" timestamptz not null default now()
);

create index if not exists messages_chat_idx on public.messages ("chatId", "createdAt");

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  "desc" text not null default '',
  logo text,
  cover text,
  city text not null default 'Бишкек',
  address text,
  phone text not null default '',
  whatsapp text,
  verified boolean not null default false,
  "ownerUid" uuid not null,
  "createdAt" timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  "storeId" uuid not null references public.stores(id) on delete cascade,
  name text not null,
  price integer not null check (price >= 0),
  photos jsonb not null default '[]'::jsonb,
  category text,
  "inStock" boolean not null default true,
  "desc" text default ''
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  "storeId" uuid not null references public.stores(id) on delete cascade,
  "storeName" text not null default '',
  "buyerUid" uuid not null,
  "buyerName" text not null default '',
  phone text not null default '',
  items jsonb not null default '[]'::jsonb,
  total integer not null default 0,
  comment text,
  status text not null default 'new' check (status in ('new','confirmed','done','cancelled')),
  "createdAt" timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  "targetType" text not null check ("targetType" in ('listing','user','message')),
  "targetId" text not null,
  reason text not null check (char_length(reason) <= 500),
  "byUid" uuid not null,
  "createdAt" timestamptz not null default now()
);

/* ================= Триггеры-защитники ================= */

-- profiles: нельзя самому себе поднять роль
create or replace function public.guard_profile() returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and auth.role() <> 'service_role' then
    raise exception 'role change denied';
  end if;
  if new.id is distinct from old.id or new.email is distinct from old.email then
    raise exception 'immutable fields';
  end if;
  return new;
end $$;
drop trigger if exists guard_profile_t on public.profiles;
create trigger guard_profile_t before update on public.profiles
  for each row execute function public.guard_profile();

-- listings: заблокированное не разблокировать, владельца не менять
create or replace function public.guard_listing() returns trigger language plpgsql as $$
begin
  if auth.role() <> 'service_role' then
    if old.status = 'blocked' then
      raise exception 'listing is blocked';
    end if;
    if new.status = 'blocked' then
      raise exception 'status denied';
    end if;
    if new."sellerId" is distinct from old."sellerId" then
      raise exception 'immutable seller';
    end if;
    if new.views < old.views then
      raise exception 'views denied';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_listing_t on public.listings;
create trigger guard_listing_t before update on public.listings
  for each row execute function public.guard_listing();

-- stores: verified меняет только сервис
create or replace function public.guard_store() returns trigger language plpgsql as $$
begin
  if auth.role() <> 'service_role' then
    if new.verified is distinct from old.verified then
      raise exception 'verified change denied';
    end if;
    if new."ownerUid" is distinct from old."ownerUid" then
      raise exception 'immutable owner';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_store_t on public.stores;
create trigger guard_store_t before update on public.stores
  for each row execute function public.guard_store();

-- orders: покупателя/магазин не менять
create or replace function public.guard_order() returns trigger language plpgsql as $$
begin
  if auth.role() <> 'service_role' then
    if new."buyerUid" is distinct from old."buyerUid" or new."storeId" is distinct from old."storeId" then
      raise exception 'immutable order fields';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_order_t on public.orders;
create trigger guard_order_t before update on public.orders
  for each row execute function public.guard_order();

/* ================= RLS ================= */

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.reports enable row level security;

-- profiles
create policy profiles_select on public.profiles for select using (true);
create policy profiles_insert on public.profiles for insert with check (auth.uid() = id and role = 'user');
create policy profiles_update on public.profiles for update using (auth.uid() = id);

-- listings
create policy listings_select on public.listings for select
  using (status <> 'blocked' or "sellerId" = auth.uid());
create policy listings_insert on public.listings for insert
  with check (auth.uid() = "sellerId" and status = 'active');
create policy listings_update on public.listings for update
  using (auth.uid() = "sellerId")
  with check (auth.uid() = "sellerId" and status in ('active','sold','archived'));
create policy listings_delete on public.listings for delete
  using (auth.uid() = "sellerId");

-- chats
create policy chats_select on public.chats for select
  using (type = 'group' or auth.uid() = any(members));
create policy chats_insert on public.chats for insert
  with check (type = 'dm' and array_length(members, 1) = 2 and auth.uid() = any(members));
create policy chats_update on public.chats for update
  using (auth.uid() is not null and (type = 'group' or auth.uid() = any(members)))
  with check (type in ('group','dm'));

-- messages
create policy messages_select on public.messages for select
  using (exists (
    select 1 from public.chats c
    where c.id = "chatId" and (c.type = 'group' or auth.uid() = any(c.members))
  ));
create policy messages_insert on public.messages for insert
  with check (
    auth.uid() = "senderId"
    and exists (
      select 1 from public.chats c
      where c.id = "chatId" and (c.type = 'group' or auth.uid() = any(c.members))
    )
  );

-- stores
create policy stores_select on public.stores for select using (true);
create policy stores_insert on public.stores for insert
  with check (auth.uid() = "ownerUid" and verified = false);
create policy stores_update on public.stores for update
  using (auth.uid() = "ownerUid");

-- products
create policy products_select on public.products for select using (true);
create policy products_write on public.products for all
  using (exists (select 1 from public.stores s where s.id = "storeId" and s."ownerUid" = auth.uid()))
  with check (exists (select 1 from public.stores s where s.id = "storeId" and s."ownerUid" = auth.uid()));

-- orders
create policy orders_insert on public.orders for insert
  with check (auth.uid() = "buyerUid" and status = 'new');
create policy orders_select on public.orders for select
  using (
    auth.uid() = "buyerUid"
    or exists (select 1 from public.stores s where s.id = "storeId" and s."ownerUid" = auth.uid())
  );
create policy orders_update on public.orders for update
  using (
    exists (select 1 from public.stores s where s.id = "storeId" and s."ownerUid" = auth.uid())
    or (auth.uid() = "buyerUid" and status = 'new')
  );

-- reports
create policy reports_insert on public.reports for insert with check (auth.uid() = "byUid");

/* ================= Функции ================= */

-- счётчик просмотров (анонимно, безопасно)
create or replace function public.increment_views(lid uuid) returns void
language sql security definer set search_path = public as $$
  update public.listings set views = views + 1 where id = lid;
$$;
grant execute on function public.increment_views(uuid) to anon, authenticated;

-- автомодерация: стоп-слова + автоархив старше 60 дней
create or replace function public.run_automod() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  blocked_count int;
  archived_count int;
begin
  update public.listings
  set status = 'blocked', "blockedReason" = 'automod_stopword'
  where status = 'active'
    and lower(title || ' ' || "desc") ~ '(казино|букмекер|порно|эскорт|интим услуг|наркотик|гашиш|мефедрон|закладк|финансовая пирамида|быстрый заработок|млм|права без экзамен|диплом купить)';
  get diagnostics blocked_count = row_count;

  update public.listings
  set status = 'archived'
  where status = 'active' and "bumpedAt" < now() - interval '60 days';
  get diagnostics archived_count = row_count;

  return jsonb_build_object('blocked', blocked_count, 'archived', archived_count, 'at', now());
end $$;

-- расписание автомодерации внутри БД (pg_cron), каждые 6 часов
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('tetik-automod', '15 */6 * * *', 'select public.run_automod()');
exception when others then
  raise notice 'pg_cron недоступен: %', sqlerrm;
end $$;

/* ================= Realtime ================= */

do $$
begin
  alter publication supabase_realtime add table public.messages;
  alter publication supabase_realtime add table public.chats;
exception when others then
  raise notice 'realtime publication: %', sqlerrm;
end $$;

/* ================= Storage ================= */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listings', 'listings', true, 5242880, array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('stores',   'stores',   true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('avatars',  'avatars',  true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy storage_public_read on storage.objects for select
  using (bucket_id in ('listings','stores','avatars'));
create policy storage_owner_insert on storage.objects for insert
  with check (
    bucket_id in ('listings','stores','avatars')
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy storage_owner_delete on storage.objects for delete
  using (
    bucket_id in ('listings','stores','avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
