import type { Kopecks } from './types'

export function toKopecks(rubles: number): Kopecks {
  return Math.round(rubles * 100)
}

export function toRubles(k: Kopecks): number {
  return k / 100
}

const MAX_DEPTH = 50

/**
 * Разбирает сумму в рублях с арифметикой: «1 200,50», «1200+650», «(100+50)*2».
 * Рекурсивный спуск без eval. Пустое, некорректное, отрицательное, деление на 0,
 * вложенность скобок глубже 50 → null.
 */
export function parseMoneyExpression(input: string): Kopecks | null {
  const src = input.replace(/\s/g, '').replace(/,/g, '.')
  if (src === '' || !/^[0-9.+\-*/()]+$/.test(src)) return null

  let pos = 0
  let depth = 0

  const parseNumber = (): number | null => {
    const m = /^(\d+(\.\d*)?|\.\d+)/.exec(src.slice(pos))
    if (!m) return null
    pos += m[0].length
    return Number(m[0])
  }

  const parseFactor = (): number | null => {
    if (src[pos] === '(') {
      // ограничение глубины: иначе строка из тысяч скобок переполнит стек (RangeError)
      if (++depth > MAX_DEPTH) return null
      pos++
      const v = parseExpression()
      if (v === null || src[pos] !== ')') return null
      pos++
      depth--
      return v
    }
    return parseNumber()
  }

  const parseTerm = (): number | null => {
    let left = parseFactor()
    while (left !== null && (src[pos] === '*' || src[pos] === '/')) {
      const op = src[pos++]
      const right = parseFactor()
      if (right === null) return null
      if (op === '/') {
        if (right === 0) return null
        left /= right
      } else {
        left *= right
      }
    }
    return left
  }

  function parseExpression(): number | null {
    let left = parseTerm()
    while (left !== null && (src[pos] === '+' || src[pos] === '-')) {
      const op = src[pos++]
      const right = parseTerm()
      if (right === null) return null
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  const value = parseExpression()
  if (value === null || pos !== src.length || !Number.isFinite(value) || value < 0) return null
  return toKopecks(value)
}
