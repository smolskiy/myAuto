import { useState } from 'react'
import type { ID } from '../../domain/types'

/** Для поиска: регистр и «ё» не важны. */
export function normalize(s: string): string {
  return s.trim().toLowerCase().replaceAll('ё', 'е')
}

/** Каждое слово запроса — где угодно в тексте: «рычаг перед» находит «Рычаг передний нижний». */
export function matches(text: string, query: string): boolean {
  const t = normalize(text)
  return normalize(query)
    .split(/\s+/)
    .every((word) => t.includes(word))
}

/**
 * Текст комбобокса выбора, согласованный с выбранным значением: выбор (снаружи или после создания) —
 * в поле его имя; выбор снят снаружи — поле очищается; выбор снят набором текста — набранное остаётся.
 */
export function usePickerQuery(
  selectedId: ID | undefined,
  selectedLabel: string | undefined,
): [string, (q: string) => void] {
  const key = selectedId && selectedLabel !== undefined ? `${selectedId}\u0000${selectedLabel}` : undefined
  const [query, setQuery] = useState(selectedLabel ?? '')
  const [synced, setSynced] = useState<{ key?: string; label?: string }>({ key, label: selectedLabel })
  if (synced.key !== key) {
    // Производное состояние: подстраиваемся прямо в отрисовке (шаблон React «состояние из пропсов»).
    setSynced({ key, label: selectedLabel })
    if (key) setQuery(selectedLabel ?? '')
    else if (query === synced.label) setQuery('')
  }
  return [query, setQuery]
}
