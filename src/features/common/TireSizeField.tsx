import { matchesTireSize, TIRE_SIZES } from '../../domain/tireCatalog'
import { Combobox } from '../../ui'

export interface TireSizeFieldProps {
  label: string
  value: string
  onChange(size: string): void
  /** Размеры машины — первыми, с подсказкой «Как у машины». */
  preferred?: string[]
  placeholder?: string
}

/** Размер шин: популярные размеры по цифрам («2055516», «205 55», «r16»); можно вписать любой. */
export function TireSizeField({ label, value, onChange, preferred = [], placeholder }: TireSizeFieldProps) {
  const own = [...new Set(preferred.filter(Boolean))]
  const options = [...own, ...TIRE_SIZES.filter((s) => !own.includes(s))]
    .filter((s) => matchesTireSize(s, value))
    .map((s) => ({ id: s, label: s, hint: own.includes(s) ? 'Как у машины' : undefined }))
  return (
    <Combobox
      label={label}
      value={options.find((o) => o.label === value) ?? null}
      options={options}
      query={value}
      onQueryChange={onChange}
      onSelect={(o) => o && onChange(o.label)}
      placeholder={placeholder}
    />
  )
}
