import * as v from 'valibot'
import { PackageNameSchema } from '../schemas/package'
import { NPMX_SITE } from './constants'
import * as dev from '../types/lexicons/dev'

export type CollectionSubject =
  | { kind: 'package'; packageName: string }
  | { kind: 'collection'; uri: string; did: string; rkey: string }

const PACKAGE_SUBJECT_PREFIX = `${NPMX_SITE}/package/`
// DIDs only: records must not reference accounts by handle, which can change.
const COLLECTION_AT_URI_RE = new RegExp(
  `^at://(did:[a-z]+:[a-zA-Z0-9._:%-]+)/${dev.npmx.collection.$nsid.replaceAll('.', '\\.')}/([a-zA-Z0-9._:~-]{1,512})$`,
)

/**
 * Classifies a collection item's or like's `subjectRef`. Returns null for anything we don't
 * understand; records are untrusted, so callers render that as unresolvable.
 */
export function parseSubjectRef(subjectRef: string): CollectionSubject | null {
  if (subjectRef.startsWith(PACKAGE_SUBJECT_PREFIX)) {
    const packageName = subjectRef.slice(PACKAGE_SUBJECT_PREFIX.length)
    return v.is(PackageNameSchema, packageName) ? { kind: 'package', packageName } : null
  }
  const match = COLLECTION_AT_URI_RE.exec(subjectRef)
  if (match) {
    return { kind: 'collection', uri: subjectRef, did: match[1]!, rkey: match[2]! }
  }
  return null
}
