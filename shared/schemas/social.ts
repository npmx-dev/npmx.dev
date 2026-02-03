import * as v from 'valibot'
import { PackageNameSchema } from './package'

/**
 * Schema for liking/unliking a package
 */
export const PackageLikeBodySchema = v.object({
  packageName: PackageNameSchema,
})

export type PackageLikeBody = v.InferOutput<typeof PackageLikeBodySchema>
