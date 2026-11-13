import * as v from 'valibot'
import { PackageNameSchema } from './package'
import { parseSubjectRef } from '../utils/collections'
import {
  MAX_COLLECTION_DESCRIPTION_LENGTH,
  MAX_COLLECTION_ITEMS,
  MAX_COLLECTION_NAME_LENGTH,
  MAX_COLLECTION_NOTE_LENGTH,
} from '../utils/constants'

/**
 * Schema for liking/unliking a package
 */
export const PackageLikeBodySchema = v.object({
  packageName: PackageNameSchema,
})

// Limits mirror lexicons/dev/npmx/collection.json
const CollectionItemSchema = v.object({
  subjectRef: v.pipe(
    v.string(),
    v.maxBytes(300),
    v.check(subjectRef => parseSubjectRef(subjectRef) !== null, 'Invalid package or collection'),
  ),
  note: v.optional(v.pipe(v.string(), v.maxBytes(560), v.maxGraphemes(MAX_COLLECTION_NOTE_LENGTH))),
})

/**
 * Schema for creating or updating a collection through npmx.dev. Stricter than the lexicon
 * (non-empty name, known subjectRef kinds), since we only want to write records we can render.
 */
export const CollectionBodySchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty(),
    v.maxLength(640),
    v.maxGraphemes(MAX_COLLECTION_NAME_LENGTH),
  ),
  description: v.optional(
    v.pipe(v.string(), v.maxLength(3000), v.maxGraphemes(MAX_COLLECTION_DESCRIPTION_LENGTH)),
  ),
  items: v.pipe(v.array(CollectionItemSchema), v.maxLength(MAX_COLLECTION_ITEMS)),
})

/** `cid` is the version the editor started from; a stale one makes the write fail with 409. */
export const CollectionUpdateBodySchema = v.object({
  ...CollectionBodySchema.entries,
  cid: v.pipe(v.string(), v.nonEmpty()),
})

/** Adds and removes items without sending the whole collection, as the picker does. */
export const CollectionItemsChangeSchema = v.pipe(
  v.object({
    add: v.optional(
      v.pipe(v.array(CollectionItemSchema.entries.subjectRef), v.maxLength(MAX_COLLECTION_ITEMS)),
      [],
    ),
    remove: v.optional(v.pipe(v.array(v.string()), v.maxLength(MAX_COLLECTION_ITEMS)), []),
  }),
  v.check(({ add, remove }) => !add.some(ref => remove.includes(ref)), 'Add and remove overlap'),
)

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
