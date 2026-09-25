# Бэклог: отложенные мелочи

Найдены ревьюерами, признаны неблокирующими (итоговое ревью разобрало каждую: «оставить» или «исправить вскоре»).

## Волна 0 · каркас и контракты

- Wave0: minor (deferred): M1 dynamic import() bypasses layer lint — accept & document.
- Wave0: minor (deferred): M5 sameSnapshot fingerprint ignores content (same-ms identical-updatedAt divergence) — negligible.
- Wave0: minor (deferred): M8 no Russian router errorElement — scheduled into plan 04-shell.
- Wave0: minor (deferred): M12 SYNC_TABLES duplicates TABLE_NAMES (plan-mandated, test-guarded).
- Wave0: minor (deferred): M13 CI permissions per-job, cancel-in-progress on main, e2e not testing /myAuto/ base — wave 3.
- Wave0: minor (deferred): M14 dates edge cases (years <100, NaN) — accept.
- Wave0: minor (deferred): merge duplicate-id test uses [] on one side (symmetric by construction); clock `last` module singleton shared across tests; blob round-trip fidelity not asserted under fake-indexeddb.

## Волна 1 · расчёты и данные

- domain: minor (deferred): M10 full tank without odometer resets chain (form requires odometer); M11 empty 0 ₽ month for a zero service.
- domain: minor (deferred): same-day full fills entered in reverse odometer order → negative km interval skipped (form warning later); kmDriven/costPerKm need ALL vehicle records (not pre-filtered) — tell wave-2 callers; sync/excel.ts keeps its own expense labels ("Платная дорога" vs "Платные дороги") → import domain/labels in wave 3; place-filtered journal hides odometer/note records by design.

## Волна 1 · дизайн-система

- ui: minor (deferred): SyncStatusBadge details only in title; field-sizing unsupported in Safari; Fontsource precaches all subsets; ModalLayer scroll lock only on body; non-overridable Russian strings (plan-level).
- ui: minor (deferred): isFocusable ignores inherited visibility:hidden; minors.test mutates scrollIntoView without restore.

## Волна 1 · синхронизация

- sync: minor (deferred): sync.cleanedAttachments meta list never pruned.
- sync: minor (deferred): delete-during-upload then undo leaves blobs pending:0 without uploadedAt (reset pending in same txn) — wave 3.
- sync: minor (deferred): lock fallback reruns cycle when the cycle itself rejects; hung cycle holding navigator.locks stalls all tabs (add timeout) — wave 3 live check.
- sync: minor (deferred): useAttachmentUrl keeps old URL until unmount when att → undefined; redirect-path 401 wording; Disk-only rows survive replace; lastSyncAt skipped on backup NoSpace; init() triggers early sync; useLoginError test leaks clientId.

## Волна 2a · оболочка

- shell: minor (deferred): Combobox ё/е exact-match (ui zone); startup sweep of ownerless attachments older than 24 h (wave 3).
- shell: minor (deferred): download failure reuses «Не получилось сохранить…» text; back-gesture race during in-flight save (wave 3).

## Волна 2b · записи и журнал

- records: minor (deferred): PlacePicker allowCreate in filter sheet (common prop, wave 3); FormPage backHidden/icon props + h1 focus outline (common, wave 3); attachment counts hook to db/hooks (wave 3).
- records: minor (deferred): copy form replaced by blank form if source deleted mid-edit; silent fallback for missing ?from; journal search effect re-created with setParams; NumberField lacks aria-label (ui); repos.records.duplicate now dead code.

## Волна 2b · главная, ТО, статистика, настройки

- overview: minor (deferred): LIGHT_SURFACE hard-coded + chartTheme lacks surface (ui); formatting helpers outside format.ts (move in wave 3); SegmentedControl sizing overrides; cross-feature helpers to common; «Нет данных» card styling needs ReminderCard action slot (ui); api-notes chart re-read advice outdated.
- overview: minor (deferred): withItemIntervals uses value-equality for "untouched"; tile ₽/км (period) vs year rows (full year) scope note.

## Волна 2b · гараж и справочники

- directory: minor (deferred): failureText duplicates common userMessage (export from common in wave 3); garage/RowText+kit used cross-feature → move to ui/common; per-row usePlaceStats live queries; FormPage-as-card drops unsaved edits on row tap and bumps updatedAt on no-op save; clearing «Количество» saves 4; delete navigates away on failed delete.

## Волна 3 · выпуск

- infra: minor (deferred): M-3 two-tab draft >24 h sweep race (draft web lock); M-4 OWNER_TABLE duplicated (move to db/); M-5 evicted draft PDF never swept; M-6 smoke URL regex; M-8 onboarding location.assign seam.
- infra round 3 re-review: all findings ADDRESSED. minor (deferred): downloads keep a flat 2-min silence budget; abandoned cycle's late 401 still clears the token (correct, late); lock-wait timeout leaves this tab silently unsynced until next trigger.
- final fixes re-review: all 14 ADDRESSED, no new breakage. minor (deferred): NoSpace in daily backup skips attachment cleanup that could free space; tab B keeps stale loginError after tab A connects; opener=null inside try; iOS PWA same-tab fallback return needs a real-phone check; «Перейти на главную» also after any merge.
