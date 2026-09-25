import type { Point } from './models'

export interface CalloutPlacement {
  side: 'above' | 'below'
  /** start — подпись идёт вправо от точки, end — влево, center — по центру над точкой. */
  align: 'start' | 'center' | 'end'
}

/** Ниже этой линии (колёса, пороги) подпись ставится под точку — там под машиной свободно. */
const BELOW_FROM_Y = 60
const EDGE_X = 30
/** Ближе этого по горизонтали две подписи с одной стороны налезают друг на друга. */
const CLASH_X = 40

/** Сторона и выравнивание подписей; вторая при столкновении с первой уходит на другую сторону точки. */
export function placeCallouts(points: readonly Point[]): CalloutPlacement[] {
  const placed: CalloutPlacement[] = []
  points.forEach(([x, y], i) => {
    let side: CalloutPlacement['side'] = y >= BELOW_FROM_Y ? 'below' : 'above'
    const clash = points.slice(0, i).some(([px], j) => placed[j]?.side === side && Math.abs(px - x) < CLASH_X)
    if (clash) side = side === 'above' ? 'below' : 'above'
    const align = x < EDGE_X ? 'start' : x > 100 - EDGE_X ? 'end' : 'center'
    placed.push({ side, align })
  })
  return placed
}
