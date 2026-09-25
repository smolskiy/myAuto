/**
 * Справочник машин для подсказок формы: марка → модель → поколение (с рестайлингами) → год, кузов.
 * Только подсказки — вписать можно любое. Данные — `carCatalog.json` (грузится отдельным куском по требованию).
 */

export type BodyType =
  | 'sedan'
  | 'hatchback'
  | 'liftback'
  | 'wagon'
  | 'crossover'
  | 'suv'
  | 'coupe'
  | 'convertible'
  | 'minivan'
  | 'pickup'
  | 'van'

export const BODY_LABELS: Record<BodyType, string> = {
  sedan: 'Седан',
  hatchback: 'Хэтчбек',
  liftback: 'Лифтбек',
  wagon: 'Универсал',
  crossover: 'Кроссовер',
  suv: 'Внедорожник',
  coupe: 'Купе',
  convertible: 'Кабриолет',
  minivan: 'Минивэн',
  pickup: 'Пикап',
  van: 'Фургон',
}

export interface CarGeneration {
  /** Как в каталогах: «A5 рестайлинг», «I (ED)», «II рестайлинг». */
  name: string
  /** Код кузова: «1Z», «ED», «E70». */
  code?: string
  from: number
  /** null — выпускается сейчас. */
  to: number | null
  bodies: BodyType[]
}

export interface CarModel {
  name: string
  /** Русские и прежние написания: «Октавия». */
  aka?: string[]
  generations: CarGeneration[]
}

export interface CarMake {
  name: string
  aka?: string[]
  models: CarModel[]
}

/** Нижний регистр без диакритики и лишних пробелов, ё = е: «ŠKODA » → «skoda». */
export const normalizeName = (s: string) =>
  s.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ')

const same = (a: string, b: string) => normalizeName(a) === normalizeName(b)
const named = <T extends { name: string; aka?: string[] }>(list: T[], name: string) =>
  normalizeName(name) ? list.find((x) => same(x.name, name) || x.aka?.some((a) => same(a, name))) : undefined

export const findMake = (makes: CarMake[], name: string): CarMake | undefined => named(makes, name)
export const findModel = (make: CarMake, name: string): CarModel | undefined => named(make.models, name)
export const findGeneration = (model: CarModel, name: string): CarGeneration | undefined =>
  normalizeName(name) ? model.generations.find((g) => same(g.name, name)) : undefined

/** «2008–2013», текущее — «2020 — н. в.». */
export const generationYearsText = (g: CarGeneration) =>
  g.to === null ? `${g.from} — н.\u00A0в.` : `${g.from}–${g.to}`

/** «A5 рестайлинг · 2008–2013», текущее — «A8 · 2020 — н. в.». */
export function generationLabel(g: CarGeneration): string {
  return `${g.name} · ${generationYearsText(g)}`
}

/** Годы выпуска поколения, новые первыми; у текущего — по `currentYear`. */
export function generationYears(g: CarGeneration, currentYear: number): number[] {
  const to = g.to ?? currentYear
  return Array.from({ length: Math.max(0, to - g.from + 1) }, (_, i) => to - i)
}

/** Поколение по году: последнее из начавшихся к этому году и ещё не законченных. */
export function generationForYear(model: CarModel, year: number): CarGeneration | undefined {
  return [...model.generations]
    .filter((g) => g.from <= year && (g.to === null || g.to >= year))
    .sort((a, b) => b.from - a.from)[0]
}
