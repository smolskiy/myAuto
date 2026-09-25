import { expect, test } from 'vitest'
import { FakeDisk } from './fakeDisk'
import { Offline } from './api'

test('фейковый Диск ведёт себя как настоящий', async () => {
  const disk = new FakeDisk()
  expect(await disk.readText('app:/garage.json')).toBeNull()
  await disk.writeText('app:/garage.json', '{"a":1}')
  const s1 = await disk.stat('app:/garage.json')
  await disk.writeText('app:/garage.json', '{"a":2}')
  expect((await disk.stat('app:/garage.json'))!.md5).not.toBe(s1!.md5)
  await disk.copy('app:/garage.json', 'app:/backups/2026-09-25.json')
  expect(await disk.list('app:/backups')).toEqual(['2026-09-25.json'])
  disk.failNext(new Offline('Нет связи с Яндекс.Диском', 0))
  await expect(disk.readText('app:/garage.json')).rejects.toBeInstanceOf(Offline)
  expect(await disk.readText('app:/garage.json')).toBe('{"a":2}')
})

test('сбой нужного метода нужное число раз, крючок после чтения, журнал вызовов', async () => {
  const disk = new FakeDisk()
  await disk.writeText('app:/garage.json', '{"a":1}')
  disk.failNext(new Offline('Нет связи с Яндекс.Диском', 0), { method: 'writeText', times: 2 })
  expect(await disk.stat('app:/garage.json')).not.toBeNull()
  await expect(disk.writeText('app:/x', '1')).rejects.toBeInstanceOf(Offline)
  await expect(disk.writeText('app:/x', '1')).rejects.toBeInstanceOf(Offline)
  await disk.writeText('app:/x', '1')
  const seen: string[] = []
  disk.afterRead = async (path) => {
    seen.push(path)
    await disk.writeText('app:/garage.json', '{"a":2}')
  }
  expect(await disk.readText('app:/garage.json')).toBe('{"a":1}')
  expect(seen).toEqual(['app:/garage.json'])
  expect(disk.peekJson<{ a: number }>('app:/garage.json')).toEqual({ a: 2 })
  expect(disk.calls.slice(0, 3)).toEqual(['writeText app:/garage.json', 'stat app:/garage.json', 'writeText app:/x'])
})
