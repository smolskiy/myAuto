/** Ссылка для звонка: только цифры и «+» («+7 (495) 123-45-67» → «tel:+74951234567»). */
export function telHref(phone: string | undefined): string | undefined {
  const digits = phone?.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : undefined
}

/** Куда ведёт адрес места: своя ссылка места, иначе поиск адреса на Яндекс.Картах. */
export function mapsHref(address: string | undefined, url?: string): string | undefined {
  const own = url?.trim()
  if (own) return own
  const text = address?.trim()
  return text ? `https://yandex.ru/maps/?text=${encodeURIComponent(text)}` : undefined
}
