import { daysSinceLastTouch } from '@/utils/dateUtils'
import { stageIsClosed, stageIsWon } from '@/constants/clientStages'
import type { Client } from '@/types/client.types'

function daysWord(n: number) {
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return 'день'
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return 'дня'
  return 'дней'
}

/** Есть пауза или любое ожидание — сотруднику не дублируем «нет активности». */
export function hasWaitOrPause(client: Pick<Client, 'waitStatus'>): boolean {
  return Boolean(String(client.waitStatus || '').trim())
}

export function idleTouchLabel(days: number): string {
  if (days >= 14) return `Давно не было активности · ${days} ${daysWord(days)}`
  return `Нет активности ${days} ${daysWord(days)}`
}

/** Сотрудникам: сколько дней без касания, если нет паузы/ожидания. */
export function IdleTouchHint({ client }: { client: Client }) {
  if (stageIsClosed(client.stage) || stageIsWon(client.stage)) return null
  if (hasWaitOrPause(client)) return null
  const days = daysSinceLastTouch(client)
  if (days == null || days < 1) return null
  const long = days >= 14
  return (
    <p
      className={`rounded-md px-2 py-1 text-[11px] font-medium ${
        long ? 'bg-red-50 text-danger' : 'bg-amber-50 text-amber-800'
      }`}
    >
      {idleTouchLabel(days)}
    </p>
  )
}
