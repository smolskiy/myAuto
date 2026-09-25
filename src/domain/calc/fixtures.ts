/** Фабрики записей для тестов расчётов. Только для тестов. */
import type { ExpenseRecord, FuelRecord, NoteRecord, OdometerRecord, ServiceRecord, Vehicle } from '../types'

let seq = 0
const nextId = () => `r${++seq}`

const base = () => ({
  id: nextId(),
  createdAt: 1,
  updatedAt: 1,
  vehicleId: 'v1',
  date: '2026-01-01',
  total: 0,
})

export function service(p: Partial<Omit<ServiceRecord, 'kind'>> = {}): ServiceRecord {
  return {
    ...base(),
    kind: 'service',
    title: 'ТО',
    serviceType: 'maintenance',
    diy: false,
    works: [],
    parts: [],
    ...p,
  }
}

export function fuel(p: Partial<Omit<FuelRecord, 'kind'>> = {}): FuelRecord {
  return { ...base(), kind: 'fuel', liters: 0, pricePerLiter: 0, fullTank: true, missedBefore: false, ...p }
}

export function expense(p: Partial<Omit<ExpenseRecord, 'kind'>> = {}): ExpenseRecord {
  return { ...base(), kind: 'expense', category: 'other', ...p }
}

export function odo(p: Partial<Omit<OdometerRecord, 'kind'>> = {}): OdometerRecord {
  return { ...base(), kind: 'odometer', ...p }
}

export function note(p: Partial<Omit<NoteRecord, 'kind'>> = {}): NoteRecord {
  return { ...base(), kind: 'note', title: 'Заметка', ...p }
}

export function vehicle(p: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1',
    createdAt: 1,
    updatedAt: 1,
    name: 'Машина',
    make: 'Skoda',
    model: 'Octavia',
    archived: false,
    fluids: [],
    order: 0,
    ...p,
  }
}
