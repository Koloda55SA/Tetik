# Tetik ⬡

**Маркетплейс автозапчастей Кыргызстана.** Базар объявлений с нормальным поиском, чаты как WhatsApp-группы, официальные магазины с заказами.

by **radev.digital** × **Murabaha Auto (Ош)**

**Репозиторий**: https://github.com/Koloda55SA/Tetik · **Прод**: https://tetik.radev.digital

## Стек

| Слой | Технология |
|---|---|
| Фронтенд | Vite + React 18 + TypeScript + Tailwind (SPA, PWA, mobile-first) |
| Бэкенд | Supabase (бесплатный тариф): Postgres + RLS, Auth (OTP-код на почту), Storage, Realtime |
| Поиск | Postgres full-text search (русская морфология) + фильтры сервер-сайд |
| Автомодерация | SQL-функция run_automod() по расписанию pg_cron (+ дубль из воркера) |
| Хостинг | Cloudflare Pages + Worker tetik-pinger (анти-пауза Supabase) |
| Языки | Русский + Кыргызча (i18next) |
| Мобильные | Готово к упаковке в Capacitor → Android APK + iOS |

## Структура

```
src/                 — фронтенд (pages, components, lib)
supabase/migrations/ — схема БД, RLS-политики, поиск, storage-бакеты
supabase/seed.sql    — стартовые данные (Murabaha Auto, чаты, демо-объявления)
workers/engine/      — Cloudflare Worker: пинг Supabase + автомодерация
scripts/             — unpack-assets (base64 → картинки), pages-upload (direct upload)
docs/                — архитектура, роадмап
public/              — бренд-ассеты (генерируются из assets-b64/ на postinstall)
```

## Запуск локально

```bash
npm install            # postinstall сам распакует картинки из assets-b64/
cp .env.example .env   # вставить VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY
npm run dev
```

## Деплой

- **База**: миграции в `supabase/migrations/` применяются через Supabase MCP/CLI (`supabase db push`)
- **Сайт**: `npm run build` → Cloudflare Pages (git-интеграция или direct upload: `PAGES_JWT=<jwt> node scripts/pages-upload.mjs`)
- **Пингер**: `npx wrangler deploy --config workers/engine/wrangler.toml`

## Автономная работа

- Вход по 6-значному коду на почту — Supabase Auth, без участия админа
- Автомодерация: pg_cron каждые 6ч блокирует объявления по стоп-словам, архивирует старше 60 дней
- Worker-пингер не даёт бесплатному проекту Supabase заснуть (пауза после 7 дней тишины)
- RLS-политики + триггеры-защитники: чужое не отредактировать, blocked не разблокировать, verified самому не поставить

## Примечание по кыргызскому

Переводы `src/locales/ky.json` написаны ИИ — рекомендуется вычитка носителем перед крупным запуском.
