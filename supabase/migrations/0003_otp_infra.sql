-- Инфраструктура отправки кодов: рейт-лимиты + доступ к Vault для edge-функции
create table if not exists public.otp_requests (
  email text primary key,
  "lastSentAt" timestamptz not null default now(),
  "dayCount" integer not null default 1
);
alter table public.otp_requests enable row level security; -- без политик: только service_role

create or replace function public.get_secret(secret_name text) returns text
language plpgsql security definer set search_path = public, vault as $$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = secret_name limit 1;
  return s;
exception when others then
  return null;
end $$;
revoke execute on function public.get_secret(text) from anon, authenticated, public;
grant execute on function public.get_secret(text) to service_role;
