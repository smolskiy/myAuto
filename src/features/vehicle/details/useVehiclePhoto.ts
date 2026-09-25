import { useAttachments } from '../../../db/hooks'
import type { Vehicle } from '../../../domain/types'
import { useAttachmentUrl } from '../../../sync/react'

/** Адрес превью фото машины (`photoAttachmentId`): undefined — грузится или фото нет, null — файла нет. */
export function useVehiclePhoto(vehicle: Vehicle): string | null | undefined {
  const attachments = useAttachments('vehicle', vehicle.photoAttachmentId ? vehicle.id : undefined)
  const photo = attachments?.find((a) => a.id === vehicle.photoAttachmentId)
  return useAttachmentUrl(photo, 'thumb')
}
