/**
 * Арифметика в поле суммы («1200+650»). Своя копия: ui/ не импортирует domain/.
 * Понимает цифры, пробелы и неразрывные пробелы внутри чисел, запятую или точку в дробях,
 * + − × ÷ (и * /), скобки. Без eval: рекурсивный спуск по токенам.
 */

const NBSP = '\u00A0'

type Token = { kind: 'num'; value: number } | { kind: 'op'; value: '+' | '-' | '*' | '/' | '(' | ')' }

const OPS: Record<string, '+' | '-' | '*' | '/' | '(' | ')'> = {
  '+': '+',
  '-': '-',
  '−': '-',
  '–': '-',
  '*': '*',
  '×': '*',
  '·': '*',
  '/': '/',
  '÷': '/',
  '(': '(',
  ')': ')',
}

function tokenize(input: string): Token[] | null {
  const s = input.replace(/[\s\u00A0\u202F]+/g, '')
  const tokens: Token[] = []
  let i = 0
  while (i < s.length) {
    const ch = s[i]!
    const op = OPS[ch]
    if (op) {
      tokens.push({ kind: 'op', value: op })
      i++
      continue
    }
    const m = /^(\d+)(?:[.,](\d+))?/.exec(s.slice(i))
    if (!m) return null
    tokens.push({ kind: 'num', value: Number(`${m[1]}.${m[2] ?? '0'}`) })
    i += m[0].length
  }
  return tokens
}

/** expr := term (('+'|'-') term)* ; term := factor (('*'|'/') factor)* ; factor := '-' factor | num | '(' expr ')' */
function evaluate(tokens: Token[]): number | null {
  let pos = 0
  const peek = () => tokens[pos]
  const isOp = (t: Token | undefined, v: string) => t?.kind === 'op' && t.value === v

  function factor(): number | null {
    const t = peek()
    if (!t) return null
    if (isOp(t, '-')) {
      pos++
      const v = factor()
      return v === null ? null : -v
    }
    if (t.kind === 'num') {
      pos++
      return t.value
    }
    if (isOp(t, '(')) {
      pos++
      const v = expr()
      if (v === null || !isOp(peek(), ')')) return null
      pos++
      return v
    }
    return null
  }

  function term(): number | null {
    let left = factor()
    while (left !== null && (isOp(peek(), '*') || isOp(peek(), '/'))) {
      const op = (peek() as { value: string }).value
      pos++
      const right = factor()
      if (right === null) return null
      if (op === '/' && right === 0) return null
      left = op === '*' ? left * right : left / right
    }
    return left
  }

  function expr(): number | null {
    let left = term()
    while (left !== null && (isOp(peek(), '+') || isOp(peek(), '-'))) {
      const op = (peek() as { value: string }).value
      pos++
      const right = term()
      if (right === null) return null
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  const result = expr()
  return pos === tokens.length ? result : null
}

/** Выражение в рублях → целые копейки. Пусто, ошибка, отрицательное или не число → null. */
export function parseMoneyExpr(input: string): number | null {
  const tokens = tokenize(input)
  if (!tokens || tokens.length === 0) return null
  const rub = evaluate(tokens)
  if (rub === null || !Number.isFinite(rub) || rub < 0) return null
  return Math.round(rub * 100)
}

/** Есть ли в строке действие (а не просто число, возможно со знаком). */
export function hasOperator(input: string): boolean {
  return /[+\-−–*×·/÷()]/.test(input.trim().replace(/^[-−–]/, ''))
}

/** Разряды неразрывным пробелом: 148320 → «148 320». */
export function groupDigits(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
}

/** Копейки → текст поля: «1 850», «123 456,78». */
export function formatMoneyInput(kopecks: number): string {
  const rub = Math.floor(kopecks / 100)
  const kop = kopecks % 100
  return kop ? `${groupDigits(String(rub))},${String(kop).padStart(2, '0')}` : groupDigits(String(rub))
}

/** Копейки → «1 850 ₽». */
export function formatMoney(kopecks: number): string {
  return `${formatMoneyInput(kopecks)}${NBSP}₽`
}
