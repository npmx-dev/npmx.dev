/**
 * Async utilities for controlled concurrency and parallel execution.
 */

/**
 * Map over an array with limited concurrency.
 * Similar to Promise.all but limits how many promises run simultaneously.
 *
 * @param items - Array of items to process
 * @param fn - Async function to apply to each item
 * @param concurrency - Maximum number of concurrent operations (default: 10)
 * @returns Array of results in the same order as input
 *
 * @example
 * const results = await mapWithConcurrency(urls, fetchUrl, 5)
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency = 10,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length }) as R[]
  let currentIndex = 0

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++
      results[index] = await fn(items[index]!, index)
    }
  }

  // Start workers up to concurrency limit
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)

  return results
}
