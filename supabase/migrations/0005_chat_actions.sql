-- Функции чата как в Telegram/WhatsApp:
-- ответ на сообщение, удаление своих, правка своих, закреп и антифлуд (slowmode)
-- --------------------------------------------------------------------------

/* ---------- 1. Новые поля ---------- */
alter table public.messages
  add column if not exists "replyToId"   uuid references public.messages(id) on delete set null,
  add column if not exists "replyToName" text,
  add column if not exists "replyToText" text,
  add column if not exists deleted       boolean not null default false,
  add column if not exists "editedAt"    timestamptz;

create index if not exists messages_reply_idx on public.messages ("replyToId");

-- удалённое сообщение хранится с пустым текстом → ослабляем проверку
alter table public.messages drop constraint if exists messages_text_check;
alter table public.messages add constraint messages_text_check check (
  char_length(text) <= 2000
  and (char_length(text) > 0 or "imageUrl" is not null or "audioUrl" is not null or deleted)
);

alter table public.chats
  add column if not exists "slowmodeSec" integer not null default 0
    check ("slowmodeSec" between 0 and 3600),
  add column if not exists "pinnedMsgId" uuid,
  add column if not exists "pinnedText"  text,
  add column if not exists "pinnedName"  text;

/* ---------- 2. Антифлуд + проверка ответа при отправке ---------- */
create or replace function public.check_message_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  me       uuid := auth.uid();
  is_admin boolean;
  slow     integer;
  ctype    text;
  last_at  timestamptz;
  wait_sec integer;
begin
  if auth.role() = 'service_role' or me is null then return new; end if;

  select c."slowmodeSec", c.type into slow, ctype from public.chats c where c.id = new."chatId";
  select (p.role = 'admin') into is_admin from public.profiles p where p.id = me;

  -- ответ должен указывать на сообщение из этого же чата
  if new."replyToId" is not null then
    if not exists (
      select 1 from public.messages m where m.id = new."replyToId" and m."chatId" = new."chatId"
    ) then
      raise exception 'reply target not in chat';
    end if;
  end if;

  -- задержка между сообщениями: только группы, админ не ограничен
  if ctype = 'group' and coalesce(slow, 0) > 0 and not coalesce(is_admin, false) then
    select max(m."createdAt") into last_at
      from public.messages m
     where m."chatId" = new."chatId" and m."senderId" = me;
    if last_at is not null then
      wait_sec := slow - floor(extract(epoch from (now() - last_at)))::integer;
      if wait_sec > 0 then
        raise exception 'slowmode: подождите % сек', wait_sec using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists check_message_insert_t on public.messages;
create trigger check_message_insert_t before insert on public.messages
  for each row execute function public.check_message_insert();

/* ---------- 3. Правка и удаление сообщений ---------- */
create or replace function public.guard_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  me       uuid := auth.uid();
  is_admin boolean;
begin
  if auth.role() = 'service_role' or me is null then return new; end if;
  select (p.role = 'admin') into is_admin from public.profiles p where p.id = me;

  if new.id is distinct from old.id
     or new."chatId" is distinct from old."chatId"
     or new."senderId" is distinct from old."senderId"
     or new."senderName" is distinct from old."senderName"
     or new."createdAt" is distinct from old."createdAt"
     or new."replyToId" is distinct from old."replyToId" then
    raise exception 'immutable fields';
  end if;

  -- удаление: автор или админ; текст и медиа стираются
  if new.deleted and not old.deleted then
    if not (old."senderId" = me or coalesce(is_admin, false)) then
      raise exception 'delete denied';
    end if;
    new.text := '';
    new."imageUrl" := null;
    new."audioUrl" := null;
    return new;
  end if;

  if old.deleted then raise exception 'message already deleted'; end if;
  if new.deleted is distinct from old.deleted then raise exception 'restore denied'; end if;

  -- правка текста: только автор, только непустой
  if new.text is distinct from old.text then
    if old."senderId" <> me then raise exception 'edit denied'; end if;
    if char_length(trim(new.text)) = 0 then raise exception 'empty text'; end if;
    new."editedAt" := now();
  end if;

  -- медиа менять нельзя
  if new."imageUrl" is distinct from old."imageUrl"
     or new."audioUrl" is distinct from old."audioUrl" then
    raise exception 'media immutable';
  end if;

  return new;
end $$;

drop trigger if exists guard_message_t on public.messages;
create trigger guard_message_t before update on public.messages
  for each row execute function public.guard_message();

drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update
  using (
    auth.uid() = "senderId"
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    auth.uid() = "senderId"
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

/* ---------- 4. Настройки группы: только админ ---------- */
create or replace function public.guard_chat() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  is_admin boolean;
  added uuid[];
  removed uuid[];
begin
  if auth.role() = 'service_role' or me is null then return new; end if;

  if new.id is distinct from old.id or new.type is distinct from old.type then
    raise exception 'immutable fields';
  end if;

  select (p.role = 'admin') into is_admin from public.profiles p where p.id = me;
  if coalesce(is_admin, false) then return new; end if;

  if new.title is distinct from old.title
     or new.region is distinct from old.region
     or new.topic is distinct from old.topic
     or new."slowmodeSec" is distinct from old."slowmodeSec"
     or new."pinnedMsgId" is distinct from old."pinnedMsgId"
     or new."pinnedText" is distinct from old."pinnedText"
     or new."pinnedName" is distinct from old."pinnedName" then
    raise exception 'only admin can edit group';
  end if;

  select coalesce(array_agg(m), '{}') into added
    from (select unnest(new.members) except select unnest(old.members)) s(m);
  select coalesce(array_agg(m), '{}') into removed
    from (select unnest(old.members) except select unnest(new.members)) s(m);

  if (array_length(added, 1) is not null and added <> array[me])
     or (array_length(removed, 1) is not null and removed <> array[me]) then
    raise exception 'members change denied';
  end if;

  return new;
end $$;

/* ---------- 5. Закреп и slowmode через функции (для удобства клиента) ---------- */
create or replace function public.set_slowmode(chat_id text, secs integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'admin only';
  end if;
  update public.chats
     set "slowmodeSec" = greatest(0, least(3600, coalesce(secs, 0)))
   where id = chat_id and type = 'group';
end $$;

create or replace function public.pin_message(chat_id text, msg_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'admin only';
  end if;
  if msg_id is null then
    update public.chats set "pinnedMsgId" = null, "pinnedText" = null, "pinnedName" = null
     where id = chat_id;
    return;
  end if;
  select * into m from public.messages where id = msg_id and "chatId" = chat_id and not deleted;
  if m.id is null then raise exception 'message not found'; end if;
  update public.chats
     set "pinnedMsgId" = m.id,
         "pinnedText"  = left(case
                           when char_length(m.text) > 0 then m.text
                           when m."imageUrl" is not null then '📷 Фото'
                           else '🎤 Голосовое'
                         end, 140),
         "pinnedName"  = m."senderName"
   where id = chat_id;
end $$;

revoke execute on function public.set_slowmode(text, integer) from anon, public;
revoke execute on function public.pin_message(text, uuid) from anon, public;
grant execute on function public.set_slowmode(text, integer) to authenticated;
grant execute on function public.pin_message(text, uuid) to authenticated;

alter function public.check_message_insert() set search_path = public;
alter function public.guard_message() set search_path = public;

-- Realtime должен отдавать полную строку: иначе клиент не увидит,
-- какое именно сообщение отредактировали или удалили
alter table public.messages replica identity full;
alter table public.chats replica identity full;
