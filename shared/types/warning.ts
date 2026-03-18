export interface WarningMessage {
  /** i18n translation key returned by the API. */
  key: string
  /** Named interpolation params for the translation key. */
  data?: Record<string, string>
}
