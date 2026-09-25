/**
 * Общий хелпер тестов экранов записей: приложение целиком (роутер + провайдеры) на fake-indexeddb
 * и активная машина, созданная перед каждым тестом. Импорт файла регистрирует хуки beforeEach/afterEach.
 */
import { render } from '@testing-library/react'
import { RouterProvider } from 'react-router'
import { afterEach, beforeAll, beforeEach } from 'vitest'
import { AppProviders } from '../../app/providers'
import { createAppRouter } from '../../app/routes'
import { db } from '../../db/instance'
import { META_KEYS, setMeta } from '../../db/meta'
import { repos } from '../../db/repos'
import type { Vehicle } from '../../domain/types'

/** Активная машина теста (живая привязка ES-модуля: значение обновляется в beforeEach). */
export let vehicle: Vehicle

export function renderAt(path: string) {
  const router = createAppRouter({ initialPath: path })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return router
}

// Ленивые экраны грузим заранее: первый импорт модуля под нагрузкой не укладывается в таймаут findBy.
beforeAll(async () => {
  await Promise.all([import('./RecordFormPage'), import('./RecordPage')])
})

beforeEach(async () => {
  await db.open()
  vehicle = await repos.vehicles.create({
    name: 'Октавия',
    make: 'Skoda',
    model: 'Octavia',
    archived: false,
    fluids: [],
    order: 0,
    defaultFuelGrade: 'АИ-95',
  })
  await setMeta(db, META_KEYS.activeVehicleId, vehicle.id)
})

afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  sessionStorage.clear()
})
