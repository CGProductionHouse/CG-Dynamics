/** Capture each canonical reader independently; a thrown source must not erase
 * successful unrelated reads. This is a read receipt, not provider verification. */
export async function captureNolanSource<T>(read: () => Promise<T>, clock = () => new Date().toISOString()) {
  try {
    const result = await read()
    return { result, error: null, checkedAt: clock() }
  } catch (error) {
    return { result: null, error: error instanceof Error ? error.message.trim() || 'Source read failed.' : 'Source read failed.', checkedAt: clock() }
  }
}
