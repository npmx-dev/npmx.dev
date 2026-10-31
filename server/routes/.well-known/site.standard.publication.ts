import { npmxPublicationRkey } from '#shared/utils/atproto'
import { defineEventHandler, setResponseHeader } from 'nitro/h3'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'content-type', 'text/plain')
  return `at://${NPMX_DEV_DID}/site.standard.publication/${npmxPublicationRkey()}`
})
