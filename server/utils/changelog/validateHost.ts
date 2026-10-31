import { providerNeedsHost, validateHost, type ProviderId } from '~~/shared/utils/git-providers'
import * as v from 'valibot'
import { ERROR_UNKNOWN_GIT_HOST } from '~~/shared/utils/constants'

export function validateHostWithValibot(provider: ProviderId) {
  return v.optional(
    v.custom<string>(host => {
      if (!providerNeedsHost(provider)) return true
      if (typeof host !== 'string') return false
      return validateHost(provider, host)
    }, ERROR_UNKNOWN_GIT_HOST),
    '',
  )
}
