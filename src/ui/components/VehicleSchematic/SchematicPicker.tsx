import { IconCarOff } from '@tabler/icons-react'
import { useId } from 'react'
import { cx } from '../../lib/cx'
import { SCHEMATIC_ART, type SchematicModel } from './models'
import styles from './SchematicPicker.module.css'

export interface SchematicPickerOption {
  value: string
  /** «Daewoo Lanos», «Автоматически», «Без картинки». */
  label: string
  /** Вторая строка плитки: что подобралось автоматически. */
  hint?: string
  /** Чей чертёж показать миниатюрой; нет — значок «без чертежа». */
  model?: SchematicModel
}

export interface SchematicPickerProps {
  label: string
  value: string
  options: SchematicPickerOption[]
  onChange(value: string): void
}

/** Выбор чертежа машины плитками с миниатюрами — радиогруппа. */
export function SchematicPicker({ label, value, options, onChange }: SchematicPickerProps) {
  const labelId = useId()
  const name = useId()
  return (
    <fieldset className={styles.picker} role="radiogroup" aria-labelledby={labelId}>
      <legend id={labelId} className={styles.label}>
        {label}
      </legend>
      <div className={styles.tiles}>
        {options.map((o) => {
          const art = o.model ? SCHEMATIC_ART[o.model] : undefined
          return (
            <label key={o.value} className={cx(styles.tile, o.value === value && styles.checked)}>
              <input
                type="radio"
                className={styles.radio}
                name={name}
                value={o.value}
                checked={o.value === value}
                onChange={() => onChange(o.value)}
              />
              <span className={styles.thumb} aria-hidden="true">
                {art ? (
                  <span
                    className={styles.art}
                    style={{ maskImage: `url("${art.src}")`, WebkitMaskImage: `url("${art.src}")` }}
                  />
                ) : (
                  <IconCarOff size={28} stroke={1.5} />
                )}
              </span>
              <span className={styles.text}>{o.label}</span>
              {o.hint && <span className={styles.hint}>{o.hint}</span>}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
