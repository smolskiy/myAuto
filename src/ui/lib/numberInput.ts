import { groupDigits } from './moneyExpr'

/** Допустим ли набираемый текст для числа с `decimals` знаками (цифры, пробелы, одна запятая или точка). */
export function isNumberDraft(text: string, decimals: number): boolean {
  const s = text.replace(/[\s\u00A0\u202F]/g, '')
  if (decimals === 0) return /^\d*$/.test(s)
  return new RegExp(`^\\d*(?:[.,]\\d{0,${decimals}})?$`).test(s)
}

/** Текст → число; пусто или только разделитель → undefined. */
export function parseNumberDraft(text: string): number | undefined {
  const s = text.replace(/[\s\u00A0\u202F]/g, '').replace(',', '.')
  if (s === '' || s === '.') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Число → текст поля: разряды неразрывным пробелом, дробь через запятую.
 * Обычно без хвостовых нулей («42,5 л»); `keepDecimals` — дробная часть всегда полностью, как у денег («54,90 ₽»).
 */
export function formatNumberInput(n: number | undefined, decimals: number, keepDecimals = false): string {
  if (n === undefined || !Number.isFinite(n)) return ''
  const fixed = n.toFixed(decimals)
  const [int, frac] = fixed.split('.')
  const trimmed = frac?.replace(/0+$/, '')
  if (!trimmed) return groupDigits(int!)
  return `${groupDigits(int!)},${keepDecimals ? frac : trimmed}`
}
