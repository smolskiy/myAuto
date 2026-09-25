import {
  IconAlertTriangle,
  IconDatabase,
  IconFileDownload,
  IconFileSpreadsheet,
  IconFileUpload,
  IconShieldCheck,
} from '@tabler/icons-react'
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import { todayISO } from '../../domain/dates'
import { NBSP, formatDate, formatNumber } from '../../domain/format'
import { SnapshotError } from '../../domain/snapshot'
import type { ImportPreview } from '../../sync/contracts'
import { backupService } from '../../sync/index'
import { useYandexConnected } from '../../sync/react'
import { backupFileName, saveFile } from '../../sync/saveFile'
import { Button, Card, Dialog, Icon, ListGroup, ListItem, useToast } from '../../ui'
import { Page, useToday } from '../common'
import styles from './DataSettings.module.css'
import { reloadPage } from './leave'
import settings from './Settings.module.css'

type Busy = 'json' | 'xlsx' | 'merge' | 'replace' | null

/** Сколько строк каких таблиц в копии: машины и записи — всегда, остальное — если есть. */
const OPTIONAL_COUNTS: [keyof ImportPreview['counts'], string][] = [
  ['places', 'мест'],
  ['masters', 'мастеров'],
  ['reminderRules', 'напоминаний'],
  ['documents', 'документов'],
  ['tireSets', 'комплектов шин'],
  ['attachments', 'фото и PDF'],
]

/** «Файл от 25.09.2026: машин 2, записей 148, мест 12, …». */
export function previewText(p: ImportPreview): string {
  const parts = [`машин ${formatNumber(p.counts.vehicles)}`, `записей ${formatNumber(p.counts.records)}`]
  for (const [table, label] of OPTIONAL_COUNTS) {
    if (p.counts[table] > 0) parts.push(`${label} ${formatNumber(p.counts[table])}`)
  }
  const head = p.exportedAt ? `Файл от ${formatDate(todayISO(new Date(p.exportedAt)))}` : 'В файле'
  return `${head}: ${parts.join(', ')}`
}

const MB = 1024 ** 2
const GB = 1024 ** 3
const oneDecimal = (v: number) => formatNumber(v, 1).replace(/,0$/, '')

/** «11,8 МБ» / «2 ГБ». */
const bytesText = (n: number) =>
  n >= GB ? `${oneDecimal(n / GB)}${NBSP}ГБ` : `${oneDecimal(n / MB)}${NBSP}МБ`

interface StorageInfo {
  usage?: number
  quota?: number
  persisted?: boolean
}

/** Занятое место и защита от очистки; браузер без StorageManager — null. */
function useStorageInfo(): StorageInfo | null {
  const [info, setInfo] = useState<StorageInfo | null>(null)
  useEffect(() => {
    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
    if (!storage) return
    let cancelled = false
    void Promise.all([
      storage.estimate?.().catch(() => undefined),
      storage.persisted?.().catch(() => undefined),
    ]).then(([estimate, persisted]) => {
      if (!cancelled) setInfo({ usage: estimate?.usage, quota: estimate?.quota, persisted })
    })
    return () => {
      cancelled = true
    }
  }, [])
  return info
}

const fileErrorText = (e: unknown, fallback: string) => {
  if (e instanceof SnapshotError) return e.message
  console.warn(fallback, e)
  return fallback
}

/** Данные и выгрузки: JSON и Excel, загрузка копии с объединением или заменой, место в хранилище. */
export default function DataSettingsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const today = useToday()
  const connected = useYandexConnected()
  const storage = useStorageInfo()
  const importTitleId = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [chosen, setChosen] = useState<{ file: File; preview: ImportPreview } | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)

  const exportAs = async (kind: 'json' | 'xlsx') => {
    setBusy(kind)
    try {
      const blob = kind === 'json' ? await backupService.exportJson() : await backupService.exportExcel()
      await saveFile(blob, backupFileName(kind, today))
    } catch (e) {
      console.warn('Выгрузка не удалась', e)
      toast.show({ text: 'Не удалось выгрузить данные' })
    } finally {
      setBusy(null)
    }
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // тот же файл можно выбрать ещё раз
    if (!file) return
    setChosen(null)
    setFileError(null)
    try {
      setChosen({ file, preview: await backupService.previewImport(file) })
    } catch (err) {
      setFileError(fileErrorText(err, 'Не удалось прочитать файл'))
    }
  }

  const merge = async () => {
    if (!chosen) return
    setBusy('merge')
    try {
      await backupService.importJson(chosen.file, 'merge')
      setChosen(null)
      toast.show({ text: 'Данные из копии объединены с этими' })
    } catch (err) {
      setFileError(fileErrorText(err, 'Не удалось загрузить копию'))
    } finally {
      setBusy(null)
    }
  }

  const replace = async () => {
    setConfirmReplace(false)
    if (!chosen) return
    setBusy('replace')
    try {
      await backupService.importJson(chosen.file, 'replace')
      // После замены экраны и живые запросы начинают с чистого листа.
      reloadPage()
    } catch (err) {
      setFileError(fileErrorText(err, 'Не удалось заменить данные'))
      setBusy(null)
    }
  }

  return (
    <Page title="Данные и выгрузки" back="/settings">
      {!connected && (
        <Card padded className={styles.warning}>
          <Icon icon={IconAlertTriangle} tone="soon" />
          <p className={styles.warningText}>Копии на Диске нет — подключите Яндекс.Диск</p>
          <Button size="sm" variant="secondary" onClick={() => void navigate('/settings/sync')}>
            Подключить
          </Button>
        </Card>
      )}

      <section className={settings.section}>
        <h2 className={settings.sectionTitle}>Выгрузки</h2>
        <div className={settings.stack}>
          <Button
            block
            variant="secondary"
            icon={<IconFileDownload />}
            loading={busy === 'json'}
            onClick={() => void exportAs('json')}
          >
            Выгрузить копию (JSON)
          </Button>
          <Button
            block
            variant="secondary"
            icon={<IconFileSpreadsheet />}
            loading={busy === 'xlsx'}
            onClick={() => void exportAs('xlsx')}
          >
            Выгрузить в Excel
          </Button>
          <p className={settings.reason}>
            JSON — полная копия без фото, её можно загрузить обратно. Excel — чтобы читать и печатать.
          </p>
        </div>
      </section>

      <section className={settings.section} aria-labelledby={importTitleId}>
        <h2 id={importTitleId} className={settings.sectionTitle}>
          Загрузка копии
        </h2>
        <div className={settings.stack}>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            tabIndex={-1}
            aria-label="Файл копии"
            onChange={(e) => void onFile(e)}
          />
          <Button
            block
            variant="secondary"
            icon={<IconFileUpload />}
            onClick={() => fileInput.current?.click()}
          >
            Загрузить копию
          </Button>
          {fileError && (
            <p className={settings.error} role="alert">
              {fileError}
            </p>
          )}
          {chosen && (
            <Card padded className={styles.preview}>
              <p className={styles.previewText}>{previewText(chosen.preview)}</p>
              <p className={settings.reason}>
                «Объединить» добавит новое из файла; из двух версий записи останется более свежая.
              </p>
              <Button block loading={busy === 'merge'} onClick={() => void merge()}>
                Объединить
              </Button>
              <Button
                block
                variant="secondary"
                loading={busy === 'replace'}
                onClick={() => setConfirmReplace(true)}
              >
                Заменить всё
              </Button>
              <Button block variant="ghost" onClick={() => setChosen(null)}>
                Отменить
              </Button>
            </Card>
          )}
        </div>
      </section>

      <ListGroup
        title="Хранилище"
        footer={
          storage?.persisted === false
            ? 'Браузер может очистить данные при нехватке места — держите копию на Диске.'
            : undefined
        }
      >
        <ListItem
          title="Занято"
          leading={<Icon icon={IconDatabase} tone="accent" circle />}
          value={
            storage?.usage !== undefined && storage.quota !== undefined
              ? `${bytesText(storage.usage)} из ${bytesText(storage.quota)}`
              : '—'
          }
        />
        <ListItem
          title="Защищено от очистки"
          leading={<Icon icon={IconShieldCheck} tone="accent" circle />}
          value={storage?.persisted === undefined ? '—' : storage.persisted ? 'да' : 'нет'}
        />
      </ListGroup>

      <Dialog
        open={confirmReplace}
        title="Заменить всё?"
        text={`Текущие данные на этом устройстве будут заменены данными из файла${
          connected ? ', а после синхронизации — и на Яндекс.Диске' : ''
        }.`}
        confirmLabel="Заменить"
        danger
        onCancel={() => setConfirmReplace(false)}
        onConfirm={() => void replace()}
      />
    </Page>
  )
}
