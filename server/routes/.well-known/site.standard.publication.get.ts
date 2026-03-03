import { npmxPublicationRkey } from '#shared/utils/atproto'

export default defineEventHandler(async _ => {
  return `at://${NPMX_DEV_DID}/site.standard.publication/${npmxPublicationRkey()}`
})
