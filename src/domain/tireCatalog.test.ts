import { expect, test } from 'vitest'
import { TIRE_BRANDS, TIRE_SIZES, formatTireSize, matchesTireSize, tireModels } from './tireCatalog'

test('размер приводится к виду «205/55 R16» из любых привычных записей', () => {
  expect(formatTireSize('205/55r16')).toBe('205/55 R16')
  expect(formatTireSize('205 55 16')).toBe('205/55 R16')
  expect(formatTireSize(' 225/45 ZR17 ')).toBe('225/45 R17')
  expect(formatTireSize('185/75R16C')).toBe('185/75 R16C')
  expect(formatTireSize('215/65 r 17.5')).toBe('215/65 R17.5')
  // Не похоже на размер — оставляем как ввели.
  expect(formatTireSize('шипы 16')).toBe('шипы 16')
})

test('поиск размера — по цифрам: «2055516», «205 55», «R16»', () => {
  expect(matchesTireSize('205/55 R16', '2055516')).toBe(true)
  expect(matchesTireSize('205/55 R16', '205 55')).toBe(true)
  expect(matchesTireSize('205/55 R16', 'r16')).toBe(true)
  expect(matchesTireSize('205/55 R16', '195')).toBe(false)
  expect(matchesTireSize('205/55 R16', '')).toBe(true)
})

test('список размеров: без повторов, все в едином виде, есть размеры Octavia A5 и cee’d', () => {
  expect(new Set(TIRE_SIZES).size).toBe(TIRE_SIZES.length)
  for (const s of TIRE_SIZES) expect(formatTireSize(s), s).toBe(s)
  for (const s of ['195/65 R15', '205/55 R16', '225/45 R17']) expect(TIRE_SIZES).toContain(s)
  expect(TIRE_SIZES.length).toBeGreaterThanOrEqual(50)
})

test('модели бренда: по названию и прежнему имени, сначала нужного сезона', () => {
  const all = tireModels('Nokian')
  expect(all.length).toBeGreaterThan(0)
  const winter = tireModels('nokian', 'winter')
  expect(winter[0]?.season).toBe('winter')
  expect(tireModels('Неизвестный бренд')).toEqual([])
})

test('бренды: без повторов, у каждой модели сезон', () => {
  const names = TIRE_BRANDS.map((b) => b.brand.toLowerCase())
  expect(new Set(names).size).toBe(names.length)
  for (const b of TIRE_BRANDS)
    for (const m of b.models)
      expect(['summer', 'winter', 'allSeason'], `${b.brand} ${m.name}`).toContain(m.season)
})
