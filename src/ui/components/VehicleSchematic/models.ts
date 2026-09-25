import ceedArt from './art/ceed-sw-1.webp'
import lanosArt from './art/lanos.webp'
import octaviaArt from './art/octavia-a5.webp'
import x5Art from './art/x5-f15.webp'

/** Модели, для которых есть чертёж. Ракурс у всех один: 3/4 спереди слева, перед смотрит влево. */
export type SchematicModel = 'octavia-a5' | 'ceed-sw-1' | 'lanos' | 'x5-f15'

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
  /** Подпись в выборе чертежа. */
  label: string
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
    label: 'Skoda Octavia A5',
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
    label: "Kia cee'd SW",
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
  lanos: {
    label: 'Daewoo Lanos',
    src: lanosArt,
    aspect: 2.0325,
    anchors: {
      engine: [27, 40],
      timing: [10, 45],
      battery: [34, 45],
      brakes: [45, 35],
      cooling: [15, 56],
      lights: [29, 57],
      transmission: [37, 68],
      cabin: [42, 27],
      wheelFront: [46.5, 79],
      wheelRear: [90.5, 64.5],
    },
    engineBay: [
      [10, 46],
      [25, 36],
      [45, 38],
      [31, 49],
    ],
    brakeLines: [
      [
        [45, 35],
        [46, 57],
        [46.5, 79],
      ],
      [
        [46, 57],
        [57, 74],
        [84, 67],
        [90.5, 64.5],
      ],
    ],
    wheels: {
      front: { center: [46.5, 79], rx: 8.5, ry: 20 },
      rear: { center: [90.3, 64.5], rx: 6, ry: 17 },
    },
  },
  'x5-f15': {
    label: 'BMW X5',
    src: x5Art,
    aspect: 1.9841,
    anchors: {
      engine: [27, 38],
      timing: [10, 43],
      battery: [34, 42],
      brakes: [45, 34],
      cooling: [15, 55],
      lights: [29, 53],
      transmission: [36, 68],
      cabin: [41, 26],
      wheelFront: [45.5, 78.4],
      wheelRear: [90, 67.5],
    },
    engineBay: [
      [9, 44],
      [24, 34],
      [45, 36],
      [30, 47],
    ],
    brakeLines: [
      [
        [45, 34],
        [45, 57],
        [45.5, 78.4],
      ],
      [
        [45, 57],
        [56, 76],
        [82, 71],
        [90, 67.5],
      ],
    ],
    wheels: {
      front: { center: [45.5, 78.4], rx: 9.5, ry: 20.5 },
      rear: { center: [89.5, 67.5], rx: 7, ry: 17.5 },
    },
  },
}

/** Все чертежи в порядке выбора. */
export const SCHEMATIC_MODELS = Object.keys(SCHEMATIC_ART) as SchematicModel[]

export const isSchematicModel = (s: string | undefined): s is SchematicModel =>
  SCHEMATIC_MODELS.includes(s as SchematicModel)
