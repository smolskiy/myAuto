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

/** Число → текст поля: разряды неразрывным пробелом, дробь через запятую, без хвостовых нулей. */
export function formatNumberInput(n: number | undefined, decimals: number): string {
  if (n === undefined || !Number.isFinite(n)) return ''
  const fixed = n.toFixed(decimals)
  const [int, frac] = fixed.split('.')
  const trimmed = frac?.replace(/0+$/, '')
  return trimmed ? `${groupDigits(int!)},${trimmed}` : groupDigits(int!)
}
