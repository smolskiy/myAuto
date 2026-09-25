import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import tones from '../../tones.module.css'
import { type CalloutPlacement, placeCallouts } from './layout'
import {
  SCHEMATIC_ART,
  type Point,
  type SchematicArt,
  type SchematicModel,
  type SchematicZone,
} from './models'
import styles from './VehicleSchematic.module.css'

export type { SchematicModel, SchematicZone } from './models'

export interface SchematicMark {
  zone: SchematicZone
  state: 'soon' | 'overdue'
  /** Выноска «Ремень ГРМ / через 2 000 км»; показываются первые две, остальные зоны — только точкой. */
  title?: string
  detail?: string
}

export interface VehicleSchematicProps {
  model: SchematicModel
  /** Зоны, где что-то скоро или пора менять, — самые срочные первыми. */
  marks: SchematicMark[]
  /** Легенда под чертежом; нулевые состояния не показываются. */
  counts?: { overdue: number; soon: number; ok: number }
  /** Имя для скринридера: «Схема машины: просрочено — Тормозная жидкость». */
  label: string
  /** Есть обработчик — схема становится кнопкой. */
  onClick?(): void
}

const MAX_CALLOUTS = 2

const LEGEND = [
  ['overdue', 'Просрочено'],
  ['soon', 'Скоро'],
  ['ok', 'В порядке'],
] as const

const pct = ([x, y]: Point) => ({ left: `${x}%`, top: `${y}%` })

/** Выноска занимает полосу от точки до края чертежа: плашка прижата к полю над или под машиной. */
const calloutBox = ([x, y]: Point, side: CalloutPlacement['side']) =>
  side === 'above' ? { left: `${x}%`, top: 0, height: `${y}%` } : { left: `${x}%`, top: `${y}%`, bottom: 0 }

/** «Рентген» узла: моторный отсек, ремень ГРМ, тормозные трубки, колёса, аккумулятор. */
function Xray({ zone, art }: { zone: SchematicZone; art: SchematicArt }) {
  // viewBox шириной 100: x в процентах как есть, y — в тех же единицах, что x.
  const k = 1 / art.aspect
  const pt = ([x, y]: Point) => `${x},${y * k}`
  const bay = <polygon className={styles.fill} points={art.engineBay.map(pt).join(' ')} />
  const wheel = ({ center: [x, y], rx, ry }: SchematicArt['wheels']['front']) => (
    <>
      <ellipse cx={x} cy={y * k} rx={rx} ry={ry * k} />
      <ellipse cx={x} cy={y * k} rx={rx * 0.55} ry={ry * k * 0.55} />
    </>
  )
  const [ax, ay] = art.anchors[zone]
  const cy = ay * k
  switch (zone) {
    case 'engine':
      return bay
    case 'timing':
      // Два шкива и ремень между ними — слева-снизу от точки, чтобы она их не закрывала.
      return (
        <>
          {bay}
          <circle cx={ax - 3.4} cy={cy - 0.8} r={1.6} />
          <circle cx={ax - 4.6} cy={cy + 3.6} r={2.2} />
          <path
            d={`M${ax - 5} ${cy - 0.8} L${ax - 6.8} ${cy + 3.6} M${ax - 1.8} ${cy - 0.8} L${ax - 2.4} ${cy + 3.6}`}
          />
        </>
      )
    case 'brakes':
      return (
        <>
          {art.brakeLines.map((line, i) => (
            <polyline key={i} points={line.map(pt).join(' ')} />
          ))}
        </>
      )
    case 'battery':
      return (
        <>
          <rect className={styles.fill} x={ax + 1.8} y={cy - 1.8} width={5} height={2.8} rx={0.3} />
          <path d={`M${ax + 2.8} ${cy - 1.8} v-0.8 M${ax + 5.8} ${cy - 1.8} v-0.8`} />
        </>
      )
    case 'wheelFront':
      return wheel(art.wheels.front)
    case 'wheelRear':
      return wheel(art.wheels.rear)
    default:
      return null
  }
}

/** Чертёж машины 3/4 с точками зон, «рентгеном» узлов и выносками. Линии красятся токенами темы. */
export function VehicleSchematic({ model, marks, counts, label, onClick }: VehicleSchematicProps) {
  const art = SCHEMATIC_ART[model]
  const callouts = marks.filter((m) => m.title).slice(0, MAX_CALLOUTS)
  const placements = placeCallouts(callouts.map((m) => art.anchors[m.zone]))
  const legend = counts ? LEGEND.filter(([state]) => counts[state] > 0) : []

  const body: ReactNode = (
    <>
      <span className={styles.stage} aria-hidden="true">
        <span className={styles.frame}>
          <span className={styles.glow}>
            <span
              className={styles.art}
              style={{
                aspectRatio: String(art.aspect),
                maskImage: `url("${art.src}")`,
                WebkitMaskImage: `url("${art.src}")`,
              }}
            />
          </span>
          <svg className={styles.xray} viewBox={`0 0 100 ${100 / art.aspect}`} preserveAspectRatio="none">
            {marks.map((m) => (
              <g key={m.zone} className={tones[m.state]}>
                <Xray zone={m.zone} art={art} />
              </g>
            ))}
          </svg>
          {marks.map((m) => (
            <span
              key={m.zone}
              data-zone={m.zone}
              className={cx(styles.dot, tones[m.state], m.state === 'overdue' && styles.pulse)}
              style={pct(art.anchors[m.zone])}
            />
          ))}
          {callouts.map((m, i) => {
            const place: CalloutPlacement = placements[i] ?? { side: 'above', align: 'center' }
            return (
              <span
                key={m.zone}
                className={cx(styles.callout, tones[m.state], styles[place.side], styles[place.align])}
                style={calloutBox(art.anchors[m.zone], place.side)}
              >
                <span className={styles.leader} />
                <span className={styles.chip}>
                  <span className={styles.chipTitle}>{m.title}</span>
                  {m.detail && <span className={styles.chipDetail}>{m.detail}</span>}
                </span>
              </span>
            )
          })}
        </span>
      </span>
      {legend.length > 0 && (
        <span className={styles.legend} aria-hidden="true">
          {legend.map(([state, text]) => (
            <span key={state} className={cx(styles.legendItem, tones[state])}>
              {`${text}\u00A0${counts?.[state]}`}
            </span>
          ))}
        </span>
      )}
    </>
  )

  return onClick ? (
    <button type="button" className={styles.root} aria-label={label} onClick={onClick}>
      {body}
    </button>
  ) : (
    <span role="img" aria-label={label} className={styles.root}>
      {body}
    </span>
  )
}
