-- Группы: создаёт только админ, участники вступают и выходят сами
-- ---------------------------------------------------------------
-- 1. Владелец проекта — админ
update public.profiles set role = 'admin' where email = 'oon66517@gmail.com';

-- 2. Защита групп: обычный участник не может переименовать группу
--    или тронуть чужое членство; менять состав — только себя.
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
     or new.topic is distinct from old.topic then
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

drop trigger if exists guard_chat_t on public.chats;
create trigger guard_chat_t before update on public.chats
  for each row execute function public.guard_chat();

-- 3. Создание групп — только админ (личные чаты как раньше)
drop policy if exists chats_insert on public.chats;
create policy chats_insert on public.chats for insert
  with check (
    (type = 'dm' and array_length(members, 1) = 2 and auth.uid() = any(members))
    or (
      type = 'group'
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  );

-- 4. Удалять группы — только админ
drop policy if exists chats_delete on public.chats;
create policy chats_delete on public.chats for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- 5. Писать в группу — только участникам (читать может любой)
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert
  with check (
    auth.uid() = "senderId"
    and exists (
      select 1 from public.chats c
      where c.id = "chatId" and auth.uid() = any(c.members)
    )
  );

-- 6. Вступить / выйти — через функции (массив участников меняется атомарно)
create or replace function public.join_group(chat_id text, display_name text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'auth required'; end if;
  update public.chats
     set members = case when me = any(members) then members else array_append(members, me) end,
         "memberNames" = case
           when display_name is null or length(trim(display_name)) = 0 then "memberNames"
           else jsonb_set(coalesce("memberNames", '{}'::jsonb), array[me::text],
                          to_jsonb(left(trim(display_name), 60)))
         end
   where id = chat_id and type = 'group';
end $$;

create or replace function public.leave_group(chat_id text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'auth required'; end if;
  update public.chats
     set members = array_remove(members, me),
         "memberNames" = coalesce("memberNames", '{}'::jsonb) - me::text
   where id = chat_id and type = 'group';
end $$;

revoke execute on function public.join_group(text, text) from anon, public;
revoke execute on function public.leave_group(text) from anon, public;
grant execute on function public.join_group(text, text) to authenticated;
grant execute on function public.leave_group(text) to authenticated;
