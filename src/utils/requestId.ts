/**
 * Factory for monotonically increasing, unique request identifiers.
 *
 * Every compiler request carries a requestId so stale results can be
 * discarded (Test 5 in the spec: compile A finishing after compile B must
 * never overwrite B's output).
 */
export function createRequestIdFactory(prefix: string): () => string {
  let counter = 0
  return () => {
    counter += 1
    return `${prefix}-${counter}-${Date.now().toString(36)}`
  }
}