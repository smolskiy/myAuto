import type { Point } from './models'

export interface CalloutPlacement {
  side: 'above' | 'below'
  /** start — подпись идёт вправо от точки, end — влево, center — по центру над точкой. */
  align: 'start' | 'center' | 'end'
}

/** Ниже этой линии (колёса, пороги) подпись ставится под точку — там под машиной свободно. */
const BELOW_FROM_Y = 60
const EDGE_X = 30

/**
 * Сторона и выравнивание подписей. Плашки прижаты к полю над или под машиной, и на узкой карточке две плашки
 * в одном поле налезают друг на друга почти при любом расстоянии между точками, поэтому вторая всегда
 * уходит на сторону, противоположную первой.
 */
export function placeCallouts(points: readonly Point[]): CalloutPlacement[] {
  const placed: CalloutPlacement[] = []
  for (const [x, y] of points) {
    let side: CalloutPlacement['side'] = y >= BELOW_FROM_Y ? 'below' : 'above'
    if (placed.some((p) => p.side === side)) side = side === 'above' ? 'below' : 'above'
    const align = x < EDGE_X ? 'start' : x > 100 - EDGE_X ? 'end' : 'center'
    placed.push({ side, align })
  }
  return placed
}
