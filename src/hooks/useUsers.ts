import { useEffect, useState } from 'react'
import { subscribeToCollection } from '@/firebase/firestore'
import { positionRank } from '@/constants/positions'
import type { User } from '@/types/user.types'

export function isEmploymentActive(user: Pick<User, 'isActive'> | null | undefined): boolean {
  return !!user && user.isActive !== false
}

export function useUsers(enabled = true, options?: { includeInactive?: boolean }) {
  const includeInactive = options?.includeInactive === true
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
            .filter((u) => u.name && (includeInactive || isEmploymentActive(u)))
            .sort(
              (a, b) =>
                Number(isEmploymentActive(b)) - Number(isEmploymentActive(a)) ||
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
  }, [enabled, includeInactive])

  return { users, loading, error }
}
