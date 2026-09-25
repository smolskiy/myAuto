import { IconCameraPlus } from '@tabler/icons-react'
import styles from './PhotoPicker.module.css'

export interface PhotoPickerProps {
  onFiles(files: File[]): void
  /** По умолчанию 'image/*,application/pdf'. */
  accept?: string
  /** По умолчанию можно выбрать несколько. */
  multiple?: boolean
  /** По умолчанию «Добавить фото». */
  label?: string
}

/** Плитка «Добавить фото»: системный выбор — камера или галерея. Годится последней плиткой в AttachmentGrid. */
export function PhotoPicker({
  onFiles,
  accept = 'image/*,application/pdf',
  multiple = true,
  label = 'Добавить фото',
}: PhotoPickerProps) {
  return (
    <label className={styles.picker}>
      <input
        type="file"
        className={styles.input}
        accept={accept}
        multiple={multiple}
        aria-label={label}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length) onFiles(files)
        }}
      />
      <IconCameraPlus size={28} stroke={1.75} aria-hidden="true" />
      <span className={styles.label} aria-hidden="true">
        {label}
      </span>
    </label>
  )
}
