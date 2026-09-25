# Волна 1 — фактическое поведение API (для экранов волны 2)

Сигнатуры смотри в коде: `src/ui/index.ts`, `src/db/hooks.ts`, `src/db/repos.ts`, `src/domain/**`, `src/sync/index.ts`,
`src/sync/react.ts`, `src/sync/saveFile.ts`. Здесь — только то, чего из сигнатур не видно.

## ui

- `ListGroup` оборачивает каждого ребёнка в `<li>`: передавай одну строку на ребёнка (фрагмент станет одной строкой).
- `BottomSheet` — всегда передавай `title` (это имя диалога для скринридера).
- `Combobox`: выбор вызывает `onSelect(option)`, затем `onQueryChange(option.label)`; набор после выбора вызывает
  `onSelect(null)`. Не сбрасывай выбор внутри `onQueryChange`. «Создать «…»» скрыт при точном совпадении.
- `MoneyField`: `onChange(kopecks | undefined)` на каждый разбираемый ввод; ошибка и группировка разрядов — при уходе
  с поля; кнопка «+» вставляет плюс в выражение. Значение — копейки.
- `NumberField` с `decimals={0}` открывает цифровую клавиатуру; `min` применяется при уходе с поля.
- `Field`/своё тело поля: пробрасывай `id` и `aria-*` в сам `<input>`.
- `BottomTabBar.renderLink(item, children)` — верни ссылку (`NavLink`), выставь `aria-current`; у «Главной» `end`.
- `SectionHeader`, `MonthHeader`, `RepeatableList`, `ChartCard` рендерят `<h2>`.
- `SyncStatusBadge` — тип состояния бери как `SyncStatusBadgeProps['state']`.
- `chartTheme.readFromCss(el?)` — перечитывай цвета при смене темы (`useTheme().resolved` в зависимостях).
- `PullToRefresh` работает от прокрутки документа — страница должна прокручиваться документом, не внутренним контейнером.
- `Toast` стоит над нижней панелью; отступ тоста выставляют оболочка и `FormPage` (волна 2a) — экранам ничего делать не нужно.
- Тема: `useTheme()` из `src/ui`, хранится в `localStorage['myauto.theme']`.

## domain / db

- `useRecords(vehicleId, filter)`: `undefined` — «ждём id машины» (вернёт `undefined`), `'all'` — все машины.
  Фильтр по месту находит и место записи, и «где купил» у запчасти; визиты — только ТО, заправки, расходы.
- Записи, напоминания и прочее удалённых машин в `'all'`, статистике мест/мастеров и подсказках брендов не участвуют.
- `kmDriven` / `costPerKm` требуют ВСЕ записи машины (не отфильтрованные по периоду) — для интерполяции на границах.
- `checkOdometer` → `lessThanEarlier` | `greaterThanLater` | `sameDayGap` (разница > 2000 км в тот же день).
- Заправки одного дня упорядочены по времени ввода (`createdAt`).
- `lineTotal(line)` (`src/domain/calc/lines.ts`) — сумма строки с тем же округлением, что в статистике.
- Подписи категорий расходов и документов — `src/domain/labels.ts` (единый источник).
- Репозитории: `create/update/remove/restore` сами ставят `updatedAt` и запускают синхронизацию; `remove` — мягкое.

## sync

- `initSync()` уже вызывается приложением; экраны используют `syncEngine.syncNow()`, `useSyncStatus()`,
  `useYandexConnected()`, `useLoginError()`, `yandexAuth.loginUrl()` (вызывать только в обработчике нажатия — пишет новый
  `state`), `yandexAuth.connectWithCode(text)`, `yandexAuth.disconnect()`.
- `attachmentStore.addFile(owner, file)` бросает русскую ошибку для неподдерживаемого файла или PDF > 20 МБ — покажи тостом.
- `useAttachmentUrl(att, 'thumb' | 'orig')` → `undefined` (грузится) | `null` (нет) | object URL (сам отзывается).
- Удалённые вложения стираются с Диска через 24 ч — «Отменить» и восстановление успевают вернуть файл.
- `backupService.importJson(file, 'replace')` помечает удалёнными строки, которых нет в файле; перезагрузи страницу после замены.
- `saveFile(blob, name)`, `backupFileName('json' | 'xlsx', today)` — из `src/sync/saveFile.ts`.

## features/common (волна 2a)

- Импорт — только из `src/features/common/index.ts`. Там же `useGoBack`, `MISSING_PLACE` и типы.
- `FormPage`: «Сохранить» — крупная кнопка внизу; `onSave` может вернуть путь — тогда форма заменяется этим экраном
  (`navigate(path, { replace: true })`), иначе «назад». Ошибка из `onSave` — тостом, форма остаётся.
- `useLookup()` содержит и удалённые места/мастеров/узлы — имена в старых записях не пропадают; неизвестный id → «Место удалено».
- При правке существующей записи вложения сохраняются сразу (`AttachmentsField`), черновые — только у новых записей.
- `ActionSheet` рисует кнопки (не `menuitem`).
