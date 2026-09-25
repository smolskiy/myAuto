import type { Drive, Transmission, Vehicle } from '../types'
import { REGION_BY_FIRST_CHAR, WMI_TABLE, countryByCode } from './wmi'

export interface VinInfo {
  vin: string
  valid: boolean
  errors: string[]
  warnings: string[]
  wmi?: string
  manufacturer?: string
  make?: string
  country?: string
  region?: string
  modelYear?: number
  plantCode?: string
  serial?: string
  /** null — контрольная цифра для этого региона не обязательна и не проверялась. */
  checkDigitValid: boolean | null
}

/** Верхний регистр, без пробелов (в т. ч. неразрывных) и дефисов. */
export function normalizeVin(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '')
}

const TRANSLIT: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  P: 7,
  R: 9,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9,
}
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]

function checkDigit(vin: string): string {
  let sum = 0
  for (let i = 0; i < 17; i++) {
    const c = vin[i]!
    const value = /\d/.test(c) ? Number(c) : TRANSLIT[c]!
    sum += value * WEIGHTS[i]!
  }
  const rest = sum % 11
  return rest === 10 ? 'X' : String(rest)
}

/** Символы года ↔ 1980…2009, дальше цикл 30 лет. */
const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789'

function modelYear(code: string, now: Date): number | undefined {
  const index = YEAR_CODES.indexOf(code)
  if (index < 0) return undefined
  const limit = now.getFullYear() + 1
  let year = 1980 + index
  while (year + 30 <= limit) year += 30
  return year <= limit ? year : undefined
}

export function decodeVin(input: string, now: Date = new Date()): VinInfo {
  const vin = normalizeVin(input)
  const errors: string[] = []
  if (vin.length !== 17) errors.push('VIN должен содержать 17 символов')
  else if (!/^[A-Z0-9]+$/.test(vin)) errors.push('В VIN только латинские буквы и цифры')
  else if (/[IOQ]/.test(vin)) errors.push('В VIN не бывает букв I, O, Q')
  if (errors.length > 0) return { vin, valid: false, errors, warnings: [], checkDigitValid: null }

  const warnings: string[] = []
  const wmi = vin.slice(0, 3)
  const entry = WMI_TABLE[wmi]
  const region = REGION_BY_FIRST_CHAR[vin[0]!]

  // Контрольная цифра обязательна только для VIN Северной Америки; у остальных её часто нет.
  let checkDigitValid: boolean | null = null
  if (region === 'Северная Америка') {
    checkDigitValid = checkDigit(vin) === vin[8]
    if (!checkDigitValid) warnings.push('Контрольная цифра не совпала — проверьте VIN')
  }

  const info: VinInfo = {
    vin,
    valid: true,
    errors,
    warnings,
    wmi,
    plantCode: vin[10],
    serial: vin.slice(11),
    checkDigitValid,
  }
  if (entry) {
    info.manufacturer = entry.manufacturer
    if (entry.make) info.make = entry.make
  }
  const country = entry?.country ?? countryByCode(vin[0]!, vin[1]!)
  if (country) info.country = country
  if (region) info.region = region
  const year = modelYear(vin[9]!, now)
  if (year !== undefined) info.modelYear = year
  return info
}

export interface VinApplyInfo {
  make?: string
  model?: string
  year?: number
  engine?: Vehicle['engine']
  transmission?: Transmission
  drive?: Drive
  bodyType?: string
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === ''

/** Заполняет только пустые поля черновика машины (undefined, null, ''); введённое пользователем не трогает. */
export function applyVinToVehicle<T extends Partial<Vehicle>>(draft: T, info: VinApplyInfo): T {
  const out: Record<string, unknown> = { ...draft }
  for (const key of ['make', 'model', 'year', 'transmission', 'drive', 'bodyType'] as const) {
    if (isEmpty(out[key]) && !isEmpty(info[key])) out[key] = info[key]
  }
  if (info.engine) {
    const engine: Record<string, unknown> = { ...(draft.engine ?? {}) }
    let changed = false
    for (const [key, value] of Object.entries(info.engine)) {
      if (isEmpty(engine[key]) && !isEmpty(value)) {
        engine[key] = value
        changed = true
      }
    }
    if (changed) out.engine = engine
  }
  return out as T
}
