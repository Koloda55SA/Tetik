# Архитектура Tetik

## Общая схема

```
[Браузер / PWA / (будущее: Capacitor APK+iOS)]
        │
        ├── Cloudflare Pages  ← статика (Vite build), домен tetik.radev.digital
        │
        └── Supabase (бесплатный тариф, регион ap-south-1 Мумбаи)
              ├── Postgres + RLS      ← объявления, чаты, магазины, заказы, жалобы
              ├── Auth                ← вход по 6-значному коду на почту (signInWithOtp)
              ├── Storage             ← фото (бакеты listings / stores / avatars, до 5МБ, только image/*)
              ├── Realtime            ← сообщения чатов (postgres_changes)
              └── pg_cron             ← run_automod() каждые 6 часов

[Cloudflare Worker tetik-pinger] — cron 6ч: пинг REST (анти-пауза) + дубль run_automod()
```

## Почему так

- **Supabase вместо Firebase**: Firebase Storage с 2024 требует платный Blaze (карту), Firestore ограничен 50k чтений/день и слаб в фильтрах. Postgres даёт нормальные WHERE-фильтры и русский полнотекстовый поиск (tsvector, websearch_to_tsquery), API-запросы не лимитируются.
- **Auth**: встроенный OTP Supabase — код на почту, `verifyOtp` на клиенте. Никаких паролей и кастомных токен-сервисов.
- **Поиск**: генерируемая колонка `fts` (title+desc+brand+model+city, конфиг russian) + GIN-индекс. Клиент вызывает `.textSearch('fts', q, { type: 'websearch', config: 'russian' })`.
- **Колонки в camelCase** (в кавычках) — 1:1 с интерфейсами фронтенда, без маппинга.

## Таблицы

| Таблица | Что хранит | Кто пишет (RLS) |
|---|---|---|
| profiles | профиль (имя, город, телефон) | владелец; роль защищена триггером |
| listings | объявления базара + fts | продавец; blocked ставит только автомод (service_role) |
| chats | группы и личка (members uuid[]) | dm создают участники; группы читают все |
| messages | сообщения | участники чата / любой авторизованный в группе |
| stores | официальные магазины | владелец; verified меняет только сервис |
| products | товары магазина | владелец магазина |
| orders | заказы | покупатель создаёт, магазин меняет статус |
| reports | жалобы | только insert авторизованным |

## Защита

- RLS на всех таблицах; триггеры-защитники: immutable-поля (sellerId, ownerUid, buyerUid, role, email), запрет снятия blocked, запрет самоверификации магазина.
- Storage-политики: писать только в свою папку `{uid}/...`, лимит 5МБ, только image/*.
- `increment_views` / `run_automod` — SECURITY DEFINER функции с фиксированным search_path.

## Автономность

1. **pg_cron** внутри БД: `tetik-automod` каждые 6ч — стоп-слова → blocked, старше 60 дней → archived.
2. **tetik-pinger** (Cloudflare Worker, cron 6ч): REST-запрос держит проект активным (бесплатный Supabase засыпает после 7 дней без обращений) + страховочный вызов run_automod.

## Мобильные приложения (потом)

SPA без SSR-зависимостей — оборачивается Capacitor'ом как есть. Push: OneSignal или FCM поверх того же Supabase.
