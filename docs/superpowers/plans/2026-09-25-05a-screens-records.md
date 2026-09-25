# Волна 2b-A · записи, журнал, машина, онбординг: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Загрузить `superpowers:test-driven-development` и `frontend-design`.

**Goal:** Самые частые действия владельца: быстрый ввод записей пяти видов (включая ТО с запчастями, подсказкой
«в прошлый раз» и фото), карточка записи, журнал с поиском и фильтрами, форма машины с VIN-декодером, первый запуск.

**Architecture:** Экраны в `src/features/{records,journal,vehicle,onboarding}` из компонентов `src/ui`, общих частей
`src/features/common` (волна 2a), хуков `src/db/hooks.ts`, репозиториев `src/db/repos.ts`, расчётов `src/domain`,
служб `src/sync`. Состояние формы — локальный `useReducer`; запись в базу — только при «Сохранить».

**Tech Stack:** React 19, React Router 8, Testing Library + fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-09-25-myauto-design.md` (разделы 1 — критерий «ТО с 5 запчастями < 2 мин», 4, 7, 7.1, 7.2)

**Зона агента:** `src/features/records/**`, `src/features/journal/**`, `src/features/vehicle/VehicleFormPage.tsx`
(+ `src/features/vehicle/form/**`), `src/features/onboarding/**`. Остальное только используешь.

## Global Constraints

- Текст — по-русски, коротко; числа и даты — через `domain/format.ts`; суммы — в копейках.
- Каждое поле доступно по подписи (`getByLabelText`); цели касания ≥ 44 px (обеспечивает `ui`).
- Ошибки валидации — у поля, по-русски: «Укажите пробег», «Укажите сумму», «Добавьте название», «Укажите литры и цену».
- Удаление — мягкое, с тостом «Отменить» (`useSoftDelete`).
- Проверка перед коммитом: `npm run typecheck && npm run lint && npm test`; глазами — `npm run dev`, 390 px, обе темы.

## Review Focus

1. **Ввод задним числом** — после сохранения записи с датой в прошлом следующая новая запись предлагает эту же дату
   (чип «Как в прошлой записи: 12.03.2024»), а не только «сегодня». Тест — Task 1.
2. **Пробег меньше предыдущего по дате** — предупреждение у поля (не блокирует сохранение). Тест — Task 1.
3. **Итог ТО введён вручную** — перестаёт пересчитываться от строк, пока пользователь не нажмёт «Считать по строкам». Тест — Task 2.
4. **Отмена формы с фото** — вложения черновика удаляются. Тест — Task 2.
5. **VIN с ошибкой** — ошибка у поля, декодирование не заполняет форму мусором; онлайн-уточнение без сети — тихо. Тест — Task 5.

---

### Task 1: Общая часть формы записи и простые виды (пробег, заметка, расход)

**Files:** Create `src/features/records/RecordFormPage.tsx` (заменить заглушку), `src/features/records/form/useRecordForm.ts`,
`src/features/records/form/CommonFields.tsx`, `src/features/records/form/ExpenseFields.tsx`, `src/features/records/form/NoteFields.tsx`,
`src/features/records/form/lastDate.ts`, `src/features/records/RecordFormPage.test.tsx`

**Interfaces:**
- Consumes: `FormPage`, `PlacePicker`, `AttachmentsField`, `useDraftAttachments`, `VehicleGate`, `useToday` (common);
  `useCurrentOdometer`, `useRecord`, `useRecords` (hooks); `checkOdometer` (domain); `DateField`, `OdometerField`,
  `MoneyField`, `TextField`, `TextArea`, `Select` (ui); `repos.records`.
- Produces: маршруты `/record/new/:kind` (kind ∈ service|fuel|expense|odometer|note, иначе «Страница не найдена») и
  `/record/:id/edit`; `lastDate.ts`: `rememberDate(d: ISODate)`, `suggestedDate(today: ISODate): ISODate | null`
  (sessionStorage `myauto.lastDate`; только если отличается от `today`).
- Поведение: дата по умолчанию — сегодня, чипы «Сегодня», «Вчера» и (если есть) «Как в прошлой записи: ДД.ММ.ГГГГ»;
  пробег предзаполнен текущим (`useCurrentOdometer`) для новых записей, кроме заметки; предупреждение хронологии
  (`checkOdometer`) — «Раньше, 01.02.2026, было 1 500 км» (`lessThanEarlier`) / «Позже, 01.03.2026, было 2 000 км»
  (`greaterThanLater`) / «В тот же день, 01.02.2026, было 150 000 км» (`sameDayGap`); сохранение → `navigate('/record/<id>', { replace: true })`.
  Расход: категория (все `ExpenseCategory`), название, сумма (обяз.), место, для `osago|kasko|inspection` — «Действует с/до»
  и номер полиса. Заметка: название (обяз.), текст, пробег необязателен. Пробег: только дата, пробег (обяз.), заметка.

- [ ] **Step 1: Падающие тесты** (рендер через `createAppRouter({ initialPath })` + `AppProviders`, база с машиной):

```tsx
test('пробег: сохраняется и открывается карточка', async () => {
  const router = renderAt('/record/new/odometer')
  await userEvent.clear(await screen.findByLabelText('Пробег'))
  await userEvent.type(screen.getByLabelText('Пробег'), '148320')
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/record\/[0-9a-f-]{36}$/))
  const [r] = await db.records.toArray()
  expect(r).toMatchObject({ kind: 'odometer', odometer: 148320, total: 0, vehicleId: vehicle.id })
})

test('расход без суммы — ошибка у поля', async () => {
  renderAt('/record/new/expense')
  await userEvent.click(await screen.findByRole('button', { name: 'Сохранить' }))
  expect(await screen.findByText('Укажите сумму')).toBeInTheDocument()
  expect(await db.records.count()).toBe(0)
})

test('ОСАГО: поля срока действия', async () => {
  renderAt('/record/new/expense')
  await userEvent.selectOptions(await screen.findByLabelText('Категория'), 'osago')
  expect(screen.getByLabelText('Действует до')).toBeInTheDocument()
})

test('пробег меньше более ранней записи — предупреждение', async () => {
  await repos.records.create({ vehicleId: vehicle.id, kind: 'odometer', date: '2026-02-01', odometer: 1500, total: 0 })
  renderAt('/record/new/odometer')
  const dateInput = await screen.findByLabelText('Дата')
  await userEvent.clear(dateInput); await userEvent.type(dateInput, '2026-02-15')
  await userEvent.clear(screen.getByLabelText('Пробег')); await userEvent.type(screen.getByLabelText('Пробег'), '1400')
  expect(await screen.findByText(/Раньше, 01\.02\.2026, было 1\s500\sкм/)).toBeInTheDocument()
})

test('дата прошлой записи предлагается следующей', async () => {
  sessionStorage.clear()
  const first = renderAt('/record/new/odometer')
  const date = await screen.findByLabelText('Дата')
  await userEvent.clear(date); await userEvent.type(date, '2024-03-12')
  await userEvent.clear(screen.getByLabelText('Пробег')); await userEvent.type(screen.getByLabelText('Пробег'), '90000')
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(() => expect(first.state.location.pathname).toMatch(/^\/record\//))
  cleanup()
  renderAt('/record/new/note')
  await userEvent.click(await screen.findByRole('button', { name: 'Как в прошлой записи: 12.03.2024' }))
  expect(screen.getByLabelText('Дата')).toHaveValue('2024-03-12')
})
```
`renderAt(path)` (роутер `createAppRouter({ initialPath })` в `AppProviders`, возвращает роутер) и `vehicle` (машина,
созданная в `beforeEach`, активная) — общий хелпер `src/features/records/testUtils.tsx`; `cleanup` — из Testing Library.

- [ ] **Step 2–4: red → реализация → green.** **Step 5: Commit** — `feat(records): record form shell, odometer, note and expense forms`

---

### Task 2: Форма ТО и ремонта

**Files:** Create `src/features/records/form/ServiceFields.tsx`, `src/features/records/form/WorkSheet.tsx`,
`src/features/records/form/PartSheet.tsx`, `src/features/records/form/serviceTotals.ts`, `src/features/records/ServiceForm.test.tsx`

**Interfaces:**
- Consumes: `RepeatableList`, `LineItemRow`, `BottomSheet`, `Combobox`, `MoneyField`, `NumberField`, `Switch`, `Select` (ui);
  `CatalogItemPicker`, `MasterPicker`, `PlacePicker` (common); `useLastPart`, `useBrandSuggestions`, `useRecords`, `useTireSets` (hooks).
- Produces: `serviceTotals.ts`: `linesTotal(works: WorkLine[], parts: PartLine[]): Kopecks` — сумма `lineTotal` из
  `src/domain/calc/lines.ts` (то же округление, что в статистике и истории узла).
- Поведение:
  - Название — комбобокс: прошлые названия ТО этой машины по частоте + «ТО-N» (N = число прошлых записей `maintenance` + 1).
  - Тип работ, место (виды `service`, `tire`), мастер (мастера места), «Делал сам» (скрывает мастера).
  - Работы и запчасти — списки строк; строка открывается в шторке. Запчасть: узел (`CatalogItemPicker`) → если есть
    `useLastPart` — подсказка «В прошлый раз: Mann-Filter W 712/95, 650 ₽» (одно касание заполняет бренд, артикул, цену, ед.);
    название (по умолчанию — имя узла), бренд (комбобокс `useBrandSuggestions`), артикул, кол-во + ед., цена за ед., «Купил сам»,
    где купил. Работа: узел, название, цена, мастер.
  - Итог = `linesTotal` пока пользователь не изменил итог вручную; после ручной правки — подпись «Итог по строкам: …» и
    кнопка «Считать по строкам».
  - «Повторить прошлое ТО» (если есть прошлая запись `service` этой машины): копирует строки последней записи с тем же
    названием, иначе последней того же типа; id строк новые; цены сохраняются.
  - Тип «Шины» показывает «Установлен комплект» / «Снят комплект» (`useTireSets`); если выбран хотя бы один комплект,
    пробег обязателен («Укажите пробег — без него не посчитать пробег шин»).
  - Гарантия: до даты и/или до пробега.
  - Фото: `AttachmentsField` с `useDraftAttachments('record')`; «Назад» без сохранения → `discard()`.
  - Сохранение: название обязательно («Добавьте название»).

- [ ] **Step 1: Падающие тесты** — `ServiceForm.test.tsx`: (1) ТО с двумя запчастями и работой: итог = сумма строк,
  сохраняется с правильными строками; (2) подсказка «в прошлый раз» появляется для узла с историей и заполняет бренд,
  артикул, цену; (3) ручной итог не пересчитывается, «Считать по строкам» возвращает авторасчёт; (4) «Повторить прошлое ТО»
  копирует строки с новыми id; (5) отмена формы после добавления фото вызывает `discard` (мок `attachmentStore`).

- [ ] **Step 2–4: red → реализация → green.** Проверить руками сценарий «ТО с 5 запчастями и фото» на 390 px — засечь время.
- [ ] **Step 5: Commit** — `feat(records): service form with parts, works, last-time suggestions, totals`

---

### Task 3: Форма заправки

**Files:** Create `src/features/records/form/FuelFields.tsx`, `src/features/records/FuelForm.test.tsx`

**Interfaces:** Consumes `solveFuelTriple` (domain), `useVehicle`; Produces — вид `fuel` формы.
- Поведение: литры, цена за литр, сумма — два любых заполненных вычисляют третье (последнее изменённое поле не
  перезаписывается); «Полный бак» (по умолчанию да), «Пропустил заправку перед этой»; марка топлива (по умолчанию
  `vehicle.defaultFuelGrade`, подсказки АИ-92/АИ-95/АИ-98/ДТ/Газ); АЗС (`PlacePicker kinds={['fuel']}`); пробег обязателен
  («Укажите пробег»); без литров или цены — «Укажите литры и цену».
- [ ] **Step 1: Падающие тесты**: 40 л × 56,90 ₽ → сумма «2 276 ₽»; сумма 2 500 ₽ и литры 42,37 → цена 59 ₽; без пробега — ошибка;
  сохранённая запись `{ liters: 40, pricePerLiter: 5690, total: 227600, fullTank: true, missedBefore: false }`.
- [ ] **Step 2–4: red → green.** **Step 5: Commit** — `feat(records): fuel form with two-of-three calculation`

---

### Task 4: Карточка записи

**Files:** Modify `src/features/records/RecordPage.tsx`; Create `src/features/records/RecordPage.test.tsx`

**Interfaces:** Consumes `useRecord`, `useLookup`, `useFuelStats`, `AttachmentsField`, `useSoftDelete`, `repos.records.duplicate`.
- Поведение: шапка — значок вида, заголовок (`recordTitle`), дата (длинная), пробег, сумма; место и мастер — строки-ссылки
  (`/places/:id`, `/masters/:id`); ТО — списки работ и запчастей (название, бренд · артикул · кол-во, цена), итог и сумма
  строк, гарантия, смена шин; заправка — литры, цена, полный бак, расход интервала, заканчивающегося этой заправкой
  («Расход с прошлого полного бака: 7,8 л/100 км»); расход — категория, срок действия, номер; заметка — текст;
  вложения; действия: «Изменить» → `/record/:id/edit`, «Повторить» → дубликат с сегодняшней датой → его форма правки,
  «Удалить» → подтверждение `Dialog` «Удалить запись?» → мягкое удаление → назад → тост «Запись удалена» / «Отменить».
  Удалённая или несуществующая запись → `EmptyState` «Запись не найдена».
- [ ] **Step 1: Падающие тесты**: запчасть показывает «Mann-Filter · W 712/95»; расход заправки выводится; удаление + «Отменить»
  восстанавливает; «Повторить» создаёт копию и открывает её правку.
- [ ] **Step 2–4.** **Step 5: Commit** — `feat(records): record details with duplicate and undoable delete`

---

### Task 5: Форма машины с VIN-декодером

**Files:** Modify `src/features/vehicle/VehicleFormPage.tsx`; Create `src/features/vehicle/form/VehicleForm.tsx`,
`src/features/vehicle/form/VinField.tsx`, `src/features/vehicle/form/FluidsEditor.tsx`, `src/features/vehicle/VehicleForm.test.tsx`

**Interfaces:**
- Consumes: `decodeVin`, `applyVinToVehicle`, `fetchNhtsa` (domain/vin); `repos.vehicles` (`create`, `update`, `nextOrder`);
  `useActiveVehicle().setActive`; `AttachmentsField`/`attachmentStore` для фото машины.
- Produces: `VehicleForm({ initial?: Vehicle; onSaved(v: Vehicle): void; submitLabel?: string })` — используется
  страницей `/vehicle/new`, `/vehicle/:id/edit` и онбордингом.
- Поведение: название (по умолчанию «Марка Модель»), VIN (верхний регистр, без пробелов; при 17 символах — офлайн-декод:
  найденное показывается строкой «Lada · Россия · 2000» и кнопкой «Заполнить»; ошибки — у поля; «Уточнить онлайн» —
  `fetchNhtsa`, спиннер, `null` → «Онлайн ничего не нашлось»), марка, модель (обяз.), поколение, год, госномер,
  цвет, кузов; двигатель: топливо, объём, мощность, код; КПП, привод, объём бака, марка топлива по умолчанию;
  покупка: дата, пробег, цена; продажа: дата, пробег, цена (дата продажи → `archived: true`, подсказка «Машина уйдёт в архив»);
  жидкости — список (вид, спецификация, объём); размеры шин перед/зад; фото (одно, `photoAttachmentId`); заметка.
  Новая машина → `order = nextOrder()`, становится активной.
- [ ] **Step 1: Падающие тесты**: VIN `XTA210990Y2765432` → «Заполнить» ставит марку «Lada» и год 2000, не трогая введённую модель;
  VIN с `O` → «В VIN не бывает букв I, O, Q»; «Уточнить онлайн» с `fetchNhtsa` → `null` показывает «Онлайн ничего не нашлось»
  (мок модуля); сохранение новой машины делает её активной; дата продажи → `archived: true`.
- [ ] **Step 2–4.** **Step 5: Commit** — `feat(vehicle): vehicle form with VIN decoder, fluids and photo`

---

### Task 6: Журнал

**Files:** Modify `src/features/journal/JournalPage.tsx`; Create `src/features/journal/JournalFilters.tsx`,
`src/features/journal/groupByMonth.ts`, `src/features/journal/JournalPage.test.tsx`

**Interfaces:**
- Consumes: `useRecords(vehicleId, filter)`, `useLookup`, `recordRowProps`, `useSoftDelete`, `repos.records.duplicate`,
  `syncEngine.syncNow` (`sync/index.ts`); `SearchField`, `Chip`, `MonthHeader`, `RecordRow`, `SwipeRow`, `PullToRefresh`,
  `BottomSheet`, `EmptyState` (ui).
- Produces: `groupByMonth(records: CarRecord[]): { month: string; total: Kopecks; records: CarRecord[] }[]`.
- Поведение: активная машина; поиск (с задержкой 200 мс); чипы видов записей (множественный выбор); кнопка «Фильтры»
  с числом активных — шторка: узел (`CatalogItemPicker`), место (`PlacePicker`), период (Этот месяц / 3 месяца / Год /
  Всё время / Свой); группы по месяцам с итогом; строка → `/record/:id`; свайп влево — «Удалить» (с «Отменить»),
  вправо — «Повторить» (дубликат на сегодня → форма правки); потянуть вниз — синхронизация; пусто — «Записей пока нет»
  с кнопкой «Добавить запись»; ничего не найдено — «Ничего не найдено» и «Сбросить фильтры».
- [ ] **Step 1: Падающие тесты**: `groupByMonth` (порядок и итоги); поиск по артикулу находит запись; чип «Заправка»
  оставляет только заправки; удаление свайп-меню + «Отменить».
- [ ] **Step 2–4.** **Step 5: Commit** — `feat(journal): monthly journal with search, filters, swipe actions`

---

### Task 7: Онбординг

**Files:** Modify `src/features/onboarding/OnboardingPage.tsx`; Create `src/features/onboarding/OnboardingPage.test.tsx`

**Interfaces:** Consumes `VehicleForm` (Task 5), `STARTER_REMINDER_ITEM_IDS`, `BUILTIN_CATALOG` (domain/catalog), `repos.reminders`,
`yandexAuth` (`sync/index.ts`).
- Шаги: (1) «Добавьте машину» — `VehicleForm` с кнопкой «Дальше»; (2) «Что напоминать» — чекбоксы стартовых узлов
  (все отмечены) с интервалами из каталога и полем «Когда делали последний раз» (пробег, необязательно) →
  `ReminderRule` с `baseline`; (3) «Синхронизация» — «Подключить Яндекс.Диск» (переход на `yandexAuth.loginUrl()`,
  если есть ClientID, иначе на `/settings/sync`) или «Позже» → `/`.
- [ ] **Step 1: Падающие тесты**: полный проход без Диска создаёт машину и 8 правил; снятый чекбокс не создаёт правило;
  «Позже» ведёт на главную.
- [ ] **Step 2–4.** **Step 5: Commit** — `feat(onboarding): first-run flow — vehicle, starter reminders, sync`

---

## Отчёт агента

Задачи, коммиты, red/green, время ручного сценария «ТО с 5 запчастями и фото», скриншоты форм (обе темы),
чего не хватило в `ui`/hooks/common; вывод `npm run typecheck && npm run lint && npm test`.
