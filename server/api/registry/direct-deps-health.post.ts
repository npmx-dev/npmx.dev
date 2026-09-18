import * as v from 'valibot'
import type { DirectDependencyHealthResult } from '#shared/types/dependency-analysis'
import { DirectDepsHealthBodySchema } from '#shared/schemas/dependency-analysis'
import { analyzeDirectDependencyHealth } from '#server/utils/dependency-analysis'

/**
 * POST /api/registry/direct-deps-health
 *
 * Resolve declared dependency ranges and report which packages are vulnerable
 * or deprecated at the resolved version (direct packages only — no tree walk).
 */
export default defineEventHandler(async (event): Promise<DirectDependencyHealthResult> => {
  const body = v.parse(DirectDepsHealthBodySchema, await readBody(event))
  return await analyzeDirectDependencyHealth(body.dependencies)
})
