import { cx } from '../../lib/cx'
import styles from './Skeleton.module.css'

export interface SkeletonProps {
  width?: number | string
  height?: number | string
  radius?: 'sm' | 'md' | 'full'
}

const px = (v: number | string | undefined) => (typeof v === 'number' ? `${v}px` : v)

export function Skeleton({ width = '100%', height = 16, radius = 'sm' }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(styles.skeleton, styles[radius])}
      style={{ width: px(width), height: px(height) }}
    />
  )
}
