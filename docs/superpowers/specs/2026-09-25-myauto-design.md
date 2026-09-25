# «Мой авто» — спецификация v1

Дата: 2026-09-25 · Статус: согласована на брейншторме, ждёт ревью файла

## 1. Зачем

Личное приложение владельца нескольких машин: полная история каждой машины в одном месте.
Что менялось и какой марки/артикула, в каком СТО, какой мастер, сколько стоило, когда менялось масло,
сколько уходит на топливо и прочее, что и когда пора делать. Старая история у владельца на бумаге,
поэтому ввод задним числом должен быть быстрым.

**Критерии успеха v1**

1. Приложение открывается с телефона по адресу `https://smolskiy.github.io/myAuto/`, ставится иконкой
   на главный экран и полностью работает без интернета.
2. Запись ТО с 5 запчастями (бренд, артикул, цена), СТО, мастером и фото заказ-наряда вводится меньше чем за 2 минуты.
3. На главной видно, что скоро пора делать (по км и по времени), с прогнозом даты.
4. Данные и фото синхронизируются между телефоном и ПК через Яндекс.Диск и не теряются при переустановке.
5. Стоимость владения и расход топлива считаются автоматически.

**Пользователь:** один человек (владелец), 2–3 машины, проданные — в архиве. Устройства: телефон
(Android/iPhone — PWA) и иногда ПК (браузер). Отметка «кто внёс» не нужна.

## 2. Объём

**Входит в v1 (всё сразу, без отложенных волн):**

- гараж: несколько машин, архив проданных, полная карточка машины и «паспорт жидкостей»;
- журнал: ТО/ремонт (работы + запчасти с брендом и артикулом), заправки, прочие расходы, отметки пробега, заметки;
- справочники: места (СТО, АЗС, магазины, мойки…), мастера, каталог узлов/расходников с интервалами, подсказки брендов;
- напоминания по км и/или времени, автоматически от последней записи по узлу; сроки документов и полисов;
  экспорт в календарь (`.ics`);
- вложения: фото и PDF к записям, машинам, документам, комплектам шин;
- документы машины со сроками (СТС, ПТС, ОСАГО, КАСКО, диагностическая карта, прочее);
- комплекты шин (лето/зима/всесезон), установка/снятие, пробег комплекта;
- VIN-декодер (офлайн + необязательное онлайн-уточнение);
- статистика: стоимость владения, цена км, расход топлива, по категориям/месяцам/годам, история узла;
- поиск по всему журналу (текст, бренд, артикул, место, мастер);
- синхронизация через Яндекс.Диск, ежедневные бэкапы на Диске, выгрузка JSON (и восстановление), выгрузка Excel;
- светлая и тёмная темы; PWA; деплой на GitHub Pages.

**Не входит в v1 (не делать без отдельного запроса):** пуш-уведомления и нативный APK (Capacitor — возможная
будущая фаза), кредит/лизинг, ДТП и страховые случаи, отчёт для продажи машины, распознавание чеков (OCR/ИИ),
несколько пользователей, валюты кроме рубля, мили, импорт из Excel/Drive2.

## 3. Архитектура

PWA на React + TypeScript + Vite. Данные — в IndexedDB через Dexie (local-first).
Синхронизация — файл-снимок базы в папке приложения на Яндекс.Диске, слияние по записям
(подход проверен в `F:\projects\stats`, файлы `src/lib/merge.ts`, `sync.ts`, `yandex.ts`).
Хостинг — GitHub Pages, сборка и тесты — GitHub Actions. Сервера нет. Всё бесплатно.

```
┌──────────── браузер / PWA на телефоне ────────────┐
│ features/ (экраны)  ──►  ui/ (токены, компоненты) │
│      │                                            │
│      ▼                                            │
│ domain/ (типы, расчёты, каталог, VIN) ◄── db/ (Dexie, репозитории, хуки)
│                                           │       │
│                                    sync/ (Диск, слияние, вложения, бэкапы)
└───────────────────────────────────────────┼───────┘
                                            ▼
                      Яндекс.Диск: Приложения/Мой авто/
                        garage.json · attachments/ · backups/
```

### 3.1 Стек

| Что | Выбор | Почему |
|---|---|---|
| UI | React (актуальная стабильная) + TypeScript strict | знакомо по `stats`, агенты и владелец могут править |
| Сборка | Vite (актуальная стабильная), `vite-plugin-pwa` | как в `stats` |
| Роутинг | React Router, **hash-режим** (`createHashRouter`) | GitHub Pages не умеет SPA-фолбэк; hash не ломает глубокие ссылки |
| Данные | Dexie 4+ + `dexie-react-hooks` | живые запросы, миграции |
| Стили | CSS Modules + CSS-переменные (токены) | без рантайма, темы через `data-theme` |
| Иконки | `@tabler/icons-react` | outline-набор, tree-shaking |
| Шрифт | Onest (кириллица), локальные woff2 400/500/600, фолбэк системный | работает офлайн |
| Графики | Recharts, экран статистики грузится лениво | знакомо по `stats` |
| Excel | SheetJS из `cdn.sheetjs.com` tgz (как в `stats`), ленивый импорт | в npm устаревшая версия |
| Тесты | Vitest (+ `fake-indexeddb`, Testing Library), Playwright (мобильный вьюпорт) | |
| Качество | ESLint + Prettier, `tsc --noEmit` | параллельные агенты — единый формат |
| Пакеты | npm | как в `stats` |

### 3.2 Структура кода

```
src/
  domain/        ЧИСТЫЙ TS без React и Dexie
    types.ts        замороженные контракты сущностей (раздел 4)
    snapshot.ts     формат garage.json
    money.ts, dates.ts, format.ts     копейки, ГГГГ-ММ-ДД, форматирование «12 450 ₽», «148 320 км»
    catalog.ts      встроенный каталог узлов с интервалами (стабильные id)
    brands.ts       подсказки брендов запчастей и масел
    vin/            decode.ts (офлайн), wmi.ts (таблица), nhtsa.ts (онлайн)
    calc/           odometer.ts, fuel.ts, reminders.ts, costs.ts, itemHistory.ts, tires.ts, search.ts
    merge.ts        слияние снимков (из stats, обобщено)
  db/            Dexie
    schema.ts       таблицы и индексы
    repo/*.ts       CRUD по сущностям, мягкое удаление, updatedAt
    hooks.ts        useVehicles(), useRecords(filter), useReminders(vehicleId) …
    seed.ts         встроенный каталог (updatedAt = 0)
  sync/
    yandex/api.ts, yandex/oauth.ts
    engine.ts       цикл синхронизации, расписание, статус
    attachments.ts  сжатие фото, очередь загрузки, кеш оригиналов
    backup.ts       ежедневные копии, выгрузка/загрузка JSON, выгрузка Excel
    contracts.ts    интерфейсы SyncEngine, AttachmentStore (замороженные)
  ui/
    tokens.css, theme.ts, fonts/
    components/<Name>/<Name>.tsx + .module.css
    showcase/       страница-витрина #/showcase
  features/
    home/ journal/ records/ reminders/ stats/ garage/ vehicle/ places/ documents/ tires/ catalog/ settings/ onboarding/
  app/
    router.tsx, AppShell.tsx (шапка + нижняя панель), providers.tsx
public/
  oauth.html      приём токена Яндекса (раздел 6.2)
  icons, manifest-ассеты
```

**Правила границ:** `domain/` не импортирует ничего из других слоёв. `db/` импортирует только `domain/`.
`sync/` — `domain/` и `db/`. `ui/` — ничего из `domain/db/sync` (чистые компоненты, данные через пропсы).
`features/` собирают всё вместе. Замороженные контракты (`domain/types.ts`, `domain/snapshot.ts`,
`sync/contracts.ts`) меняет только лидер; агент, которому нужно изменение, описывает его в отчёте.

## 4. Модель данных

Общие правила:

- у каждой синхронизируемой строки: `id: string` (`crypto.randomUUID()`, у встроенного каталога — стабильные
  строковые id), `createdAt: number`, `updatedAt: number` (мс), `deleted?: boolean` (мягкое удаление);
- деньги — **целые копейки** (`Kopecks = number`); пробег — целые км; объёмы — литры с 2 знаками;
- даты — строка `ГГГГ-ММ-ДД` без часового пояса; моменты времени — мс;
- неизвестные поля строки сохраняются при слиянии (совместимость вперёд);
- встроенные записи каталога имеют `updatedAt = 0`: при подключении к Диску с непустой базой они не дублируются.

```ts
type ID = string; type Kopecks = number; type ISODate = string // 'YYYY-MM-DD'
interface Row { id: ID; createdAt: number; updatedAt: number; deleted?: boolean }

type FuelType = 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'lpg' | 'cng'
type Transmission = 'mt' | 'at' | 'cvt' | 'amt' | 'dct'
type Drive = 'fwd' | 'rwd' | 'awd'
type FluidKind = 'engineOil' | 'coolant' | 'atf' | 'mtf' | 'brake' | 'powerSteering' | 'diffFront' | 'diffRear' | 'transferCase'

interface Vehicle extends Row {
  name: string                 // «Октавия», показывается в переключателе
  make: string; model: string; generation?: string; year?: number
  vin?: string; plate?: string; color?: string; bodyType?: string
  engine?: { code?: string; displacementCc?: number; powerHp?: number; fuel?: FuelType }
  transmission?: Transmission; drive?: Drive
  tankLiters?: number; defaultFuelGrade?: string          // «АИ-95»
  purchase?: { date?: ISODate; odometer?: number; price?: Kopecks; note?: string }
  sale?: { date?: ISODate; odometer?: number; price?: Kopecks; note?: string }
  archived: boolean
  fluids: { kind: FluidKind; spec?: string; volumeL?: number; note?: string }[]
  tireSizeFront?: string; tireSizeRear?: string
  photoAttachmentId?: ID
  note?: string; order: number
}

type RecordKind = 'service' | 'fuel' | 'expense' | 'odometer' | 'note'
interface RecordBase extends Row {
  vehicleId: ID; kind: RecordKind; date: ISODate
  odometer?: number            // обязателен для fuel, желателен для service
  total: Kopecks               // для odometer/note = 0
  placeId?: ID; note?: string
}
type ServiceType = 'maintenance' | 'repair' | 'diagnostics' | 'bodywork' | 'tires' | 'tuning' | 'other'
interface WorkLine { id: ID; itemId?: ID; name: string; price?: Kopecks; masterId?: ID; note?: string }
interface PartLine {
  id: ID; itemId?: ID; name: string; brand?: string; partNumber?: string
  qty: number; unit: 'pcs' | 'l' | 'set' | 'm' | 'kg'
  unitPrice?: Kopecks; supplierPlaceId?: ID; supplierName?: string
  ownPart: boolean             // купил сам (true) или запчасть сервиса (false)
  note?: string
}
interface ServiceRecord extends RecordBase {
  kind: 'service'; title: string; serviceType: ServiceType
  masterId?: ID; diy: boolean
  works: WorkLine[]; parts: PartLine[]
  warrantyUntilDate?: ISODate; warrantyUntilKm?: number
  tireSwap?: { mountedSetId?: ID; removedSetId?: ID }
}
interface FuelRecord extends RecordBase {
  kind: 'fuel'; liters: number; pricePerLiter: Kopecks
  fullTank: boolean; missedBefore: boolean; fuelGrade?: string
}
type ExpenseCategory = 'osago' | 'kasko' | 'tax' | 'fine' | 'wash' | 'parking' | 'toll' | 'tireService'
  | 'tireStorage' | 'inspection' | 'accessories' | 'registration' | 'other'
interface ExpenseRecord extends RecordBase {
  kind: 'expense'; category: ExpenseCategory; title?: string
  validFrom?: ISODate; validUntil?: ISODate      // полис, диагностическая карта → напоминание
  docNumber?: string
}
interface OdometerRecord extends RecordBase { kind: 'odometer' }
interface NoteRecord extends RecordBase { kind: 'note'; title: string }
type CarRecord = ServiceRecord | FuelRecord | ExpenseRecord | OdometerRecord | NoteRecord

type PlaceKind = 'service' | 'fuel' | 'parts' | 'wash' | 'tire' | 'insurance' | 'other'
interface Place extends Row { kind: PlaceKind; name: string; address?: string; phone?: string; url?: string; rating?: 1|2|3|4|5; note?: string }
interface Master extends Row { name: string; placeId?: ID; phone?: string; specialization?: string; rating?: 1|2|3|4|5; note?: string }

type ItemGroup = 'engine' | 'fluids' | 'filters' | 'ignition' | 'timing' | 'transmission' | 'brakes'
  | 'suspension' | 'steering' | 'electrical' | 'climate' | 'body' | 'tires' | 'other'
interface CatalogItem extends Row {
  name: string; group: ItemGroup
  defaultIntervalKm?: number; defaultIntervalMonths?: number
  builtin: boolean; hidden?: boolean
}

interface ReminderRule extends Row {
  vehicleId: ID
  itemId?: ID; title?: string                   // узел из каталога или своё название
  intervalKm?: number; intervalMonths?: number  // хотя бы одно
  baseline?: { date?: ISODate; odometer?: number }  // «последний раз примерно тогда», если в журнале нет записи
  dueDate?: ISODate                             // разовое напоминание к дате
  enabled: boolean; note?: string
}

type DocumentKind = 'sts' | 'pts' | 'osago' | 'kasko' | 'diagCard' | 'license' | 'other'
interface VehicleDocument extends Row {
  vehicleId: ID; kind: DocumentKind; title?: string; number?: string
  issuedAt?: ISODate; validUntil?: ISODate; note?: string
}

interface TireSet extends Row {
  vehicleId: ID; season: 'summer' | 'winter' | 'allSeason'
  brand?: string; model?: string; size?: string; dot?: string   // «2423» = 24 неделя 2023
  studded?: boolean; count: number
  purchaseDate?: ISODate; price?: Kopecks
  storage?: string; status: 'installed' | 'stored' | 'retired'
  treadMm?: number; note?: string
}

type OwnerType = 'record' | 'vehicle' | 'document' | 'tireSet'
interface Attachment extends Row {
  ownerType: OwnerType; ownerId: ID
  kind: 'photo' | 'pdf'; name: string; mime: string; size: number
  width?: number; height?: number
  uploadedAt?: number          // когда оригинал и превью легли на Диск; undefined = только на устройстве-источнике
}
```

**Локальные (не синхронизируемые) таблицы:** `blobs` — `{ key: '<attachmentId>:orig' | '<attachmentId>:thumb',
blob, pendingUpload: boolean, lastAccess: number }`; `meta` — настройки устройства (тема, активная машина,
токен Яндекса, время последней синхронизации, «последняя введённая дата» в сессии).

**Формат `garage.json`:**

```json
{ "format": "myauto-garage", "schemaVersion": 1, "exportedAt": 1790000000000,
  "tables": { "vehicles": [], "records": [], "places": [], "masters": [], "catalogItems": [],
              "reminderRules": [], "documents": [], "tireSets": [], "attachments": [] } }
```

Этот же формат — ручной бэкап JSON. Импорт снимка = слияние (не замена), замена — только по явному выбору.

## 5. Расчёты (`domain/calc`, чистые функции с тестами)

- **Текущий пробег машины** — максимум из пробегов записей и `purchase.odometer`.
  Предупреждение в форме, если вводимый пробег меньше пробега более ранней по дате записи или больше более поздней.
- **Средний пробег в день** — по точкам (дата, пробег) за последние 180 дней, если они покрывают ≥ 14 дней;
  иначе за всю историю; иначе неизвестен.
- **Расход топлива** — метод «полный бак → полный бак»: для заправки Fᵢ с полным баком и предыдущей
  полной Fⱼ без `missedBefore` между ними: `Σ литров (Fⱼ, Fᵢ] / (odoᵢ − odoⱼ) × 100`.
  Интервалы с пропуском не считаются. Средний за период — взвешенный по км.
- **Напоминание:** последнее выполнение = самая поздняя по дате (при равенстве — по пробегу) запись `service`,
  где есть работа или запчасть с `itemId` правила; иначе `baseline`; иначе «нет данных».
  `dueKm = lastOdo + intervalKm`, `dueDate = lastDate + intervalMonths`. Остаток по км → прогноз даты через
  средний пробег. Статус: `overdue` если остаток ≤ 0 по любому измерению; `soon` если остаток
  ≤ max(1000 км, 10 % интервала) или ≤ max(30 дней, 10 % интервала); иначе `ok`. Итог — худший из двух.
- **Сроки документов и полисов** — из `VehicleDocument.validUntil` и `ExpenseRecord.validUntil`
  (по каждому виду берётся самая поздняя дата; ОСАГО/КАСКО из расхода и из документа — один вид), показываются в том же списке «Скоро»: `soon` за 30 дней.
- **Стоимость владения** — суммы по группам: запчасти, работы, топливо, каждая категория расходов;
  по месяцам и годам; цена км = расходы периода / км за период. Цена покупки и продажи — отдельной строкой
  в карточке машины, в расходы периода не входит.
- **История узла** — все строки работ/запчастей с этим `itemId` по машине: дата, пробег, бренд, артикул, цена,
  место, фактический интервал от предыдущей замены (км и дни).
- **Пробег комплекта шин** — сумма отрезков между установкой (`tireSwap.mountedSetId`) и снятием.
- **Поиск** — по названию/заметке записи, строкам работ и запчастей (название, бренд, артикул),
  названиям мест и мастеров; регистр и ё/е не важны.

## 6. Синхронизация и хранение

### 6.1 Яндекс.Диск

Папка приложения (`cloud_api:disk.app_folder`), в API — `app:/`. Название папки = название OAuth-приложения
«Мой авто».

```
app:/garage.json                     снимок базы без файлов
app:/attachments/<id>.jpg|.pdf       оригиналы
app:/attachments/<id>.thumb.jpg      превью ~320 px
app:/backups/ГГГГ-ММ-ДД.json         ежедневные копии (копия на стороне Диска), храним 30 последних
```

**Цикл синхронизации** (`sync/engine.ts`):

1. Скачать `garage.json` (нет файла → пустой снимок) и запомнить его `revision`/`md5`.
2. `merge(local, remote)` — по каждой таблице побеждает строка с большим `updatedAt`; при равенстве — удаление;
   дальше — детерминированное сравнение. Коммутативно и идемпотентно (перенести и обобщить `stats/src/lib/merge.ts`).
   Встроенные записи каталога с `updatedAt = 0`, которых нет на Диске и которые не использованы, при первом
   подключении к непустому Диску не выгружаются (аналог `dropUnusedStarters`).
3. Записать локально изменившиеся строки.
4. Если объединённый снимок отличается от удалённого — перед загрузкой сверить `revision`: изменился → повторить
   цикл (до 3 раз); иначе загрузить.
5. Вложения: загрузить все `blobs` с `pendingUpload` (оригинал + превью), проставить `uploadedAt`;
   для строк-вложений с `deleted` — удалить файлы на Диске (404 — не ошибка).
6. Раз в сутки — копия `garage.json` в `backups/` и удаление копий старше 30.

**Когда запускается:** при открытии, через 2,5 с после локального изменения, при возврате в приложение,
при событии `online`, раз в 5 минут, жестом «потянуть вниз» на главной и в журнале. Параллельный запуск
не допускается (одна активная синхронизация).

**Статус** (`SyncEngine.status`): `off` (не подключено) · `idle` · `syncing` · `error` (текст ошибки) ·
`offline`. Значок в шапке; подробности и ошибки — на экране «Синхронизация».

**Ошибки:** 401 → «Вход в Яндекс истёк — войдите заново», токен стирается; 507 → «На Диске нет места»;
сетевые → статус `offline`, повтор по расписанию. Ошибки не блокируют работу с данными.

### 6.2 Вход в Яндекс

OAuth-приложение на oauth.yandex.ru: платформа «Веб-сервисы», доступ «Яндекс.Диск REST API → Доступ к папке
приложения на Диске», Redirect URI — `https://smolskiy.github.io/myAuto/oauth.html` и
`http://localhost:5173/oauth.html`. Вход — implicit flow (`response_type=token`): страница `oauth.html` забирает
`access_token` из фрагмента URL, кладёт в `localStorage` и уходит на `./#/settings/sync`.
Запасной путь (как в `stats`): «Получить код» → `https://oauth.yandex.ru/verification_code` → вставить код.
ClientID зашивается при сборке из `VITE_YANDEX_CLIENT_ID` (переменная репозитория GitHub, не секрет);
без него приложение просит ввести ClientID вручную.

### 6.3 Вложения (`sync/attachments.ts`)

- Фото из камеры или галереи (`<input type="file" accept="image/*" capture="environment">` и без `capture`).
  Сжатие на устройстве: длинная сторона ≤ 2000 px, JPEG q 0,82; превью 320 px, JPEG q 0,7;
  ориентация по EXIF (`createImageBitmap(..., { imageOrientation: 'from-image' })`).
- PDF ≤ 20 МБ без обработки, превью — значок.
- Новое вложение: строка `Attachment` + `blobs` (`orig`, `thumb`, `pendingUpload: true`).
  После загрузки на Диск превью остаётся локально, оригинал — в кеше.
- Оригиналы в кеше вытесняются по давности, когда кеш > 200 МБ; неотправленные не вытесняются никогда.
- Показ: превью из `blobs`, нет → скачать `.thumb.jpg` с Диска; оригинал — при открытии просмотрщика.
- Без подключённого Диска всё хранится на устройстве; в настройках и при первом фото — предупреждение,
  что копии нет. При старте приложение запрашивает `navigator.storage.persist()`.

### 6.4 Выгрузки

- **JSON** — полный снимок (формат `garage.json`), без файлов вложений. Загрузка JSON: показать, что найдено,
  спросить «Объединить» (по умолчанию) или «Заменить всё».
- **Excel** — листы «Машины», «Журнал», «Запчасти» (по строке на запчасть), «Работы», «Заправки», «Расходы»,
  «Напоминания».

## 7. Экраны

Нижняя панель: **Главная · Журнал · (+) · ТО · Ещё**. Маршруты hash-роутера:

| Маршрут | Экран |
|---|---|
| `#/` | Главная: переключатель машин, карточка (фото, номер, пробег), «Скоро» (3 ближайших), быстрые кнопки Заправка/ТО/Расход/Пробег, сводка месяца (потрачено, л/100 км) → статистика, последние 5 записей |
| `#/journal` | Лента по месяцам с итогом месяца; фильтры (тип, узел, место, период) чипами; поиск; свайп по строке: удалить (с «Отменить») / повторить |
| `#/record/new/:kind`, `#/record/:id`, `#/record/:id/edit` | Формы и карточка записи |
| `#/reminders` | Список напоминаний по статусу, две полоски (км/время), прогноз даты; «Добавить в календарь» |
| `#/reminders/new`, `#/reminders/:id` | Правило напоминания |
| `#/items/:itemId` | История узла по активной машине |
| `#/more` | Меню «Ещё» |
| `#/stats` | Статистика: стоимость владения, цена км, расход топлива (график + таблица), категории, по годам |
| `#/garage`, `#/vehicle/new`, `#/vehicle/:id`, `#/vehicle/:id/edit` | Гараж, архив, карточка и форма машины с VIN-декодером |
| `#/documents`, `#/documents/:id` | Документы со сроками и вложениями |
| `#/tires`, `#/tires/:id` | Комплекты шин |
| `#/places`, `#/places/:id`, `#/masters/:id` | Места и мастера: визиты, всего потрачено, средний чек |
| `#/catalog` | Каталог узлов: свои позиции, скрытие встроенных, интервалы по умолчанию |
| `#/settings`, `#/settings/sync`, `#/settings/data` | Тема, синхронизация, выгрузки, о приложении |
| `#/onboarding` | Первый запуск: добавить машину (VIN → поля) → подключить Диск (можно позже) |
| `#/showcase` | Витрина дизайн-системы (ссылка в «О приложении») |

### 7.1 Формы и быстрый ввод

- Дата по умолчанию — сегодня; быстрые чипы «Сегодня / Вчера»; при вводе задним числом форма запоминает
  последнюю введённую дату на сессию и предлагает её следующей записи.
- Пробег предзаполнен последним известным; предупреждение о нарушении хронологии (раздел 5).
- **ТО/ремонт:** название (подсказки «ТО-N», из прошлых), тип, место (комбобокс с созданием нового), мастер
  (фильтруется по месту), «делал сам», строки работ и запчастей, итог (сумма строк; можно ввести итог вручную,
  если строки без цен), гарантия, фото. Строка запчасти: узел из каталога → подсказка «В прошлый раз: Mann W 712/95,
  650 ₽» → одно касание заполняет бренд, артикул, цену. Бренд — комбобокс (своя история + `brands.ts`).
  Кнопка «Повторить прошлое ТО» копирует строки последней записи с тем же названием/типом.
- **Заправка:** любые два из трёх (литры, цена за литр, сумма) → третье; полный бак (по умолчанию да);
  «пропустил заправку»; АЗС; марка топлива по умолчанию из машины.
- **Расход:** категория, сумма, место, «действует с/до» для полисов и диагностической карты.
- **Сумма** везде принимает арифметику: «1200+650» (как `stats/src/lib/format.ts`).
- Удаление — мягкое, с уведомлением «Отменить» 5 с.

### 7.2 VIN-декодер (`domain/vin`)

- Проверка: 17 символов, без I/O/Q; контрольная цифра (9-я позиция) — только предупреждение
  (у машин не для рынка США её часто нет).
- Офлайн: страна/регион по 1–2 символам, производитель по WMI (первые 3 символа; таблица ~300 записей
  с упором на рынок РФ: Lada `XTA`, UAZ `XTT`, российские сборки иномарок, Китай, Корея, Япония, Европа),
  модельный год по 10-му символу (выбирается ближайший год ≤ текущий + 1).
- Онлайн (кнопка «Уточнить онлайн», явное действие пользователя): NHTSA vPIC
  `DecodeVinValues/{vin}?format=json`, таймаут 8 с; ошибка или пустой ответ — молча остаёмся на офлайн-данных.
- Результат заполняет пустые поля формы машины; заполненные пользователем не перетираются.

## 8. Дизайн-система

Направление — **«Чистый системный»** (вариант 3 из показанных макетов): серый фон, белые карточки-группы
со строками, синий акцент, крупная понятная типографика, минимум декора. **Две темы**: светлая и тёмная;
по умолчанию — как в системе, переключатель «Как в системе / Светлая / Тёмная» в настройках;
`<meta name="theme-color">` меняется с темой.

Стартовые значения токенов (агент `ui-system` уточняет, проверяя контраст WCAG AA в обеих темах):

| Токен | Светлая | Тёмная |
|---|---|---|
| `--color-bg` | `#F2F3F5` | `#0E0F11` |
| `--color-surface` | `#FFFFFF` | `#1A1C1F` |
| `--color-surface-2` | `#F7F8FA` | `#232529` |
| `--color-text` | `#15181C` | `#F3F4F6` |
| `--color-text-2` | `#6B7280` | `#A1A7B0` |
| `--color-border` | `#E5E7EB` | `#2C2F34` |
| `--color-accent` | `#2563EB` | `#4C8DFF` |
| `--color-ok` | `#16A34A` | `#34C77B` |
| `--color-soon` | `#B7791F` | `#F2B544` |
| `--color-overdue` | `#DC2626` | `#F0625A` |

Плюс: цвета типов записей (ТО, заправка, расход, пробег, заметка) — для значка в кружке-подложке;
типографика (Onest, размеры 12/13/15/17/20/28, `font-variant-numeric: tabular-nums` для чисел);
отступы по сетке 4 px; радиусы 8/12/16/999; цель касания ≥ 44 px; длительности 120/200/320 мс
с учётом `prefers-reduced-motion`; тени только у шторок и кнопки (+); z-слои.

**Компоненты** (`src/ui/components`, данные только через пропсы, без знаний о домене БД):
Button, IconButton, Card, ListGroup, ListItem, SectionHeader, StatusPill, Badge, Chip, SegmentedControl,
ProgressBar, Divider, Skeleton, EmptyState, Toast (с действием), Dialog, BottomSheet, AppBar, BottomTabBar
(с центральной (+)), ActionSheet выбора типа записи, StatTile, SearchField, TextField, TextArea, NumberField
(единица ₽/км/л, `inputmode="decimal"`), MoneyField (арифметика), DateField (+ чипы), OdometerField
(подсказка и предупреждение), Select, Combobox (подсказки + «Создать «…»»), Switch, Checkbox, Rating,
RepeatableList + LineItemRow (каркас строк работ/запчастей), PhotoPicker, AttachmentGrid, Lightbox,
SwipeRow, PullToRefresh, SyncStatusBadge, ReminderCard (две полоски), RecordRow, MonthHeader,
VehicleSwitcher, VehicleCard, ChartCard (тема графиков).
Витрина `#/showcase` показывает каждый компонент во всех состояниях в обеих темах.

Тексты интерфейса — на русском, короткие, без «успешно» и восклицаний; числа — с неразрывными пробелами
(«148 320 км», «12 450 ₽»).

## 9. Деплой и PWA

- Репозиторий `smolskiy/myAuto` на GitHub, публичный (бесплатные Pages). В репозитории нет данных пользователя.
- GitHub Actions на push в `main`: `npm ci` → `tsc` → `eslint` → `vitest run` → `vite build` → Playwright
  (smoke) → публикация на Pages. `base: '/myAuto/'`.
- `vite-plugin-pwa`: манифест («Мой авто», `lang: ru`, `display: standalone`, portrait, иконки 192/512/maskable),
  офлайн-кеш всех ассетов, уведомление «Доступна новая версия — Обновить».

## 10. Тестирование

- **Unit (Vitest):** всё `domain/` — расчёты, VIN, слияние (коммутативность, идемпотентность, удаления,
  встроенный каталог), форматирование; `db/` репозитории на `fake-indexeddb`; `sync/` — движок на фейковом Диске
  (в памяти), включая гонку ревизий и ошибки 401/507/сеть.
- **Компоненты:** ключевые интерактивные (MoneyField, Combobox, DateField, SwipeRow) — Testing Library.
- **E2E (Playwright, вьюпорт 390×844):** первый запуск → машина по VIN → ТО с 3 запчастями → напоминание
  появилось на главной → заправки → расход посчитан → перезагрузка офлайн → данные на месте;
  переключение темы; выгрузка и загрузка JSON.
- Проверка вручную владельцем на телефоне после каждой вехи.

## 11. Агенты и порядок работ

Проектные агенты в `.claude/agents/`:

| Агент | Зона (может менять) | Не трогает |
|---|---|---|
| `ui-system` | `src/ui/**`, шрифты, иконки PWA | domain, db, sync, features |
| `domain-data` | `src/domain/**` (кроме замороженных контрактов), `src/db/**` | ui, sync, features |
| `sync-storage` | `src/sync/**`, `public/oauth.html` | ui, domain-контракты, features |
| `feature-screens` | `src/features/**`, `src/app/**` | контракты, ui-компоненты (просит у ui-system) |
| `qa-release` | `e2e/**`, `.github/**`, конфиги тестов, отчёты в `docs/qa/` | продуктовый код (кроме явно порученных фиксов) |

**Волны:**

- **Волна 0 (лидер):** каркас Vite/TS/линтеры/тесты, `CLAUDE.md`, агенты, замороженные контракты
  (`domain/types.ts`, `domain/snapshot.ts`, `sync/contracts.ts`), схема Dexie, заготовки маршрутов, CI, первый коммит.
- **Волна 1 (параллельно):** `ui-system` (токены, темы, все компоненты, витрина); `domain-data` (расчёты, каталог,
  бренды, VIN, репозитории, хуки, тесты); `sync-storage` (Диск, вход, движок, вложения, бэкапы, выгрузки на фейковом Диске).
- **Волна 2 (параллельно):** `feature-screens` ×2 — (а) формы записей, журнал, карточка записи, машина + VIN, онбординг;
  (б) главная, ТО и история узла, статистика, гараж, места/мастера, документы, шины, каталог, настройки;
  `qa-release` — e2e-сценарии. **Веха A:** приложение полностью работает на телефоне без синхронизации.
- **Волна 3:** подключение синхронизации и фото к экранам, регистрация OAuth-приложения (владелец),
  создание репозитория и деплой, e2e в CI, ревью. **Веха B:** приложение на GitHub Pages, данные на Диске.

Каждая задача агента заканчивается зелёными `tsc`, `eslint`, `vitest` по его зоне и отчётом: что сделано,
что решено самостоятельно, какие изменения контрактов нужны.

## 12. Таблица решений

| # | Решение | Почему |
|---|---|---|
| 1 | PWA на GitHub Pages, без APK | просьба владельца; напоминания по км всё равно срабатывают при вводе пробега; по дате — через календарь |
| 2 | Яндекс.Диск, папка приложения, один файл-снимок | проверено в `stats`; бесплатно; российский сервис; один пользователь — конфликтов мало |
| 3 | Фото — отдельные файлы, снимок без файлов | `garage.json` остаётся маленьким |
| 4 | Строки работ/запчастей внутри записи ТО, а не отдельные таблицы | конфликт на уровне записи достаточен для одного пользователя; проще формы |
| 5 | Копейки целыми | без ошибок округления |
| 6 | Hash-роутинг + отдельный `oauth.html` | Pages без SPA-фолбэка; токен Яндекса приходит во фрагменте URL |
| 7 | Implicit flow + запасной код | вход в одно касание на постоянном адресе |
| 8 | Дизайн в коде, стиль «Чистый системный», 2 темы | выбор владельца 2026-09-25 |
| 9 | VIN: офлайн + NHTSA по кнопке | бесплатного российского API нет; VIN уходит третьей стороне только по явному действию |
| 10 | Кредит, ДТП, отчёт для продажи, OCR — вне v1 | выбор владельца |
