/**
 * Bidirectional moving average. Blends a trailing (left-anchored) and leading
 * (right-anchored) average by position so transitions from both fixed endpoints
 * are smooth.
 * First and last points are preserved.
 *
 * @param halfWindow - number of points on each side (0 = disabled)
 */
export function movingAverage<T extends { value: number }>(data: T[], halfWindow: number): T[] {
  if (halfWindow <= 0 || data.length < 3) return data

  const n = data.length

  // Trailing average (anchored to start): average of [max(0, i-halfWindow), i]
  const trailing: number[] = Array.from({ length: n })
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - halfWindow)
    let sum = 0
    for (let j = lo; j <= i; j++) sum += data[j]!.value
    trailing[i] = sum / (i - lo + 1)
  }

  // Leading average (anchored to end): average of [i, min(n-1, i+halfWindow)]
  const leading: number[] = Array.from({ length: n })
  for (let i = 0; i < n; i++) {
    const hi = Math.min(n - 1, i + halfWindow)
    let sum = 0
    for (let j = i; j <= hi; j++) sum += data[j]!.value
    leading[i] = sum / (hi - i + 1)
  }

  // Position-based blend: near start → mostly trailing, near end → mostly leading
  const result = data.map(d => ({ ...d }))
  for (let i = 1; i < n - 1; i++) {
    const t = i / (n - 1)
    result[i]!.value = (1 - t) * trailing[i]! + t * leading[i]!
  }

  return result
}

/**
 * Forward-backward exponential smoothing (zero-phase).
 * Smooths without introducing lag — preserves the dynamics/timing of trends.
 * First and last points are preserved.
 *
 * @param tau - time constant (0 = disabled, higher = smoother)
 */
export function smoothing<T extends { value: number }>(data: T[], tau: number): T[] {
  if (tau <= 0 || data.length < 3) return data

  const alpha = 1 / (1 + tau)
  const n = data.length

  // Forward pass
  const forward: number[] = Array.from({ length: n })
  forward[0] = data[0]!.value
  for (let i = 1; i < n; i++) {
    forward[i] = alpha * data[i]!.value + (1 - alpha) * forward[i - 1]!
  }

  // Backward pass
  const backward: number[] = Array.from({ length: n })
  backward[n - 1] = data[n - 1]!.value
  for (let i = n - 2; i >= 0; i--) {
    backward[i] = alpha * data[i]!.value + (1 - alpha) * backward[i + 1]!
  }

  // Position-based blend: near start → mostly forward, near end → mostly backward
  // This ensures smooth transitions from both fixed endpoints
  const result = data.map(d => ({ ...d }))
  for (let i = 1; i < n - 1; i++) {
    const t = i / (n - 1)
    result[i]!.value = (1 - t) * forward[i]! + t * backward[i]!
  }

  return result
}

export interface ChartFilterSettings {
  averageWindow: number
  smoothingTau: number
}

/**
 * Applies moving average then smoothing in sequence.
 */
export function applyDataCorrection<T extends { value: number }>(
  data: T[],
  settings: ChartFilterSettings,
): T[] {
  let result = data
  result = movingAverage(result, settings.averageWindow)
  result = smoothing(result, settings.smoothingTau)
  return result
}
