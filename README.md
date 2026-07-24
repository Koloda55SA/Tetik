# Tetik ⬡

**Маркетплейс автозапчастей Кыргызстана.** Базар объявлений с нормальным поиском, чаты как WhatsApp-группы, официальные магазины с заказами.

by **radev.digital** × **Murabaha Auto (Ош)**

## Стек

| Слой | Технология |
|---|---|
| Фронтенд | Vite + React 18 + TypeScript + Tailwind (SPA, PWA, mobile-first) |
| База/файлы | Firebase: Firestore + Storage (тариф Spark, бесплатно) |
| Auth | Код на почту → Cloudflare Worker → Firebase custom token (без паролей) |
| Движок | Cloudflare Worker `tetik-engine`: OTP-письма (Brevo), автомодерация, автоархив |
| Хостинг | Cloudflare Pages |
| Языки | Русский + Кыргызча (i18next) |
| Мобильные | Готово к упаковке в Capacitor → Android APK + iOS |

## Структура

```
src/            — фронтенд (pages, components, lib)
firebase/       — firestore.rules, storage.rules, индексы
workers/engine/ — Cloudflare Worker: auth-коды + cron-автомодерация
scripts/        — seed демо-данных
docs/           — архитектура, роадмап
public/         — бренд-ассеты (логотип, фоны, категории)
```

**Репозиторий**: https://github.com/Koloda55SA/Tetik

## Запуск локально

```bash
npm install            # postinstall сам распакует картинки из assets-b64/
cp .env.example .env   # заполнить конфиг Firebase + URL воркера
npm run dev
```

> 📦 **Про картинки**: бинарные ассеты (jpg/png) хранятся в git как base64-текст в `assets-b64/`
> (ограничение API-коммитов). `npm install` автоматически распаковывает их в `public/`.
> Добавил новую картинку — прогони `base64 -w0 файл > assets-b64/путь.b64` и закоммить только `.b64`.

## Деплой (автоматизирован)

1. **Firebase**: создать проект → включить Firestore, Storage → загрузить `firebase/*.rules` и индексы.
2. **Worker**: `npm run deploy:engine`, секреты: `wrangler secret put FIREBASE_SERVICE_ACCOUNT`, `wrangler secret put BREVO_API_KEY`.
3. **Pages**: `npm run build && npm run deploy:pages` (или подключить репо к Cloudflare Pages — автодеплой на каждый push).

## Автономная работа

- Вход по коду на почту — без участия админа
- Cron-воркер каждые 6ч: блокировка объявлений по стоп-словам, автоархив старше 60 дней, пульс в `system/health`
- Правила безопасности Firestore не дают клиентам ломать данные (роли, verified, blocked — только со стороны движка)

## Примечание по кыргызскому

Переводы `src/locales/ky.json` написаны ИИ — рекомендуется вычитка носителем перед крупным запуском.
