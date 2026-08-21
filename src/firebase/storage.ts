import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from './config'
import type { TaskAttachment } from '@/types/task.types'

const UPLOAD_TIMEOUT_MS = 3 * 60 * 1000

function mapStorageError(err: unknown): Error {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: string }).code) : ''
  if (code === 'storage/canceled') {
    return new Error('Загрузка прервалась. Проверьте интернет и размер файла (до 80 МБ).')
  }
  if (code === 'storage/unauthorized' || code === 'storage/unauthenticated') {
    return new Error(
      'Нет прав на загрузку в Storage. Нужно выкатить правила: firebase deploy --only storage,firestore:rules',
    )
  }
  if (code === 'storage/retry-limit-exceeded' || code === 'storage/unknown') {
    return new Error('Сеть оборвалась при загрузке файла. Повторите или уменьшите PDF.')
  }
  if (err instanceof Error && err.message) return err
  return new Error('Не удалось загрузить файл')
}

export async function uploadFile(
  path: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const storageRef = ref(storage, path)
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type || 'application/octet-stream',
  })

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      task.cancel()
    }, UPLOAD_TIMEOUT_MS)

    task.on(
      'state_changed',
      (snap) => {
        if (!snap.totalBytes) return
        onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100))
      },
      (err) => {
        clearTimeout(timer)
        reject(mapStorageError(err))
      },
      () => {
        clearTimeout(timer)
        getDownloadURL(task.snapshot.ref)
          .then((url) => {
            onProgress?.(100)
            resolve(url)
          })
          .catch((err) => reject(mapStorageError(err)))
      },
    )
  })
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
