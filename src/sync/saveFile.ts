/** Имя файла выгрузки: moy-avto-2026-09-25.json / .xlsx */
export function backupFileName(kind: 'json' | 'xlsx', today: string): string {
  return `moy-avto-${today}.${kind}`
}

const isPhone = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

/**
 * На телефоне — системное «Поделиться» (сохранить в Файлы, отправить в мессенджер),
 * иначе — обычное скачивание через <a download>.
 */
export async function saveFile(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type })
  if (isPhone() && typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return // пользователь закрыл окно
      console.warn('«Поделиться» не сработало, скачиваем файл', e)
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
