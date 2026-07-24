-- Tetik seed: системный профиль, магазин Murabaha Auto, групповые чаты, демо-объявления
insert into public.profiles (id, email, "displayName", city, role)
values ('00000000-0000-0000-0000-000000000001', 'system@tetik.kg', 'Tetik', 'Бишкек', 'user')
on conflict (id) do nothing;

insert into public.stores (slug, name, "desc", city, phone, verified, "ownerUid", cover)
values ('murabaha-auto', 'Murabaha Auto',
  'Официальный автосалон в Оше. Авто в рассрочку по исламским принципам, оригинальные запчасти под заказ.',
  'Ош', '+996550000000', true, '00000000-0000-0000-0000-000000000001', '/heroes/stores-banner.jpg')
on conflict (slug) do nothing;

insert into public.chats (id, type, title, region, topic, members, "lastMsg", "lastMsgAt") values
  ('g-bishkek', 'group', 'Запчасти Бишкек 🔧', 'Бишкек', '', array['00000000-0000-0000-0000-000000000001']::uuid[], 'Добро пожаловать! Кош келиңиздер!', now()),
  ('g-osh', 'group', 'Запчасти Ош 🔧', 'Ош', '', array['00000000-0000-0000-0000-000000000001']::uuid[], 'Добро пожаловать! Кош келиңиздер!', now()),
  ('g-toyota', 'group', 'Toyota KG — клуб', '', 'Toyota', array['00000000-0000-0000-0000-000000000001']::uuid[], 'Добро пожаловать!', now()),
  ('g-honda', 'group', 'Honda Fit/Stepwgn KG', '', 'Honda', array['00000000-0000-0000-0000-000000000001']::uuid[], 'Добро пожаловать!', now()),
  ('g-german', 'group', 'Немцы: Mercedes/BMW/Audi', '', 'Евро', array['00000000-0000-0000-0000-000000000001']::uuid[], 'Добро пожаловать!', now())
on conflict (id) do nothing;

insert into public.messages ("chatId", "senderId", "senderName", text)
select c.id, '00000000-0000-0000-0000-000000000001'::uuid, 'Tetik',
  'Это группа «' || c.title || '». Пишите, что продаёте или ищете — как в WhatsApp, только с поиском по базару 🔧'
from public.chats c
where c.type = 'group' and not exists (select 1 from public.messages m where m."chatId" = c.id);

insert into public.listings (title, "desc", price, category, brand, model, condition, city, photos, "sellerId", "sellerName", phone, views, "createdAt", "bumpedAt") values
  ('Фара передняя Camry 70, новая, оригинал, в упаковке', 'Демо-объявление Tetik. Звоните или пишите в WhatsApp. Торг уместен.', 8500, 'body', 'Toyota', 'Camry 70', 'new', 'Бишкек', '["/parts/camry-headlight.jpg"]'::jsonb, '00000000-0000-0000-0000-000000000001', 'Автозапчасти Бишкек', '+996550000000', 47, now() - interval '2 hours', now() - interval '2 hours'),
  ('Бампер передний Honda Fit, б/у, серебристый, без трещин', 'Демо-объявление Tetik. Состояние хорошее, без трещин и сколов.', 3200, 'body', 'Honda', 'Fit', 'used', 'Бишкек', '["/parts/fit-bumper.jpg"]'::jsonb, '00000000-0000-0000-0000-000000000001', 'Автозапчасти Бишкек', '+996550000000', 33, now() - interval '5 hours', now() - interval '5 hours'),
  ('Колодки тормозные передние, комплект, новые в упаковке', 'Демо-объявление Tetik. Подходят на большинство седанов Toyota.', 1400, 'brakes', 'Toyota', 'универсал', 'new', 'Ош', '["/parts/brake-pads.jpg"]'::jsonb, '00000000-0000-0000-0000-000000000001', 'Автозапчасти Ош', '+996550000000', 21, now() - interval '8 hours', now() - interval '8 hours'),
  ('Генератор б/у, рабочий, снят с Camry 40, проверен', 'Демо-объявление Tetik. Проверен на стенде, рабочий.', 4800, 'electrics', 'Toyota', 'Camry 40', 'used', 'Бишкек', '["/parts/alternator.jpg"]'::jsonb, '00000000-0000-0000-0000-000000000001', 'Автозапчасти Бишкек', '+996550000000', 55, now() - interval '12 hours', now() - interval '12 hours'),
  ('Радиатор охлаждения новый, подходит на Corolla/Prius', 'Демо-объявление Tetik. Новый, в упаковке, доставка по городу.', 6200, 'engine', 'Toyota', 'Corolla', 'new', 'Бишкек', '["/parts/radiator.jpg"]'::jsonb, '00000000-0000-0000-0000-000000000001', 'Автозапчасти Бишкек', '+996550000000', 18, now() - interval '1 day', now() - interval '1 day'),
  ('Амортизаторы передние 2 шт., новые, комплект', 'Демо-объявление Tetik. Пара, новые. Установка рядом.', 5500, 'suspension', 'Honda', 'Fit', 'new', 'Ош', '["/parts/shock-absorbers.jpg"]'::jsonb, '00000000-0000-0000-0000-000000000001', 'Автозапчасти Ош', '+996550000000', 29, now() - interval '1 day 4 hours', now() - interval '1 day 4 hours'),
  ('Фильтр масляный, в наличии много, оптом дешевле', 'Демо-объявление Tetik. Опт и розница, все марки.', 280, 'oils', 'Другая', '', 'new', 'Бишкек', '["/parts/oil-filters.jpg"]'::jsonb, '00000000-0000-0000-0000-000000000001', 'Автозапчасти Бишкек', '+996550000000', 64, now() - interval '2 days', now() - interval '2 days'),
  ('Диски литые R16 4 шт., б/у, без серьёзных повреждений', 'Демо-объявление Tetik. Комплект 4 шт, разболтовка 5x114.3.', 12000, 'wheels', 'Другая', 'R16', 'used', 'Бишкек', '["/parts/alloy-wheels.jpg"]'::jsonb, '00000000-0000-0000-0000-000000000001', 'Автозапчасти Бишкек', '+996550000000', 41, now() - interval '2 days 6 hours', now() - interval '2 days 6 hours'),
  ('Аккумулятор 60Ач новый, гарантия 1 год, доставка', 'Демо-объявление Tetik. Гарантия, доставка по Бишкеку бесплатно.', 5900, 'electrics', 'Другая', '60Ah', 'new', 'Бишкек', '["/parts/battery.jpg"]'::jsonb, '00000000-0000-0000-0000-000000000001', 'Автозапчасти Бишкек', '+996550000000', 38, now() - interval '3 days', now() - interval '3 days'),
  ('Комплект ГРМ (ремень + ролики), новый, в упаковке', 'Демо-объявление Tetik. На двигатели 1ZZ/2ZR, оригинал.', 3700, 'engine', 'Toyota', '1ZZ/2ZR', 'new', 'Ош', '["/parts/timing-kit.jpg"]'::jsonb, '00000000-0000-0000-0000-000000000001', 'Автозапчасти Ош', '+996550000000', 26, now() - interval '3 days 12 hours', now() - interval '3 days 12 hours');

select (select count(*) from public.listings) as listings,
       (select count(*) from public.chats) as chats,
       (select count(*) from public.stores) as stores;
