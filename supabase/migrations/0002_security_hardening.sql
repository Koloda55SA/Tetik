-- Замечания security-линтера Supabase:
-- 1) фиксируем search_path в триггер-функциях
-- 2) run_automod вызывается только pg_cron / service_role
alter function public.guard_profile() set search_path = public;
alter function public.guard_listing() set search_path = public;
alter function public.guard_store() set search_path = public;
alter function public.guard_order() set search_path = public;
revoke execute on function public.run_automod() from anon, authenticated, public;
