import { expect, test } from 'vitest'
import {
  BODY_LABELS,
  findGeneration,
  findMake,
  findModel,
  generationForYear,
  generationLabel,
  generationYears,
  type CarMake,
} from './carCatalog'

const MAKES: CarMake[] = [
  {
    name: 'Skoda',
    aka: ['Шкода', 'ŠKODA'],
    models: [
      {
        name: 'Octavia',
        aka: ['Октавия'],
        generations: [
          { name: 'A5 (1Z)', code: '1Z', from: 2004, to: 2008, bodies: ['liftback', 'wagon'] },
          { name: 'A5 рестайлинг', code: '1Z', from: 2008, to: 2013, bodies: ['liftback', 'wagon'] },
          { name: 'A8', from: 2020, to: null, bodies: ['liftback', 'wagon'] },
        ],
      },
    ],
  },
  { name: 'Lada', aka: ['Лада', 'ВАЗ'], models: [{ name: 'Vesta', aka: ['Веста'], generations: [] }] },
]

test('марка и модель — по названию и русскому имени, без учёта регистра и диакритики', () => {
  expect(findMake(MAKES, 'шкода')?.name).toBe('Skoda')
  expect(findMake(MAKES, 'ŠKODA')?.name).toBe('Skoda')
  expect(findMake(MAKES, 'skoda ')?.name).toBe('Skoda')
  expect(findMake(MAKES, 'ваз')?.name).toBe('Lada')
  expect(findMake(MAKES, 'Tesla')).toBeUndefined()
  const skoda = findMake(MAKES, 'Skoda')!
  expect(findModel(skoda, 'октавия')?.name).toBe('Octavia')
  expect(findModel(skoda, 'Rapid')).toBeUndefined()
})

test('поколение — по названию; подпись с годами, текущее — «н. в.»', () => {
  const octavia = findModel(findMake(MAKES, 'Skoda')!, 'Octavia')!
  const fl = findGeneration(octavia, 'a5 рестайлинг')!
  expect(generationLabel(fl)).toBe('A5 рестайлинг · 2008–2013')
  expect(generationLabel(findGeneration(octavia, 'A8')!)).toBe('A8 · 2020 — н.\u00A0в.')
})

test('годы поколения; поколение по году — последнее начавшееся к этому году', () => {
  const octavia = findModel(findMake(MAKES, 'Skoda')!, 'Octavia')!
  expect(generationYears(octavia.generations[1]!, 2026)).toEqual([2013, 2012, 2011, 2010, 2009, 2008])
  expect(generationYears(octavia.generations[2]!, 2026)).toEqual([2026, 2025, 2024, 2023, 2022, 2021, 2020])
  expect(generationForYear(octavia, 2011)?.name).toBe('A5 рестайлинг')
  expect(generationForYear(octavia, 2008)?.name).toBe('A5 рестайлинг')
  expect(generationForYear(octavia, 2016)).toBeUndefined()
})

test('подписи кузовов по-русски', () => {
  expect(BODY_LABELS.liftback).toBe('Лифтбек')
  expect(BODY_LABELS.wagon).toBe('Универсал')
  expect(BODY_LABELS.suv).toBe('Внедорожник')
})
