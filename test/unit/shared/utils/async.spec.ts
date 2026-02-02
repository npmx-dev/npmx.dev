import { describe, expect, it, vi } from 'vitest'
import { mapWithConcurrency } from '../../../../shared/utils/async'

describe('mapWithConcurrency', () => {
  it('processes all items and returns results in order', async () => {
    const items = [1, 2, 3, 4, 5]
    const results = await mapWithConcurrency(items, async x => x * 2)

    expect(results).toEqual([2, 4, 6, 8, 10])
  })

  it('respects concurrency limit', async () => {
    let concurrent = 0
    let maxConcurrent = 0

    const items = Array.from({ length: 10 }, (_, i) => i)

    await mapWithConcurrency(
      items,
      async () => {
        concurrent++
        maxConcurrent = Math.max(maxConcurrent, concurrent)
        await new Promise(resolve => setTimeout(resolve, 10))
        concurrent--
      },
      3,
    )

    expect(maxConcurrent).toBe(3)
  })

  it('handles empty array', async () => {
    const results = await mapWithConcurrency([], async x => x)
    expect(results).toEqual([])
  })

  it('handles single item', async () => {
    const results = await mapWithConcurrency([42], async x => x * 2)
    expect(results).toEqual([84])
  })

  it('passes index to callback', async () => {
    const items = ['a', 'b', 'c']
    const results = await mapWithConcurrency(items, async (item, index) => `${item}${index}`)

    expect(results).toEqual(['a0', 'b1', 'c2'])
  })

  it('propagates errors', async () => {
    const items = [1, 2, 3]
    const fn = vi.fn(async (x: number) => {
      if (x === 2) throw new Error('test error')
      return x
    })

    await expect(mapWithConcurrency(items, fn)).rejects.toThrow('test error')
  })

  it('uses default concurrency of 10', async () => {
    let concurrent = 0
    let maxConcurrent = 0

    const items = Array.from({ length: 20 }, (_, i) => i)

    await mapWithConcurrency(items, async () => {
      concurrent++
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      await new Promise(resolve => setTimeout(resolve, 5))
      concurrent--
    })

    expect(maxConcurrent).toBe(10)
  })

  it('handles fewer items than concurrency limit', async () => {
    let concurrent = 0
    let maxConcurrent = 0

    const items = [1, 2, 3]

    await mapWithConcurrency(
      items,
      async () => {
        concurrent++
        maxConcurrent = Math.max(maxConcurrent, concurrent)
        await new Promise(resolve => setTimeout(resolve, 10))
        concurrent--
      },
      10,
    )

    // Should only have 3 concurrent since we only have 3 items
    expect(maxConcurrent).toBe(3)
  })
})
