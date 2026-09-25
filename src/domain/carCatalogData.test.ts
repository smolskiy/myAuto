import { expect, test } from 'vitest'
import { BODY_LABELS, findGeneration, findMake, findModel, normalizeName, type CarMake } from './carCatalog'
import data from './carCatalog.json'

const makes = (data as { makes: CarMake[] }).makes
const BODIES = Object.keys(BODY_LABELS)

test('справочник машин: без повторов, годы по порядку, кузова из словаря', () => {
  const makeNames = makes.map((m) => normalizeName(m.name))
  expect(new Set(makeNames).size).toBe(makeNames.length)
  for (const make of makes) {
    const models = make.models.map((m) => normalizeName(m.name))
    expect(new Set(models).size, make.name).toBe(models.length)
    for (const model of make.models) {
      const where = `${make.name} ${model.name}`
      expect(model.generations.length, where).toBeGreaterThan(0)
      const gens = model.generations.map((g) => normalizeName(g.name))
      expect(new Set(gens).size, where).toBe(gens.length)
      for (const g of model.generations) {
        expect(Number.isInteger(g.from), `${where} ${g.name}`).toBe(true)
        expect(g.from, `${where} ${g.name}`).toBeGreaterThanOrEqual(1960)
        if (g.to !== null) expect(g.to, `${where} ${g.name}`).toBeGreaterThanOrEqual(g.from)
        expect(g.bodies.length, `${where} ${g.name}`).toBeGreaterThan(0)
        for (const b of g.bodies) expect(BODIES, `${where} ${g.name}`).toContain(b)
      }
    }
  }
})

test('машины владельца на месте: Octavia A5 рестайлинг и cee’d первого поколения', () => {
  const octavia = findModel(findMake(makes, 'Шкода')!, 'Октавия')!
  expect(findGeneration(octavia, 'A5 рестайлинг')).toMatchObject({ from: 2008, to: 2013 })
  const ceed = findModel(findMake(makes, 'Kia')!, "cee'd")!
  expect(ceed.generations.some((g) => g.from === 2006)).toBe(true)
})
