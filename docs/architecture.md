# Архитектура Tetik

## Общая схема

```
[Браузер / PWA / (будущее: Capacitor APK+iOS)]
        │
        ├── Cloudflare Pages  ← статика (Vite build), CI/CD из GitHub
        │
        ├── Firebase Firestore ← объявления, чаты, магазины, заказы (напрямую из клиента, под rules)
        ├── Firebase Storage   ← фото (напрямую из клиента, под rules)
        ├── Firebase Auth      ← сессии (signInWithCustomToken)
        │
        └── Cloudflare Worker "tetik-engine"
              ├── POST /auth/send-code  → Brevo (письмо с кодом), Firestore otps/*
              ├── POST /auth/verify     → проверка кода → Firebase custom token
              └── cron */6h             → автомодерация + автоархив + system/health
```

## Почему так

- **Firebase Spark (бесплатно)**: Cloud Functions не нужны — вся серверная логика живёт в Cloudflare Worker (тоже бесплатный тариф, 100k запросов/день). Внешние вызовы (почта) из Worker не ограничены.
- **Auth по коду на почту**: пользователи не помнят пароли. Worker генерирует код, хранит SHA-256-хэш в `otps/{sha256(email)}`, шлёт письмо через Brevo (300 писем/день бесплатно). После проверки — кастомный JWT (RS256 сервисного аккаунта), клиент делает `signInWithCustomToken`. UID детерминированный: `u + sha256(email)[:27]`.
- **Поиск**: `keywords[]` (токены заголовка+марки+модели) + `array-contains` + клиентская дочистка. На росте — Typesense/Algolia или Cloudflare D1 FTS.

## Коллекции Firestore

| Коллекция | Что хранит | Кто пишет |
|---|---|---|
| `users/{uid}` | профиль (имя, город, телефон) | владелец |
| `listings/{id}` | объявления базара | продавец (create/update), Worker (block/archive) |
| `chats/{id}` + `messages` | группы и личка | участники |
| `stores/{id}` + `products` | официальные магазины | владелец магазина; `verified` — только вручную/движком |
| `orders/{id}` | заказы в магазинах | покупатель создаёт, магазин меняет статус |
| `reports/{id}` | жалобы | любой авторизованный (только create) |
| `otps/{hash}` | одноразовые коды | только Worker (клиентам запрещено) |
| `system/health` | пульс автомодерации | только Worker |

## Безопасность

- Правила Firestore: владелец меняет только своё; `status=blocked` снять нельзя; `verified` магазину самому не поставить; `otps` закрыт полностью.
- Storage: только владелец пишет в свою папку, максимум 5МБ, только image/*.
- Worker: rate-limit кодов (1/мин на email), 5 попыток на код, TTL 10 минут, хэши вместо кодов.
- CORS: только домены из `ALLOWED_ORIGINS`.

## Мобильные приложения (потом)

SPA без SSR-зависимостей — оборачивается Capacitor'ом как есть: `npx cap add android && npx cap add ios`. Push-уведомления: FCM через тот же Firebase-проект.
