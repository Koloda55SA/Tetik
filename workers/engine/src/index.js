/**
 * Tetik Pinger — Cloudflare Worker
 * --------------------------------
 * Держит Supabase-проект активным (бесплатный тариф засыпает после 7 дней
 * без обращений) и страхует автомодерацию.
 *
 * Cron каждые 6 часов: лёгкий запрос к REST API — активность для анти-паузы.
 * Автомодерация крутится внутри БД (pg_cron → run_automod, доступ только у сервиса).
 *
 * Vars: SUPABASE_URL, SUPABASE_ANON_KEY (anon-ключ публичный, не секрет)
 */

export default {
  async scheduled(_event, env, ctx) {
    const headers = {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    }
    ctx.waitUntil(fetch(`${env.SUPABASE_URL}/rest/v1/listings?select=id&limit=1`, { headers }))
  },

  async fetch() {
    return new Response('tetik-pinger ok', { headers: { 'content-type': 'text/plain' } })
  },
}
