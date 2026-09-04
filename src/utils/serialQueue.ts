/** One Firestore-heavy job at a time. Parallel writes trip Google quota. */
let tail: Promise<void> = Promise.resolve()

export function enqueueSerial<T>(fn: () => Promise<T>, gapMs = 400): Promise<T> {
  const run = tail.then(async () => {
    const result = await fn()
    if (gapMs > 0) await new Promise((r) => setTimeout(r, gapMs))
    return result
  })
  tail = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
