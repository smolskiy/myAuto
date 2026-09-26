import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  isDirectoryCity,
  parseDirectory,
  type DirectoryCityId,
  type DirectoryFile,
  type DirectoryPlace,
} from '../../domain/placeDirectory'

/** Город справочника СТО и АЗС — на этом устройстве, как тема. */
export const DIRECTORY_CITY_KEY = 'myauto.directory.city'

const listeners = new Set<() => void>()
/** Хранилище недоступно (приватное окно) — выбор живёт в памяти до перезагрузки. */
let memory: DirectoryCityId | undefined

function readCity(): DirectoryCityId | undefined {
  try {
    const v = localStorage.getItem(DIRECTORY_CITY_KEY)
    return isDirectoryCity(v) ? v : undefined
  } catch {
    return undefined
  }
}

/** Выбрать город (undefined — без справочника); все экраны узнают сразу. */
export function setDirectoryCity(city: DirectoryCityId | undefined) {
  try {
    if (city) localStorage.setItem(DIRECTORY_CITY_KEY, city)
    else localStorage.removeItem(DIRECTORY_CITY_KEY)
  } catch {
    memory = city
  }
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Выбранный город справочника СТО и АЗС; не выбран — undefined (подсказок нет). */
export function useDirectoryCity(): DirectoryCityId | undefined {
  return useSyncExternalStore(subscribe, () => readCity() ?? memory)
}

export interface Directory {
  city: DirectoryCityId
  /** Когда собраны данные, YYYY-MM-DD. */
  updated: string
  places: DirectoryPlace[]
}

const LOADERS: Record<DirectoryCityId, () => Promise<{ default: unknown }>> = {
  rostov: () => import('../../domain/directory/rostov.json'),
  evpatoria: () => import('../../domain/directory/evpatoria.json'),
}

const cache = new Map<DirectoryCityId, Directory>()

/**
 * Справочник города: грузится отдельным куском при первом обращении (в офлайн-кеше, как всё приложение); пока
 * грузится или город не выбран — undefined.
 */
export function useDirectory(city: DirectoryCityId | undefined): Directory | undefined {
  const [loaded, setLoaded] = useState(() => (city ? cache.get(city) : undefined))
  useEffect(() => {
    if (!city || cache.has(city)) return
    let alive = true
    void LOADERS[city]().then((m) => {
      const file = m.default as DirectoryFile
      const directory = { city, updated: file.updated, places: parseDirectory(file) }
      cache.set(city, directory)
      if (alive) setLoaded(directory)
    })
    return () => {
      alive = false
    }
  }, [city])
  if (!city) return undefined
  // Город сменили — прежний справочник не показываем, даже пока новый грузится.
  return cache.get(city) ?? (loaded?.city === city ? loaded : undefined)
}
