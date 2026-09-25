import { IconAlertTriangleFilled, IconWorldSearch } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { FUEL_TYPE_LABELS, TRANSMISSION_LABELS } from '../../common'
import { formatNumber, NBSP } from '../../../domain/format'
import { decodeVin, normalizeVin, type VinApplyInfo } from '../../../domain/vin/decode'
import { fetchNhtsa, type VinOnlineInfo } from '../../../domain/vin/nhtsa'
import { Button, TextField } from '../../../ui'
import styles from './VehicleForm.module.css'

export interface VinFieldProps {
  value: string
  onChange(vin: string): void
  /** «Заполнить»: данные VIN уходят только в пустые поля формы. */
  onApply(info: VinApplyInfo): void
  /** Ошибка проверки при сохранении. */
  error?: string
}

const VIN_LENGTH = 17

type Online = { vin: string } & (
  { state: 'loading' } | { state: 'none' } | { state: 'found'; info: VinOnlineInfo }
)

/** «Honda · Accord · 2003 · 2,4 л · Бензин · Автомат». */
function onlineText(i: VinOnlineInfo): string {
  const liters = i.engine?.displacementCc
    ? `${formatNumber(i.engine.displacementCc / 1000, 1)}${NBSP}л`
    : undefined
  return [
    i.make,
    i.model,
    i.year,
    liters,
    i.engine?.fuel && FUEL_TYPE_LABELS[i.engine.fuel],
    i.transmission && TRANSMISSION_LABELS[i.transmission],
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * VIN: верхний регистр без пробелов; на 17-м символе — офлайн-расшифровка («Lada · Россия · 2000» и «Заполнить»),
 * ошибки — у поля. «Уточнить онлайн» — NHTSA по явному нажатию; нет ответа или сети — тихое «Онлайн ничего не нашлось».
 */
export function VinField({ value, onChange, onApply, error }: VinFieldProps) {
  const [touched, setTouched] = useState(false)
  const [online, setOnline] = useState<Online | null>(null)
  const complete = value.length >= VIN_LENGTH
  const info = useMemo(
    () => (value && (complete || touched) ? decodeVin(value) : null),
    [value, complete, touched],
  )
  const decodeError = info && !info.valid ? info.errors[0] : undefined
  // Ответ онлайн относится к тому VIN, для которого его спрашивали.
  const current = online?.vin === value ? online : null

  const offline = info?.valid
    ? [info.make ?? info.manufacturer, info.country, info.modelYear].filter(Boolean)
    : []

  const refine = async () => {
    const vin = value
    setOnline({ vin, state: 'loading' })
    const found = await fetchNhtsa(vin)
    setOnline((o) =>
      o?.vin !== vin ? o : found ? { vin, state: 'found', info: found } : { vin, state: 'none' },
    )
  }

  return (
    <div className={styles.stack}>
      <TextField
        label="VIN"
        value={value}
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        maxLength={VIN_LENGTH + 3}
        onChange={(e) => onChange(normalizeVin(e.target.value))}
        onBlur={() => setTouched(true)}
        error={decodeError ?? error}
      />
      {info?.valid && (
        <div className={styles.vinBox}>
          <div className={styles.vinRow}>
            <span className={styles.vinText}>{offline.join(' · ') || 'Производитель не найден'}</span>
            {(info.make || info.modelYear) && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onApply({ make: info.make, year: info.modelYear })}
              >
                Заполнить
              </Button>
            )}
          </div>
          {info.warnings.map((w) => (
            <p key={w} className={styles.vinWarning}>
              <IconAlertTriangleFilled size={16} aria-hidden="true" />
              {w}
            </p>
          ))}
          {current?.state === 'found' ? (
            <div className={styles.vinRow}>
              <span className={styles.vinText}>{onlineText(current.info)}</span>
              <Button size="sm" variant="secondary" onClick={() => onApply(current.info)}>
                Заполнить
              </Button>
            </div>
          ) : (
            <div className={styles.vinRow}>
              <Button
                size="sm"
                variant="ghost"
                icon={<IconWorldSearch />}
                loading={current?.state === 'loading'}
                onClick={() => void refine()}
              >
                Уточнить онлайн
              </Button>
              {current?.state === 'none' && <span className={styles.vinMuted}>Онлайн ничего не нашлось</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
