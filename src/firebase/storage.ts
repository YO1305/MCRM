import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from './config'
import type { TaskAttachment } from '@/types/task.types'

export async function uploadFile(path: string, file: File): Promise<string> {
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

export async function uploadTaskFile(
  uploaderId: string,
  file: File,
): Promise<TaskAttachment> {
  const safeName = file.name.replace(/[^\w.\-()+\sа-яА-ЯёЁ]/gi, '_')
  const path = `tasks/${uploaderId}/${Date.now()}_${safeName}`
  const url = await uploadFile(path, file)
  return {
    name: file.name,
    url,
    size: file.size,
    contentType: file.type || 'application/octet-stream',
    path,
  }
}
