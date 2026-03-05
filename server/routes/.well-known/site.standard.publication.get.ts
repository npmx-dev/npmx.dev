import { npmxPublicationRkey } from '#shared/utils/atproto'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'content-type', 'text/plain')
  return `at://${NPMX_DEV_DID}/site.standard.publication/${npmxPublicationRkey()}`
})
