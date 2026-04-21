import type { ShallowRef } from 'vue'

type UseClipboardAsyncReturn = {
  copy: () => void
  copied: ShallowRef<boolean>
}

type UseClipboardAsyncOptions = {
  copiedDuring: number
}

export function useClipboardAsync(
  fn: () => Promise<string>,
  options?: UseClipboardAsyncOptions,
): UseClipboardAsyncReturn {
  const copied = shallowRef(false)
  const timeout = useTimeoutFn(() => (copied.value = false), options?.copiedDuring ?? 0, {
    immediate: false,
  })

  async function copy() {
    const asyncClipboard = new ClipboardItem({
      'text/plain': fn().then(text => {
        return new Blob([text], { type: 'text/plain' })
      }),
    })

    try {
      await navigator.clipboard.write([asyncClipboard])
      copied.value = true
      timeout.start()
    } catch {
      copied.value = false
    }
  }

  return {
    copy,
    copied,
  }
}
