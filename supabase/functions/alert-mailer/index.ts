// Tetik Alert Mailer — Supabase Edge Function
// Вызывается воркером-пингером (Cloudflare) при сбоях: POST { problems: string[] }
// Требует заголовок x-alert-token (секрет в Vault: tetik_alert_token).
// Шлёт письмо владельцу (адрес = brevo_sender из Vault) через Brevo.
// Рейт-лимит: не больше 8 писем в день — от спама при длительном сбое.
import { createClient } from "npm:@supabase/supabase-js@2";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // --- авторизация по токену из Vault ---
    const { data: expected } = await admin.rpc("get_secret", { secret_name: "tetik_alert_token" });
    const got = req.headers.get("x-alert-token") || "";
    if (!expected || got !== expected) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const problems: string[] = Array.isArray(body.problems)
      ? body.problems.map((p: unknown) => String(p).slice(0, 300)).slice(0, 10)
      : [];
    const subject = String(body.subject || "🔴 Tetik: обнаружена проблема").slice(0, 120);

    // --- рейт-лимит: 8 писем/день (переиспользуем otp_requests) ---
    const KEY = "__tetik_alert__";
    const now = new Date();
    const { data: rl } = await admin.from("otp_requests").select("*").eq("email", KEY).maybeSingle();
    let dayCount = 1;
    if (rl) {
      const last = new Date(rl.lastSentAt);
      const sameDay = last.toDateString() === now.toDateString();
      if (sameDay && rl.dayCount >= 8) return json({ ok: true, skipped: "daily_limit" });
      dayCount = (sameDay ? rl.dayCount : 0) + 1;
    }
    await admin.from("otp_requests").upsert({ email: KEY, lastSentAt: now.toISOString(), dayCount });

    // --- ключи Brevo из Vault; получатель = отправитель (почта владельца) ---
    const { data: apiKey } = await admin.rpc("get_secret", { secret_name: "brevo_api_key" });
    const { data: sender } = await admin.rpc("get_secret", { secret_name: "brevo_sender" });
    if (!apiKey || !sender) return json({ error: "no_mail_key" }, 500);

    const items = problems.length
      ? problems.map((p) => `<li style="margin:5px 0">${escHtml(p)}</li>`).join("")
      : `<li style="margin:5px 0">Тестовое письмо — сигнализация подключена и работает.</li>`;

    const html = `<!doctype html><html><body style="margin:0;background:#131211;font-family:Arial,sans-serif;padding:32px 16px">
  <div style="max-width:460px;margin:0 auto;background:#1c1b19;border-radius:20px;padding:28px">
    <p style="color:#ff7a2f;font-weight:800;font-size:18px;letter-spacing:3px;margin:0 0 12px">TETIK · МОНИТОРИНГ</p>
    <p style="color:#f2f0ec;font-size:15px;font-weight:700;margin:0 0 6px">${escHtml(subject)}</p>
    <ul style="color:#f2f0ec;font-size:13px;line-height:1.6;padding-left:18px;margin:10px 0 0">${items}</ul>
    <p style="color:#a19c93;font-size:12px;margin:16px 0 0;line-height:1.6">Автопроверка каждые 6 часов: сайт + база данных.<br/>Если сбой устранится — новых писем не будет.</p>
  </div>
  <p style="color:#6b6760;font-size:11px;text-align:center;margin-top:16px">Tetik · tetik.radev.digital</p>
</body></html>`;

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { email: sender, name: "Tetik Мониторинг" },
        to: [{ email: sender }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      console.error("brevo", res.status, await res.text());
      return json({ error: "send_failed" }, 502);
    }
    return json({ ok: true, sent: dayCount });
  } catch (e) {
    console.error(e);
    return json({ error: "internal" }, 500);
  }
});
