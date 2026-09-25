import { NumberField } from '../NumberField/NumberField'

export interface OdometerFieldProps {
  /** По умолчанию «Пробег». */
  label?: string
  value: number | undefined
  onChange(v: number | undefined): void
  /** «последний: 148 320 км» */
  lastKnown?: string
  /** Нарушение хронологии — предупреждение, сохранить можно. */
  warning?: string
}

export function OdometerField({ label = 'Пробег', value, onChange, lastKnown, warning }: OdometerFieldProps) {
  return (
    <NumberField
      label={label}
      value={value}
      onChange={onChange}
      unit="км"
      decimals={0}
      min={0}
      hint={lastKnown}
      warning={warning}
    />
  )
}
