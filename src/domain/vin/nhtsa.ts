import type { Drive, FuelType, Transmission, Vehicle } from '../types'

export interface VinOnlineInfo {
  make?: string
  model?: string
  year?: number
  engine?: Vehicle['engine']
  transmission?: Transmission
  drive?: Drive
  bodyType?: string
}

type NhtsaRow = Record<string, string | null | undefined>

const UPPERCASE_MAKES = new Set(['BMW', 'GMC', 'MINI', 'MG'])

/** 'MERCEDES-BENZ' → 'Mercedes-Benz'; аббревиатуры марок (BMW, GMC) остаются заглавными. */
function titleCase(s: string): string {
  const upper = s.trim().toUpperCase()
  if (UPPERCASE_MAKES.has(upper)) return upper
  return s.trim().toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
}

const text = (v: string | null | undefined) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined)

function positive(v: string | null | undefined): number | undefined {
  const n = Number(text(v))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function fuelType(primary?: string, electrification?: string): FuelType | undefined {
  if (electrification && /hybrid/i.test(electrification) && !/mild/i.test(electrification)) return 'hybrid'
  if (!primary) return undefined
  if (/gasoline/i.test(primary)) return 'petrol'
  if (/diesel/i.test(primary)) return 'diesel'
  if (/electric/i.test(primary)) return 'electric'
  if (/CNG|natural gas/i.test(primary)) return 'cng'
  if (/LPG|propane/i.test(primary)) return 'lpg'
  return undefined
}

function transmission(style?: string): Transmission | undefined {
  if (!style) return undefined
  if (/CVT|continuously/i.test(style)) return 'cvt'
  if (/DCT|dual.clutch/i.test(style)) return 'dct'
  if (/AMT|automated manual/i.test(style)) return 'amt'
  if (/automatic/i.test(style)) return 'at'
  if (/manual|standard/i.test(style)) return 'mt'
  return undefined
}

function drive(type?: string): Drive | undefined {
  if (!type) return undefined
  if (/AWD|4WD|4x4|all.wheel|4.wheel/i.test(type)) return 'awd'
  if (/FWD|front/i.test(type)) return 'fwd'
  if (/RWD|rear/i.test(type)) return 'rwd'
  return undefined
}

/**
 * Уточнение VIN через NHTSA vPIC — только по явному действию пользователя.
 * Любая ошибка, таймаут или пустой ответ → null (остаёмся на офлайн-данных).
 */
export async function fetchNhtsa(
  vin: string,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<VinOnlineInfo | null> {
  const { timeoutMs = 8000, fetchImpl = fetch } = opts
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`
    const res = await fetchImpl(url, { signal: controller.signal })
    if (!res.ok) return null
    const body = (await res.json()) as { Results?: NhtsaRow[] }
    const row = body.Results?.[0]
    const make = text(row?.Make)
    if (!row || !make) return null

    const out: VinOnlineInfo = { make: titleCase(make) }
    const model = text(row.Model)
    if (model) out.model = model
    const year = positive(row.ModelYear)
    if (year) out.year = Math.round(year)

    const engine: NonNullable<Vehicle['engine']> = {}
    const liters = positive(row.DisplacementL)
    if (liters) engine.displacementCc = Math.round(liters * 1000)
    const hp = positive(row.EngineHP)
    if (hp) engine.powerHp = Math.round(hp)
    const fuel = fuelType(text(row.FuelTypePrimary), text(row.ElectrificationLevel))
    if (fuel) engine.fuel = fuel
    if (Object.keys(engine).length > 0) out.engine = engine

    const tr = transmission(text(row.TransmissionStyle))
    if (tr) out.transmission = tr
    const dr = drive(text(row.DriveType))
    if (dr) out.drive = dr
    const bodyClass = text(row.BodyClass)
    if (bodyClass) out.bodyType = bodyClass
    return out
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
