# Волна 2b-B · главная, ТО, статистика, настройки: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Загрузить `superpowers:test-driven-development`, `frontend-design` и `dataviz` (для статистики).

**Goal:** Экраны обзора и управления: главная с «Скоро» и сводкой, ТО и напоминания (с календарём `.ics`), история узла,
статистика стоимости владения и расхода, меню «Ещё», настройки темы, синхронизация с Яндекс.Диском, выгрузки и загрузки.

**Architecture:** `src/features/{home,reminders,stats,more,settings}` из компонентов `src/ui`, общих частей `src/features/common`,
хуков `src/db/hooks.ts`, расчётов `src/domain`, служб `src/sync` (`yandexAuth`, `syncEngine`, `backupService`,
`useSyncStatus`, `saveFile`). Графики — Recharts с цветами из `chartTheme.readFromCss()`; у каждого графика — таблица точных чисел.

**Tech Stack:** React 19, React Router 8, Recharts 3, Testing Library + fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-09-25-myauto-design.md` (разделы 5, 6.2, 6.4, 7, 8)

**Зона агента:** `src/features/home/**`, `src/features/reminders/**`, `src/features/stats/**`, `src/features/more/**`,
`src/features/settings/**`. Остальное только используешь.

## Global Constraints

- Текст — по-русски; числа и даты — через `domain/format.ts`; статусы всегда словами рядом с цветом.
- Главная грузится мгновенно: без графиков, только плитки и списки; статистика — ленивый маршрут.
- Токен Яндекса нигде не показывается; ClientID можно ввести вручную.
- Проверка перед коммитом: `npm run typecheck && npm run lint && npm test`; глазами — 390 px, обе темы.

## Review Focus

1. **Нет данных** — у машины нет записей/напоминаний: главная, ТО и статистика показывают понятные пустые состояния
   с действием, а не нули и пустые графики. Тест — Tasks 1, 2, 4.
2. **Напоминание «нет данных»** (ни записи, ни точки отсчёта) — карточка предлагает «Указать, когда делали». Тест — Task 2.
3. **Импорт «Заменить всё»** — только после явного подтверждения с числами из файла; после замены — перезагрузка. Тест — Task 6.
4. **Вход в Яндекс без ClientID в сборке** — поле ClientID, подсказка, где его взять; кнопка входа недоступна без него. Тест — Task 5.
5. **Календарь без прогнозных дат** — напоминания без даты не попадают в `.ics`; если нечего выгружать — сообщение. Тест — Task 2.

---

### Task 1: Главная

**Files:** Modify `src/features/home/HomePage.tsx`; Create `src/features/home/HomePage.test.tsx`, `src/features/home/reminderText.ts`

**Interfaces:**
- Consumes: `useActiveVehicle`, `useVehicles`, `useCurrentOdometer`, `useUpcoming`, `useRecords`, `useCostBreakdown`,
  `useFuelStats` (hooks); `VehicleCard`, `VehicleSwitcher`, `ReminderCard`, `StatTile`, `RecordRow`, `SectionHeader`,
  `SyncStatusBadge`, `PullToRefresh`, `Button` (ui); `Page`, `VehicleGate`, `recordRowProps`, `useLookup`, `useToday` (common);
  `useSyncStatus`, `syncEngine`; `useAttachmentUrl`.
- Produces: `reminderText.ts` — `reminderCardProps(item: UpcomingItem, today: ISODate): ReminderCardProps` (для главной и
  экрана ТО): `kmText` «через 1 200 км» / «просрочено на 300 км», `timeText` «через 112 дней» / «просрочено на 3 дня» /
  «сегодня», `predicted` «≈ 19 октября», `lastText` «последняя: 15.01.2026, 140 000 км».
- Поведение: шапка — «Мой авто» + `SyncStatusBadge` (→ `/settings/sync`); карточка машины (фото, «Skoda Octavia 2016»,
  номер, пробег) с переключателем машин (шторка: машины, «Добавить машину», «Гараж»); «Скоро» — до 3 `ReminderCard compact`
  (→ `/reminders`), если пусто — «Напоминаний нет» и «Настроить»; быстрые кнопки: Заправка, ТО, Расход, Пробег →
  `/record/new/<kind>`; плитки «Потрачено в сентябре» (расходы текущего месяца) и «Расход» (средний за 90 дней или «—»)
  → `/stats`; «Последние записи» — 5 строк (→ `/record/:id`), «Весь журнал»; потянуть вниз — синхронизация.
- [ ] **Step 1: Падающие тесты**: с машиной, записью ТО масла и правилом — «Скоро» показывает «Моторное масло» и «Скоро»;
  плитка месяца показывает сумму записей текущего месяца; пустая машина — «Напоминаний нет» и «Записей пока нет»;
  переключение машины меняет карточку. `reminderCardProps` — юнит-тест текстов.
- [ ] **Step 2–4.** **Step 5: Commit** — `feat(home): home with vehicle card, upcoming, month summary, recent records`

---

### Task 2: ТО и напоминания, календарь

**Files:** Modify `src/features/reminders/RemindersPage.tsx`, `src/features/reminders/ReminderRulePage.tsx`;
Create `src/features/reminders/calendar.ts`, `src/features/reminders/Reminders.test.tsx`

**Interfaces:**
- Consumes: `useReminderStatuses`, `useDeadlines`, `useReminderRule`, `useCatalog`, `useItemHistory` (hooks); `upcoming`,
  `buildIcs`, `CATALOG_ID` (domain); `reminderCardProps` (Task 1); `saveFile` (`sync/saveFile.ts`); `repos.reminders`.
- Produces: `calendar.ts` — `remindersToIcs(items: UpcomingItem[], vehicleName: string, now?: Date): string | null`
  (`null`, если нет ни одной даты; событие на `predictedDate` / `dueDate` / `validUntil`; заголовок «Октавия: Моторное масло»;
  описание «Прогноз по пробегу» или «Срок действия»).
- Поведение списка: группы «Просрочено», «Скоро», «В порядке», «Нет данных»; карточка полная (две полоски, прогноз,
  последняя замена); нажатие: правило → `/reminders/:id`, документ → `/documents/:id`, расход → `/record/:id`;
  «Добавить напоминание» → `/reminders/new`; «В календарь» → `.ics` через `saveFile` (`moy-avto-napominaniya.ics`), нечего —
  тост «Нет дат для календаря»; карточка «Нет данных» — кнопка «Указать, когда делали» → правило.
- Поведение формы правила (`/reminders/new`, `/reminders/:id`): режим «По интервалу» / «К дате» (SegmentedControl;
  в режиме «К дате» правило сохраняется без `itemId`, только с названием и `dueDate`);
  интервал: узел (`CatalogItemPicker`) или своё название, «Каждые … км», «Каждые … мес.» (предзаполнение из каталога,
  хотя бы одно обязательно — «Укажите интервал»); «Последний раз» (дата, пробег) — показывается и подписан «если в журнале нет
  записи»; к дате — название и дата; «Включено»; заметка; «История узла» → `/items/:itemId`; «Удалить».
- [ ] **Step 1: Падающие тесты**: группы по статусам; `remindersToIcs` с двумя датами — 2 VEVENT, без дат — `null`;
  форма создаёт правило с интервалами из каталога; «Укажите интервал» при пустых полях.
- [ ] **Step 2–4.** **Step 5: Commit** — `feat(reminders): reminders list, rule form, calendar export`

---

### Task 3: История узла

**Files:** Modify `src/features/reminders/ItemHistoryPage.tsx`; Create `src/features/reminders/ItemHistoryPage.test.tsx`

**Interfaces:** Consumes `useItemHistory`, `useCatalog`, `useReminderRules`, `useLookup`.
- Поведение: заголовок — название узла; сводка: «Замен: 3», «В среднем каждые 9 800 км / 11 мес.», «Чаще всего: Mann-Filter»;
  список: дата, пробег, бренд · артикул, цена, место, «через 10 000 км · 273 дня после прошлой»; строка → `/record/:id`;
  нет правила — «Напоминать о замене» → `/reminders/new?item=<id>`; пусто — «Замен пока не было».
- [ ] **Step 1: Падающий тест** на сводку и строки. **Step 2–4.** **Step 5: Commit** — `feat(reminders): item replacement history`

---

### Task 4: Статистика

**Files:** Modify `src/features/stats/StatsPage.tsx`; Create `src/features/stats/StatsCharts.tsx`, `src/features/stats/periods.ts`,
`src/features/stats/StatsPage.test.tsx`

**Interfaces:** Consumes `useCostBreakdown`, `useFuelStats`, `useRecords`; `kmDriven`, `costPerKm`, `COST_GROUP_LABELS` (domain);
`ChartCard`, `StatTile`, `SegmentedControl`, `chartTheme` (ui).
- Produces: `periods.ts` — `periodRange(kind: 'month' | 'year' | '12m' | 'all', today: ISODate): { from?: ISODate; to?: ISODate }`.
- Поведение: период «Месяц / Год / 12 мес. / Всё время»; плитки: «Всего», «Цена километра» («11,6 ₽/км» или «—»),
  «Средний расход», «Пробег за период»; графики с таблицами: «По месяцам» (столбцы с разбивкой по группам, цвет группы
  постоянен), «На что уходят деньги» (горизонтальные полосы по убыванию), «Расход топлива» (линия по интервалам);
  «По годам» — таблица. Пусто — «Добавьте первые записи — здесь появится статистика».
- [ ] **Step 1: Падающие тесты**: `periodRange`; плитка «Всего» и таблица групп для набора записей; пустое состояние.
- [ ] **Step 2–4.** Глазами — обе темы (цвета из `chartTheme.readFromCss()`). **Step 5: Commit** — `feat(stats): cost of ownership, per-km cost, fuel consumption charts`

---

### Task 5: «Ещё», настройки, синхронизация

**Files:** Modify `src/features/more/MorePage.tsx`, `src/features/settings/SettingsPage.tsx`, `src/features/settings/SyncSettingsPage.tsx`;
Create `src/features/settings/Settings.test.tsx`

**Interfaces:** Consumes `useTheme` (ui), `yandexAuth`, `syncEngine` (`sync/index.ts`), `useSyncStatus`, `useYandexConnected` (`sync/react.ts`).
- «Ещё»: группы «Машина» (Статистика, Гараж, Документы, Шины), «Справочники» (Места и мастера, Узлы и расходники),
  «Приложение» (Настройки, Синхронизация, Данные и выгрузки, Витрина компонентов).
- «Настройки»: «Тема» — «Как в системе / Светлая / Тёмная»; ссылки на синхронизацию и данные; «О приложении» — версия.
- «Синхронизация»: состояние словами («Не подключено», «Синхронизировано 5 минут назад», «Нет сети — изменения уйдут позже»,
  текст ошибки), «Ждут загрузки: 3 фото»; не подключено: поле ClientID (если в сборке пусто) с подсказкой «oauth.yandex.ru →
  ваше приложение → ClientID», «Войти через Яндекс» (`location.assign(yandexAuth.loginUrl())`, без ClientID — недоступна с
  причиной), «Войти по коду» (открыть `verificationCodeUrl()` в новой вкладке, поле «Код со страницы Яндекса», «Подключить»);
  подключено: «Синхронизировать сейчас», «Выйти» (подтверждение). Блок «Что хранится на Диске»: `Приложения/Мой авто/`.
- [ ] **Step 1: Падающие тесты**: тема переключается; без подключения — «Не подключено» и кнопки входа; без ClientID —
  поле ClientID и недоступная кнопка входа; вход по коду вызывает `yandexAuth.connectWithCode` (мок модуля).
- [ ] **Step 2–4.** **Step 5: Commit** — `feat(settings): more menu, theme, Yandex Disk sync settings`

---

### Task 6: Данные и выгрузки

**Files:** Modify `src/features/settings/DataSettingsPage.tsx`; Create `src/features/settings/DataSettings.test.tsx`

**Interfaces:** Consumes `backupService`, `saveFile`, `backupFileName`, `useYandexConnected`, `todayISO`.
- Поведение: «Выгрузить копию (JSON)», «Выгрузить в Excel» → `saveFile`; «Загрузить копию» — выбор файла → предпросмотр
  («Файл от 25.09.2026: машин 2, записей 148, мест 12…») → «Объединить» (по умолчанию) или «Заменить всё» (второе
  подтверждение «Текущие данные на этом устройстве будут заменены») → тост; после замены — `location.reload()`;
  ошибка файла — текст из `SnapshotError`. «Хранилище»: занято/доступно (`navigator.storage.estimate`), «Защищено от
  очистки: да/нет» (`navigator.storage.persisted`); без Диска — предупреждение «Копии на Диске нет — подключите Яндекс.Диск».
- [ ] **Step 1: Падающие тесты**: выгрузка JSON вызывает `saveFile` с `moy-avto-<дата>.json`; загрузка показывает числа и
  «Объединить» вызывает `importJson(file, 'merge')`; «Заменить всё» требует второго подтверждения; чужой файл — «Это не файл «Мой авто»».
- [ ] **Step 2–4.** **Step 5: Commit** — `feat(settings): JSON/Excel export, backup import with merge or replace`

---

## Отчёт агента

Задачи, коммиты, red/green, скриншоты главной/ТО/статистики в обеих темах, чего не хватило в `ui`/hooks/common/sync;
вывод `npm run typecheck && npm run lint && npm test`.
