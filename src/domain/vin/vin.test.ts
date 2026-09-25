import { describe, expect, test, vi } from 'vitest'
import { applyVinToVehicle, decodeVin, normalizeVin } from './decode'
import { fetchNhtsa } from './nhtsa'
import { WMI_TABLE, countryByCode } from './wmi'

const NOW = new Date(2026, 8, 25)

describe('офлайн-декодер', () => {
  test('нормализация', () => {
    expect(normalizeVin(' 1hgcm-8263 3a004352 ')).toBe('1HGCM82633A004352')
  })

  test('Honda США с верной контрольной цифрой', () => {
    const v = decodeVin('1HGCM82633A004352', NOW)
    expect(v).toMatchObject({ valid: true, wmi: '1HG', make: 'Honda', region: 'Северная Америка', modelYear: 2003, checkDigitValid: true })
    expect(v.errors).toEqual([])
  })

  test('неверная контрольная цифра — только предупреждение', () => {
    const v = decodeVin('1HGCM82643A004352', NOW)
    expect(v.valid).toBe(true)
    expect(v.checkDigitValid).toBe(false)
    expect(v.warnings).toContain('Контрольная цифра не совпала — проверьте VIN')
  })

  test('Lada: производитель и год по 10-му символу, контрольная цифра не проверяется', () => {
    const v = decodeVin('XTA210990Y2765432', NOW)
    expect(v).toMatchObject({ valid: true, make: 'Lada', country: 'Россия', modelYear: 2000, checkDigitValid: null })
  })

  test('год выбирается ближайший не позже следующего года', () => {
    expect(decodeVin('XW8ZZZ61ZTG000001', NOW).modelYear).toBe(2026) // 'T' → 1996 или 2026
    expect(decodeVin('XW8ZZZ61ZAG000001', NOW).modelYear).toBe(2010) // 'A' → 1980, 2010, 2040
  })

  test.each([
    ['1HGCM82633A00435', 'VIN должен содержать 17 символов'],
    ['1HGCM82633A0O4352', 'В VIN не бывает букв I, O, Q'],
    ['1HGCM82633A00435!', 'В VIN только латинские буквы и цифры'],
  ])('ошибка: %s', (vin, message) => {
    const v = decodeVin(vin, NOW)
    expect(v.valid).toBe(false)
    expect(v.errors).toContain(message)
  })

  test('неизвестный WMI — валиден, но без производителя', () => {
    const v = decodeVin('9ZZZZZ00000000001'.slice(0, 17), NOW)
    expect(v.manufacturer).toBeUndefined()
    expect(v.region).toBe('Южная Америка')
  })
})

describe('справочник WMI и стран', () => {
  test('таблица WMI не меньше 250 записей, у каждой есть производитель и страна', () => {
    const entries = Object.entries(WMI_TABLE)
    expect(entries.length).toBeGreaterThanOrEqual(250)
    for (const [code, e] of entries) {
      expect(code).toMatch(/^[A-HJ-NPR-Z0-9]{3}$/)
      expect(e.manufacturer).toBeTruthy()
      expect(e.country).toBeTruthy()
    }
  })

  test('страна по двум символам (ISO 3780)', () => {
    expect(countryByCode('Z', '9')).toBe('Россия')
    expect(countryByCode('K', 'L')).toBe('Южная Корея')
    expect(countryByCode('M', '0')).toBe('Индия')
    expect(countryByCode('6', 'Y')).toBe('Новая Зеландия')
    expect(countryByCode('6', 'A')).toBe('Австралия')
    expect(countryByCode('9', 'Z')).toBeUndefined()
  })

  test('неизвестный WMI известной страны — страна по диапазону', () => {
    expect(decodeVin('WZZZZZ00000000001', NOW)).toMatchObject({ country: 'Германия', region: 'Европа' })
    expect(decodeVin('WZZZZZ00000000001', NOW).manufacturer).toBeUndefined()
  })

  test('сборка нескольких марок на одном заводе — без марки', () => {
    expect(decodeVin('Z94CB41AAER000001', NOW)).toMatchObject({ country: 'Россия', manufacturer: 'Hyundai Motor Manufacturing Rus' })
    expect(decodeVin('Z94CB41AAER000001', NOW).make).toBeUndefined()
  })
})

describe('применение к машине', () => {
  test('заполняет только пустые поля', () => {
    const draft = { make: 'Лада', model: '', year: undefined as number | undefined }
    expect(applyVinToVehicle(draft, { make: 'Lada', model: '2109', year: 2000 })).toEqual({ make: 'Лада', model: '2109', year: 2000 })
  })

  test('двигатель дополняется по полям, введённое остаётся', () => {
    const draft = { engine: { powerHp: 150 } }
    expect(applyVinToVehicle(draft, { engine: { displacementCc: 2400, powerHp: 160, fuel: 'petrol' } })).toEqual({
      engine: { displacementCc: 2400, powerHp: 150, fuel: 'petrol' },
    })
  })
})

describe('NHTSA', () => {
  const ok = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))

  test('разбирает ответ', async () => {
    const fetchImpl = ok({ Results: [{ Make: 'HONDA', Model: 'Accord', ModelYear: '2003', DisplacementL: '2.4',
      FuelTypePrimary: 'Gasoline', BodyClass: 'Coupe', EngineHP: '160', TransmissionStyle: 'Automatic', DriveType: 'FWD/Front-Wheel Drive' }] })
    await expect(fetchNhtsa('1HGCM82633A004352', { fetchImpl })).resolves.toEqual({
      make: 'Honda', model: 'Accord', year: 2003,
      engine: { displacementCc: 2400, powerHp: 160, fuel: 'petrol' },
      transmission: 'at', drive: 'fwd', bodyType: 'Coupe',
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/1HGCM82633A004352?format=json',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  test('гибрид, вариатор, полный привод, марка-аббревиатура', async () => {
    const fetchImpl = ok({ Results: [{ Make: 'BMW', FuelTypePrimary: 'Gasoline', ElectrificationLevel: 'Strong HEV (Hybrid Electric Vehicle)',
      TransmissionStyle: 'Continuously Variable Transmission (CVT)', DriveType: 'AWD/All-Wheel Drive' }] })
    await expect(fetchNhtsa('X', { fetchImpl })).resolves.toEqual({
      make: 'BMW', engine: { fuel: 'hybrid' }, transmission: 'cvt', drive: 'awd',
    })
  })

  test('пустой ответ, сетевая ошибка и таймаут → null', async () => {
    await expect(fetchNhtsa('X', { fetchImpl: ok({ Results: [{ Make: '' }] }) })).resolves.toBeNull()
    await expect(fetchNhtsa('X', { fetchImpl: vi.fn(async () => { throw new TypeError('network') }) })).resolves.toBeNull()
    const never = vi.fn((_u: string, init?: RequestInit) => new Promise<Response>((_, rej) =>
      init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))))
    await expect(fetchNhtsa('X', { fetchImpl: never as unknown as typeof fetch, timeoutMs: 10 })).resolves.toBeNull()
  })
})
