# Волна 2b-C · гараж, места и мастера, документы, шины, каталог: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Загрузить `superpowers:test-driven-development` и `frontend-design`.

**Goal:** Справочные экраны: гараж и карточка машины (паспорт жидкостей, покупка/продажа, стоимость владения, архив),
места и мастера (визиты, всего потрачено, средний чек), документы со сроками и фото, комплекты шин с пробегом,
каталог узлов и расходников.

**Architecture:** `src/features/{garage,vehicle,places,documents,tires,catalog}` (кроме формы машины — она в 2b-A)
из `src/ui`, `src/features/common`, хуков `src/db/hooks.ts`, репозиториев, расчётов `src/domain`.

**Tech Stack:** React 19, React Router 8, Testing Library + fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-09-25-myauto-design.md` (разделы 4, 5, 7)

**Зона агента:** `src/features/garage/**`, `src/features/vehicle/VehiclePage.tsx` (+ `src/features/vehicle/details/**`),
`src/features/places/**`, `src/features/documents/**`, `src/features/tires/**`, `src/features/catalog/**`.
Форма машины (`VehicleFormPage.tsx`, `vehicle/form/**`) — зона 2b-A: ссылаешься на маршрут `/vehicle/:id/edit`.

## Global Constraints

- Текст — по-русски; числа и даты — через `domain/format.ts`; телефон — ссылка `tel:`; адрес — ссылка на Яндекс.Карты
  (`https://yandex.ru/maps/?text=<адрес>`), если нет своего `url`.
- Удаление — мягкое с «Отменить»; встроенные позиции каталога не удаляются, только скрываются.
- Проверка перед коммитом: `npm run typecheck && npm run lint && npm test`; глазами — 390 px, обе темы.

## Review Focus

1. **Место с визитами на разных машинах** — карточка места считает визиты по всем машинам, помечая машину. Тест — Task 2.
2. **Удаление места, на которое ссылаются записи** — записи остаются, в них место показывается как «Место удалено»,
   а не пропадает строка. Тест — Task 2.
3. **Скрытый узел каталога** — пропадает из подсказок, но история замен по нему сохраняется и открывается. Тест — Task 5.
4. **Проданная машина** — в архиве, не активна, её записи и статистика доступны из карточки. Тест — Task 1.
5. **Два комплекта «установлен» одновременно** — установка нового комплекта переводит прежний в «на хранении». Тест — Task 4.

---

### Task 1: Гараж и карточка машины

**Files:** Modify `src/features/garage/GaragePage.tsx`, `src/features/vehicle/VehiclePage.tsx`;
Create `src/features/vehicle/details/SpecsList.tsx`, `src/features/garage/Garage.test.tsx`

**Interfaces:** Consumes `useVehicles({ includeArchived: true })`, `useVehicle`, `useActiveVehicle`, `useCurrentOdometer`,
`useCostBreakdown`, `useAttachmentUrl`; `repos.vehicles`; `FUEL_TYPE_LABELS`, `TRANSMISSION_LABELS`, `DRIVE_LABELS`,
`FLUID_KIND_LABELS` (common/labels).
- Гараж: «Мои машины» (активная помечена) и «Архив» (проданные) — строка: фото/значок, название, «Skoda Octavia 2016 · А123ВС 77»,
  пробег; «Добавить машину» → `/vehicle/new`.
- Карточка: фото, название, характеристики (марка, модель, поколение, год, VIN моноширинным, госномер, двигатель, КПП,
  привод, бак, топливо, размеры шин); «Жидкости» — вид, спецификация, объём; «В архив» для активной машины делает
  активной первую неархивную (если есть); «Владение» — куплена (дата, пробег, цена),
  продана (дата, пробег, цена), «Расходы за всё время», «Итого с покупкой и продажей» (расходы + покупка − продажа),
  «Проехал» (км за время владения); действия: «Изменить» → `/vehicle/:id/edit`, «Сделать активной», «В архив» / «Вернуть
  из архива», ссылки «Документы», «Шины», «Журнал».
- [ ] **Step 1: Падающие тесты**: архивная машина в разделе «Архив»; «Итого с покупкой и продажей» = расходы + покупка − продажа;
  «Сделать активной» меняет активную; «В архив» ставит `archived: true`.
- [ ] **Step 2–4.** **Step 5: Commit** — `feat(garage): garage list and vehicle details with ownership totals`

---

### Task 2: Места и мастера

**Files:** Modify `src/features/places/PlacesPage.tsx`, `PlacePage.tsx`, `MasterPage.tsx`; Create `src/features/places/Places.test.tsx`

**Interfaces:** Consumes `usePlaces`, `usePlace`, `useMasters`, `useMaster`, `usePlaceStats`, `useMasterStats`,
`useRecords('all', { placeId })` / `useRecords('all', { masterId })` (визиты по всем машинам; место совпадает и как место
записи, и как «где купил» у запчасти), `useVehicles`, `recordRowProps`, `useSoftDelete`; `Rating`, `SegmentedControl`.
- Список: «Места / Мастера»; места группами по виду (`PLACE_KIND_LABELS`), строка: название, «12 визитов · 84 300 ₽», оценка;
  мастера: имя, место, специализация; «Добавить».
- Карточка места (`/places/new`, `/places/:id`): поля (вид, название — обяз., адрес, телефон, ссылка, оценка, заметка),
  статистика (визиты, всего потрачено, средний чек, последний визит), мастера этого места, визиты (строки журнала с
  названием машины в подзаголовке), «Удалить».
- Карточка мастера: поля (имя — обяз., место, телефон, специализация, оценка, заметка), статистика и визиты по `masterId`
  (записи, где мастер указан у записи или у строки работ), «Удалить».
- Удалённое место в записях: `recordSubtitle` показывает «Место удалено» — если `useLookup` не знает id, `Page` записи
  (2b-A) делает то же; здесь — тест, что записи не пропадают из журнала после удаления места.
- [ ] **Step 1: Падающие тесты**: статистика места по двум машинам; мастера фильтруются по месту; создание места с пустым названием —
  «Добавьте название»; удаление места не удаляет записи.
- [ ] **Step 2–4.** **Step 5: Commit** — `feat(places): places and masters with visits and spend`

---

### Task 3: Документы

**Files:** Modify `src/features/documents/DocumentsPage.tsx`, `DocumentPage.tsx`; Create `src/features/documents/Documents.test.tsx`

**Interfaces:** Consumes `useDocuments`, `useDocument`, `useDeadlines`, `AttachmentsField`, `useDraftAttachments`, `DOCUMENT_TITLES`,
`repos.documents`, `useSoftDelete`.
- Список (активная машина): строка — вид, номер, «до 07.10.2026» + `StatusPill` (скоро/просрочено/в порядке; без срока — без
  плашки), число вложений; «Добавить документ».
- Карточка (`/documents/new`, `/documents/:id`): вид, название (для «Другое»), номер, выдан, действует до, заметка, фото
  (СТС с двух сторон и т. п.); «Удалить».
- [ ] **Step 1: Падающие тесты**: ОСАГО с датой через 12 дней — «Скоро»; сохранение документа; фото черновика удаляются при отмене.
- [ ] **Step 2–4.** **Step 5: Commit** — `feat(documents): vehicle documents with validity and photos`

---

### Task 4: Шины

**Files:** Modify `src/features/tires/TiresPage.tsx`, `TireSetPage.tsx`; Create `src/features/tires/Tires.test.tsx`

**Interfaces:** Consumes `useTireSets`, `useTireSet`, `useTireSetMileage`, `useRecords` (записи со `tireSwap` этого комплекта),
`AttachmentsField`, `TIRE_SEASON_LABELS`, `TIRE_STATUS_LABELS`, `repos.tireSets`.
- Список: «Установлены», «На хранении», «Списаны»; строка: «Nokian Hakkapeliitta 10 · 205/55 R16», сезон, шипы, DOT
  («2023, 24 неделя»), пробег комплекта; «Добавить комплект».
- Карточка: сезон, бренд, модель, размер, DOT, шипы, количество, куплены (дата, цена), где хранятся, состояние, остаток
  протектора (мм), заметка, фото; «История» — записи смены шин с этим комплектом (→ `/record/:id`); пробег;
  «Отметить установленным» — ставит `installed`, прежний установленный комплект этой машины → `stored`.
- [ ] **Step 1: Падающие тесты**: пробег комплекта из записей смены шин; «Отметить установленным» переводит прежний в «На хранении»;
  DOT «2423» показывается как «2023, 24 неделя».
- [ ] **Step 2–4.** **Step 5: Commit** — `feat(tires): tire sets with mileage and install status`

---

### Task 5: Каталог узлов и расходников

**Files:** Modify `src/features/catalog/CatalogPage.tsx`; Create `src/features/catalog/Catalog.test.tsx`

**Interfaces:** Consumes `useCatalog({ includeHidden: true })`, `ITEM_GROUP_LABELS`, `repos.catalog`.
- Поведение: группы (`ITEM_GROUP_LABELS`); строка: название, «каждые 10 000 км / 12 мес.» или «без интервала»,
  отметка «скрыт»; нажатие — шторка: название (у встроенных — только чтение), группа, интервал км/мес. по умолчанию,
  «Скрыть из подсказок» (встроенные) / «Удалить» (свои); «Добавить свой узел»; переключатель «Показывать скрытые»;
  строка ведёт и на историю узла (`/items/:id`).
- [ ] **Step 1: Падающие тесты**: скрытие встроенного узла ставит `hidden: true` и убирает его из списка без «Показывать скрытые»;
  свой узел создаётся с `builtin: false`; у встроенного нет «Удалить».
- [ ] **Step 2–4.** **Step 5: Commit** — `feat(catalog): maintenance catalog with custom items and hiding`

---

## Отчёт агента

Задачи, коммиты, red/green, скриншоты (обе темы), чего не хватило в `ui`/hooks/common; вывод `npm run typecheck && npm run lint && npm test`.
