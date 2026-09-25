import { IconCloudDownload, IconCloudUpload, IconFileUpload } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { db } from '../../db/instance'
import { repos } from '../../db/repos'
import { BUILTIN_CATALOG, STARTER_REMINDER_ITEM_IDS } from '../../domain/catalog'
import { formatKm } from '../../domain/format'
import type { CatalogItem, ID, Vehicle } from '../../domain/types'
import { yandexAuth } from '../../sync/index'
import { Button, Checkbox, NumberField, useToast } from '../../ui'
import { Page, UserError } from '../common'
import { VehicleForm } from '../vehicle/form/VehicleForm'
import styles from './OnboardingPage.module.css'

const STARTER_ITEMS: CatalogItem[] = STARTER_REMINDER_ITEM_IDS.map((id) =>
  BUILTIN_CATALOG.find((i) => i.id === id),
).filter((i): i is CatalogItem => !!i)

/** «каждые 10 000 км или 12 мес.» — интервал по умолчанию из каталога. */
function intervalText(i: CatalogItem): string | undefined {
  const parts = [
    i.defaultIntervalKm !== undefined ? formatKm(i.defaultIntervalKm) : undefined,
    i.defaultIntervalMonths !== undefined ? `${i.defaultIntervalMonths} мес.` : undefined,
  ].filter(Boolean)
  return parts.length > 0 ? `каждые ${parts.join(' или ')}` : undefined
}

function Step({ n }: { n: number }) {
  return <p className={styles.step}>{`Шаг ${n} из 3`}</p>
}

/** Шаг 2: стартовые напоминания — все отмечены, пробег прошлой замены по желанию. */
function RemindersStep({ vehicle, onDone }: { vehicle: Vehicle; onDone(): void }) {
  const toast = useToast()
  const [checked, setChecked] = useState<Set<ID>>(() => new Set(STARTER_ITEMS.map((i) => i.id)))
  const [lastKm, setLastKm] = useState<Record<ID, number | undefined>>({})
  const [busy, setBusy] = useState(false)

  const toggle = (id: ID, on: boolean) =>
    setChecked((s) => {
      const next = new Set(s)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const next = async () => {
    if (busy) return
    setBusy(true)
    try {
      // Все правила — одной транзакцией: сбой на середине не оставляет половину напоминаний.
      await db.transaction('rw', db.reminderRules, async () => {
        for (const item of STARTER_ITEMS) {
          if (!checked.has(item.id)) continue
          const odometer = lastKm[item.id]
          await repos.reminders.create({
            vehicleId: vehicle.id,
            itemId: item.id,
            intervalKm: item.defaultIntervalKm,
            intervalMonths: item.defaultIntervalMonths,
            baseline: odometer !== undefined ? { odometer } : undefined,
            enabled: true,
          })
        }
      })
      onDone()
    } catch (e) {
      if (!(e instanceof UserError)) console.error(e)
      toast.show({
        text: e instanceof UserError ? e.message : 'Не получилось сохранить — попробуйте ещё раз',
      })
      setBusy(false)
    }
  }

  return (
    <>
      <Page title="Что напоминать">
        <Step n={2} />
        <p className={styles.lead}>
          Приложение напомнит о замене по пробегу и по времени. Помните пробег прошлой замены — укажите,
          прогноз будет точнее. Интервалы можно поменять потом в разделе «ТО».
        </p>
        <div className={styles.items}>
          {STARTER_ITEMS.map((item) => {
            const on = checked.has(item.id)
            return (
              <div key={item.id} role="group" aria-label={item.name} className={styles.item}>
                <Checkbox label={item.name} checked={on} onChange={(v) => toggle(item.id, v)} />
                {intervalText(item) && <p className={styles.interval}>{intervalText(item)}</p>}
                {on && (
                  <NumberField
                    label={`${item.name}: когда делали последний раз`}
                    unit="км"
                    value={lastKm[item.id]}
                    onChange={(v) => setLastKm((m) => ({ ...m, [item.id]: v }))}
                  />
                )}
              </div>
            )
          })}
        </div>
      </Page>
      <div className={styles.footer}>
        <Button block loading={busy} onClick={() => void next()}>
          Дальше
        </Button>
      </div>
    </>
  )
}

/** Шаг 3: Яндекс.Диск сейчас или позже. */
function SyncStep() {
  const navigate = useNavigate()
  const connect = () => {
    // Без ClientID вход не собрать — его вводят в настройках синхронизации.
    if (!yandexAuth.getClientId()) {
      void navigate('/settings/sync', { replace: true })
      return
    }
    window.location.assign(yandexAuth.loginUrl())
  }
  return (
    <>
      <Page title="Синхронизация">
        <Step n={3} />
        <div className={styles.sync}>
          <span className={styles.syncIcon} aria-hidden="true">
            <IconCloudUpload size={32} stroke={1.75} />
          </span>
          <p className={styles.lead}>
            Записи и фото сохранятся в папке приложения на вашем Яндекс.Диске: телефон и компьютер увидят одно
            и то же, а при переустановке ничего не пропадёт.
          </p>
        </div>
      </Page>
      <div className={styles.footer}>
        <div className={styles.actions}>
          <Button block onClick={connect}>
            Подключить Яндекс.Диск
          </Button>
          <Button block variant="ghost" onClick={() => void navigate('/', { replace: true })}>
            Позже
          </Button>
        </div>
      </div>
    </>
  )
}

/** Новое устройство: данные уже есть — восстановить их вместо новой машины (иначе после восстановления их две). */
function RestoreActions() {
  const navigate = useNavigate()
  return (
    <div className={styles.restore}>
      <p className={styles.restoreTitle}>Уже вели «Мой авто» на другом устройстве?</p>
      <Button
        block
        size="sm"
        variant="secondary"
        icon={<IconCloudDownload />}
        onClick={() => void navigate('/settings/sync')}
      >
        Уже есть данные на Яндекс.Диске
      </Button>
      <Button
        block
        size="sm"
        variant="secondary"
        icon={<IconFileUpload />}
        onClick={() => void navigate('/settings/data')}
      >
        Загрузить копию
      </Button>
    </div>
  )
}

/** Первый запуск: машина → стартовые напоминания → Яндекс.Диск. */
export default function OnboardingPage() {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [step, setStep] = useState<1 | 2 | 3>(1)

  if (step === 1 || !vehicle) {
    return (
      <VehicleForm
        title="Добро пожаловать"
        intro={
          <div className={styles.intro}>
            <Step n={1} />
            <h2 className={styles.introTitle}>Добавьте машину</h2>
            <p className={styles.lead}>
              Начните с VIN: марка и год заполнятся сами. Обязательны только марка и модель, остальное — когда
              будет под рукой.
            </p>
            <RestoreActions />
          </div>
        }
        submitLabel="Дальше"
        onSaved={(v) => {
          setVehicle(v)
          setStep(2)
          // Остаёмся на онбординге: следующий шаг рисуется здесь же.
          return false
        }}
      />
    )
  }
  if (step === 2) return <RemindersStep vehicle={vehicle} onDone={() => setStep(3)} />
  return <SyncStep />
}
