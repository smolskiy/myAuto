import ceedArt from './art/ceed-sw-1.webp'
import octaviaArt from './art/octavia-a5.webp'

/** Модели, для которых есть чертёж. Ракурс у всех один: 3/4 спереди слева, перед смотрит влево. */
export type SchematicModel = 'octavia-a5' | 'ceed-sw-1'

/**
 * Зоны на чертеже. Узлы, которых снаружи не видно, стоят там, где они под капотом у поперечного мотора:
 * ГРМ — дальний (правый) край моторного отсека, бачок тормозной жидкости и аккумулятор — ближний (левый),
 * у стекла и у фары; охлаждение — за решёткой радиатора.
 */
export type SchematicZone =
  | 'engine'
  | 'timing'
  | 'cooling'
  | 'battery'
  | 'brakes'
  | 'lights'
  | 'transmission'
  | 'cabin'
  | 'wheelFront'
  | 'wheelRear'

/** Точка в процентах: x — от ширины картинки, y — от высоты. */
export type Point = readonly [x: number, y: number]

export interface Wheel {
  center: Point
  /** Полуоси шины: rx — % ширины, ry — % высоты. */
  rx: number
  ry: number
}

export interface SchematicArt {
  src: string
  /** Ширина / высота картинки. */
  aspect: number
  anchors: Record<SchematicZone, Point>
  /** Моторный отсек под капотом — «рентген» для двигателя и ГРМ. */
  engineBay: readonly Point[]
  /** Тормозные трубки от бачка к колёсам. */
  brakeLines: readonly (readonly Point[])[]
  wheels: { front: Wheel; rear: Wheel }
}

/** Координаты сняты по сетке с самих картинок (`tools/schematic-mask.py` печатает aspect). */
export const SCHEMATIC_ART: Record<SchematicModel, SchematicArt> = {
  'octavia-a5': {
    src: octaviaArt,
    aspect: 2.0492,
    anchors: {
      engine: [26, 38],
      timing: [11, 43],
      battery: [36, 42],
      brakes: [44, 35],
      cooling: [15, 53],
      lights: [34.5, 55],
      transmission: [39, 65],
      cabin: [40, 26],
      wheelFront: [49.5, 78.5],
      wheelRear: [91.2, 63.5],
    },
    engineBay: [
      [10, 43],
      [24, 35],
      [42, 37.5],
      [29, 48],
    ],
    brakeLines: [
      [
        [44, 35],
        [46.5, 56],
        [49.5, 78.5],
      ],
      [
        [46.5, 56],
        [57, 71],
        [84, 66],
        [91.2, 63.5],
      ],
    ],
    wheels: {
      front: { center: [49.5, 78.5], rx: 8.6, ry: 19 },
      rear: { center: [91, 63], rx: 6.2, ry: 17.5 },
    },
  },
  'ceed-sw-1': {
    src: ceedArt,
    aspect: 2.0367,
    anchors: {
      engine: [25, 41],
      timing: [11, 46],
      battery: [34, 43],
      brakes: [42, 36],
      cooling: [10, 55],
      lights: [29, 55],
      transmission: [35, 66],
      cabin: [38, 27],
      wheelFront: [44.5, 78],
      wheelRear: [90.3, 64.5],
    },
    engineBay: [
      [8, 47],
      [21, 37.5],
      [40, 39.5],
      [27, 51],
    ],
    brakeLines: [
      [
        [42, 36],
        [43.5, 57],
        [44.5, 78],
      ],
      [
        [43.5, 57],
        [55, 73.5],
        [83, 68],
        [90.3, 64.5],
      ],
    ],
    wheels: {
      front: { center: [44.5, 78], rx: 8.5, ry: 20 },
      rear: { center: [90, 64], rx: 6, ry: 18 },
    },
  },
}
