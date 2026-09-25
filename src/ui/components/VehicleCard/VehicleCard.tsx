import { IconCar, IconChevronDown } from '@tabler/icons-react'
import { cx } from '../../lib/cx'
import shared from '../../shared.module.css'
import styles from './VehicleCard.module.css'

export interface VehicleCardProps {
  name: string
  /** Марка, модель, год. */
  subtitle?: string
  /** Госномер «А123ВС 77». */
  plate?: string
  /** «148 320 км» */
  odometer?: string
  photoUrl?: string | null
  /** Показывает «▾» и делает имя кнопкой «<имя>, сменить машину». */
  onSwitch?(): void
}

export function VehicleCard({ name, subtitle, plate, odometer, photoUrl, onSwitch }: VehicleCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.top}>
        {photoUrl ? (
          <img className={styles.photo} src={photoUrl} alt="" />
        ) : (
          <span className={styles.placeholder} aria-hidden="true">
            <IconCar size={32} stroke={1.5} />
          </span>
        )}
        <div className={styles.identity}>
          {onSwitch ? (
            <button
              type="button"
              className={styles.nameButton}
              aria-label={`${name}, сменить машину`}
              onClick={onSwitch}
            >
              <span className={cx(styles.name, shared.truncate)}>{name}</span>
              <IconChevronDown className={styles.caret} size={20} stroke={2.25} aria-hidden="true" />
            </button>
          ) : (
            <span className={cx(styles.name, shared.truncate)}>{name}</span>
          )}
          {subtitle && <span className={cx(styles.subtitle, shared.truncate)}>{subtitle}</span>}
        </div>
      </div>
      {(plate || odometer) && (
        <dl className={styles.facts}>
          {plate && (
            <div className={styles.fact}>
              <dt className={styles.factName}>Госномер</dt>
              <dd className={styles.plate}>{plate}</dd>
            </div>
          )}
          {odometer && (
            <div className={cx(styles.fact, plate && styles.factEnd)}>
              <dt className={styles.factName}>Пробег</dt>
              <dd className={styles.odometer}>{odometer}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  )
}
