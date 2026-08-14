import { useEffect, useState } from 'react'
import { subscribeToCollection } from '@/firebase/firestore'
import { positionRank } from '@/constants/positions'
import type { User } from '@/types/user.types'

export function useUsers(enabled = true) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled) {
      setUsers([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    const unsubscribe = subscribeToCollection<User>(
      'users',
      [],
      (data) => {
        setUsers(
          data
            .filter((u) => u.isActive !== false && u.name)
            .sort(
              (a, b) =>
                positionRank(a.position) - positionRank(b.position) ||
                a.name.localeCompare(b.name, 'ru'),
            ),
        )
        setLoading(false)
      },
      () => {
        setError('Не удалось загрузить список сотрудников')
        setLoading(false)
      },
    )

    return unsubscribe
  }, [enabled])

  return { users, loading, error }
}
