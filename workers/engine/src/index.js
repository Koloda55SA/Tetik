/**
 * Tetik Pinger — Cloudflare Worker
 * --------------------------------
 * Держит Supabase-проект активным (бесплатный тариф засыпает после 7 дней
 * без обращений) и страхует автомодерацию.
 *
 * Cron каждые 6 часов:
 *   1. лёгкий запрос к REST API (активность для анти-паузы)
 *   2. вызов RPC run_automod() — дубль pg_cron на случай его отключения
 *      (функция идемпотентна, двойной запуск безопасен)
 *
 * Vars: SUPABASE_URL, SUPABASE_ANON_KEY (anon-ключ публичный, не секрет)
 */

export default {
  async scheduled(_event, env, ctx) {
    const headers = {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    }
    ctx.waitUntil(
      Promise.allSettled([
        fetch(`${env.SUPABASE_URL}/rest/v1/listings?select=id&limit=1`, { headers }),
        fetch(`${env.SUPABASE_URL}/rest/v1/rpc/run_automod`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: '{}',
        }),
      ]),
    )
  },

  async fetch() {
    return new Response('tetik-pinger ok', { headers: { 'content-type': 'text/plain' } })
  },
}
