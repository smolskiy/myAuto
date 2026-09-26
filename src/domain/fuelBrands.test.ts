import { describe, expect, test } from 'vitest'
import { FUEL_BRANDS, fuelBrandHint, searchFuelBrands } from './fuelBrands'

describe('сети АЗС юга России и Крыма', () => {
  test('поиск по началу названия и по другим написаниям, регистр и «ё» не важны', () => {
    expect(searchFuelBrands('лук').map((b) => b.name)).toEqual(['Лукойл'])
    expect(searchFuelBrands('lukoil').map((b) => b.name)).toEqual(['Лукойл'])
    expect(searchFuelBrands('атан').map((b) => b.name)).toEqual(['АТАН'])
    // Shell в России стал Teboil — находится и по старому имени.
    expect(searchFuelBrands('shell').map((b) => b.name)).toEqual(['Teboil'])
    expect(searchFuelBrands('газпром').map((b) => b.name)).toEqual(['Газпром', 'Газпромнефть'])
  })

  test('слово внутри названия тоже находит: «нефть» — все «…нефть»', () => {
    const names = searchFuelBrands('нефть').map((b) => b.name)
    expect(names).toEqual(expect.arrayContaining(['Роснефть', 'Газпромнефть', 'Татнефть']))
  })

  test('пустой запрос — ничего', () => {
    expect(searchFuelBrands(' ')).toEqual([])
  })

  test('подпись: где сеть', () => {
    const by = (name: string) => FUEL_BRANDS.find((b) => b.name === name)!
    expect(fuelBrandHint(by('Лукойл'))).toBe('Сеть АЗС · юг России')
    expect(fuelBrandHint(by('АТАН'))).toBe('Сеть АЗС · Крым')
    expect(fuelBrandHint(by('Формула'))).toBe('Сеть АЗС · юг России и Крым')
  })

  test('названия и другие написания не повторяются', () => {
    const all = FUEL_BRANDS.flatMap((b) => [b.name, ...(b.aka ?? [])].map((n) => n.toLowerCase()))
    expect(new Set(all).size).toBe(all.length)
  })
})
