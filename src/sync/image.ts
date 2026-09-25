export interface Compressed {
  blob: Blob
  width: number
  height: number
}

/**
 * Сжатие фото на устройстве: длинная сторона ≤ maxSide, JPEG с заданным качеством.
 * Ориентация берётся из EXIF (`imageOrientation: 'from-image'`), прозрачность заливается белым.
 */
export async function compressImage(file: Blob, maxSide: number, quality: number): Promise<Compressed> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D недоступен')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob вернул null'))), 'image/jpeg', quality),
    )
    return { blob, width, height }
  } finally {
    bitmap.close()
  }
}
