// Tetik OTP Mailer — Supabase Edge Function
// POST { email } → шлёт 6-значный код через Brevo (ключ в Vault).
// Без ключа отвечает { fallback: true } — клиент использует встроенную почту Supabase.
// Код подтверждается стандартным supabase.auth.verifyOtp({ email, token, type: 'email' }).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function otpHtml(code: string): string {
  return `<!doctype html><html><body style="margin:0;background:#131211;font-family:Arial,sans-serif;padding:32px 16px">
  <div style="max-width:420px;margin:0 auto;background:#1c1b19;border-radius:20px;padding:32px;text-align:center">
    <p style="color:#ff7a2f;font-weight:800;font-size:20px;letter-spacing:3px;margin:0 0 6px">TETIK</p>
    <p style="color:#f2f0ec;font-size:15px;margin:0 0 4px">Ваш код для входа / Кирүү коду:</p>
    <p style="color:#fff;background:#262421;border-radius:14px;font-size:36px;font-weight:800;letter-spacing:10px;padding:18px 8px;margin:18px 0">${code}</p>
    <p style="color:#a19c93;font-size:12px;margin:0;line-height:1.6">Код действует 1 час. Если это были не вы — просто игнорируйте письмо.<br/>Код 1 саат жарактуу.</p>
  </div>
  <p style="color:#6b6760;font-size:11px;text-align:center;margin-top:16px">Tetik — маркетплейс автозапчастей Кыргызстана · tetik.radev.digital</p>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 200) return json({ error: "bad_email" });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // --- рейт-лимит: 1 письмо/мин, 10/день на адрес ---
    const now = new Date();
    const { data: rl } = await admin.from("otp_requests").select("*").eq("email", email).maybeSingle();
    if (rl) {
      const last = new Date(rl.lastSentAt);
      if (now.getTime() - last.getTime() < 60_000) return json({ error: "too_often" });
      const sameDay = last.toDateString() === now.toDateString();
      const dayCount = sameDay ? rl.dayCount : 0;
      if (dayCount >= 10) return json({ error: "daily_limit" });
      await admin.from("otp_requests").upsert({ email, lastSentAt: now.toISOString(), dayCount: dayCount + 1 });
    } else {
      await admin.from("otp_requests").insert({ email, lastSentAt: now.toISOString(), dayCount: 1 });
    }

    // --- ключи Brevo из Vault ---
    const { data: apiKey } = await admin.rpc("get_secret", { secret_name: "brevo_api_key" });
    const { data: sender } = await admin.rpc("get_secret", { secret_name: "brevo_sender" });
    if (!apiKey || !sender) return json({ ok: true, fallback: true }); // ключа нет — клиент шлёт встроенной почтой

    // --- гарантируем пользователя и берём код через админ-API ---
    let link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) {
      await admin.auth.admin.createUser({ email, email_confirm: true }).catch(() => {});
      link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    }
    const code = link.data?.properties?.email_otp;
    if (!code) return json({ ok: true, fallback: true });

    // --- отправка через Brevo ---
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { email: sender, name: "Tetik" },
        to: [{ email }],
        subject: `${code} — код входа в Tetik`,
        htmlContent: otpHtml(code),
      }),
    });
    if (!res.ok) {
      console.error("brevo", res.status, await res.text());
      return json({ ok: true, fallback: true });
    }
    return json({ ok: true, channel: "brevo", len: String(code).length });
  } catch (e) {
    console.error(e);
    return json({ error: "internal" });
  }
});
