export class AbortedError extends Error {}

export function checkAborted(abortController: AbortController): Promise<void> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      if (abortController.signal.aborted) {
        reject(new AbortedError('pkg-size-aborted'))
      } else {
        resolve()
      }
    }, 0),
  )
}
