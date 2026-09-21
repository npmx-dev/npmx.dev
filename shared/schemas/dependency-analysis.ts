import * as v from 'valibot'
import { PackageNameSchema } from './package'
import { DIRECT_DEPS_HEALTH_MAX } from '#shared/utils/constants'

export const DirectDepsHealthBodySchema = v.object({
  dependencies: v.pipe(
    v.record(PackageNameSchema, v.string()),
    v.check(
      deps => Object.keys(deps).length <= DIRECT_DEPS_HEALTH_MAX,
      `Too many dependencies (max ${DIRECT_DEPS_HEALTH_MAX})`,
    ),
  ),
})
