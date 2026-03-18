import type { WarningMessage } from '#shared/types/warning'

export function useI18nWarning() {
  const { t } = useI18n()

  return (warning: WarningMessage): string => t(warning.key, warning.data ?? {})
}
