import { describe, expect, test } from 'vitest'
import evpatoria from './directory/evpatoria.json'
import rostov from './directory/rostov.json'
import { DIRECTORY_CITIES, parseDirectory, type DirectoryCityId, type DirectoryFile } from './placeDirectory'

const FILES: Record<DirectoryCityId, DirectoryFile> = {
  rostov: rostov as unknown as DirectoryFile,
  evpatoria: evpatoria as unknown as DirectoryFile,
}

const PHONE = /^(\+7|8) \(\d{3}\) \d{3}-\d{2}-\d{2}$/

describe.each(DIRECTORY_CITIES)('справочник СТО: $name', ({ id, name }) => {
  const file = FILES[id]

  test('шапка: город, дата сбора, источник', () => {
    expect(file.city).toBe(name)
    expect(file.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(file.source).toBe('Яндекс Карты')
    expect(file.places.length).toBeGreaterThan(100)
  })

  test('строки целые: название, вид, id организации, телефоны в одном виде', () => {
    for (const row of file.places) {
      expect(row).toHaveLength(6)
      const [title, address, phones, kind, orgId] = row
      expect(title.trim()).toBe(title)
      expect(title).not.toBe('')
      expect(['s', 't']).toContain(kind)
      expect(orgId).toMatch(/^\d+$/)
      // Город в адресе не повторяется — он в шапке файла.
      expect(address).not.toContain(name)
      for (const p of phones ? phones.split('; ') : []) expect(p).toMatch(PHONE)
    }
  })

  test('организация — один раз; есть и СТО, и шины', () => {
    const places = parseDirectory(file)
    expect(new Set(places.map((p) => p.id)).size).toBe(places.length)
    expect(places.some((p) => p.kind === 'service')).toBe(true)
    expect(places.some((p) => p.kind === 'tire')).toBe(true)
  })
})
