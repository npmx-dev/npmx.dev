import * as v from 'valibot'
import { PackageNameSchema } from './package'

/**
 * Schema for liking/unliking a package
 */
export const PackageLikeBodySchema = v.object({
  packageName: PackageNameSchema,
})

export type PackageLikeBody = v.InferOutput<typeof PackageLikeBodySchema>

// TODO: add 'avatar'
export const ProfileEditBodySchema = v.object({
  displayName: v.pipe(v.string(), v.maxLength(640)),
  website: v.optional(
    v.union([
      v.literal(''),
      v.pipe(
        v.string(),
        v.url(),
        v.check(
          url => url.startsWith('https://') || url.startsWith('http://'),
          'Website must use http or https',
        ),
      ),
    ]),
  ),
  description: v.optional(v.pipe(v.string(), v.maxLength(2560))),
})

export type ProfileEditBody = v.InferOutput<typeof ProfileEditBodySchema>
