import { useEffect, useRef } from 'react'
import { useSmmPaymentReminder } from '@/hooks/useSmmPayments'

/** Reminder on 10th / 25th for SMM payment. */
export function SmmPaymentReminder() {
  const { run } = useSmmPaymentReminder()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    void run().catch((err) => console.error('SMM payment reminder failed', err))
  }, [run])

  return null
}
