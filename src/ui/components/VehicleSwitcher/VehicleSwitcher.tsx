import { IconBuildingWarehouse, IconCar, IconCheck, IconPlus } from '@tabler/icons-react'
import { cx } from '../../lib/cx'
import shared from '../../shared.module.css'
import { BottomSheet } from '../BottomSheet/BottomSheet'
import styles from './VehicleSwitcher.module.css'

export interface VehicleSwitcherProps {
  open: boolean
  onClose(): void
  vehicles: { id: string; name: string; subtitle?: string }[]
  activeId?: string
  onSelect(id: string): void
  onAdd(): void
  onGarage(): void
}

/** Шторка выбора активной машины; внизу — «Добавить машину» и «Гараж и архив». */
export function VehicleSwitcher({
  open,
  onClose,
  vehicles,
  activeId,
  onSelect,
  onAdd,
  onGarage,
}: VehicleSwitcherProps) {
  const pick = (fn: () => void) => () => {
    fn()
    onClose()
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="Машины">
      <ul className={styles.list}>
        {vehicles.map((v) => {
          const active = v.id === activeId
          return (
            <li key={v.id}>
              <button
                type="button"
                className={cx(styles.row, active && styles.active)}
                aria-current={active ? 'true' : undefined}
                onClick={pick(() => onSelect(v.id))}
              >
                <span className={styles.icon} aria-hidden="true">
                  <IconCar size={22} stroke={1.75} />
                </span>
                <span className={styles.text}>
                  <span className={cx(styles.name, shared.truncate)}>{v.name}</span>
                  {v.subtitle && <span className={cx(styles.subtitle, shared.truncate)}>{v.subtitle}</span>}
                </span>
                {active && <IconCheck className={styles.check} size={22} stroke={2.25} aria-hidden="true" />}
              </button>
            </li>
          )
        })}
      </ul>
      <ul className={cx(styles.list, styles.more)}>
        <li>
          <button type="button" className={cx(styles.row, styles.link)} onClick={pick(onAdd)}>
            <span className={styles.icon} aria-hidden="true">
              <IconPlus size={22} stroke={2} />
            </span>
            <span className={styles.name}>Добавить машину</span>
          </button>
        </li>
        <li>
          <button type="button" className={cx(styles.row, styles.link)} onClick={pick(onGarage)}>
            <span className={styles.icon} aria-hidden="true">
              <IconBuildingWarehouse size={22} stroke={1.75} />
            </span>
            <span className={styles.name}>Гараж и архив</span>
          </button>
        </li>
      </ul>
    </BottomSheet>
  )
}
