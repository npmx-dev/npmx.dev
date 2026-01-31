import type { OAuthClientMetadataInput, OAuthSession } from '@atproto/oauth-client-node'
import type { EventHandlerRequest, H3Event, SessionManager } from 'h3'
import { NodeOAuthClient } from '@atproto/oauth-client-node'
import { parse } from 'valibot'
import { getOAuthLock } from '#server/utils/atproto/lock'
import { useOAuthStorage } from '#server/utils/atproto/storage'
import { UNSET_NUXT_SESSION_PASSWORD } from '#shared/utils/constants'
import { OAuthMetadataSchema } from '#shared/schemas/oauth'
// TODO: limit scope as features gets added. atproto just allows login so no scary login screen till we have scopes
export const scope = 'atproto'

export function getOauthClientMetadata() {
  const dev = import.meta.dev

  // on dev, match in nuxt.config.ts devServer: { host: "127.0.0.1" }
  const client_uri = dev ? `http://127.0.0.1:3000` : 'https://npmx.dev'
  const redirect_uri = `${client_uri}/api/auth/atproto`

  const client_id = dev
    ? `http://localhost?redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scope)}`
    : `${client_uri}/oauth-client-metadata.json`

  // If anything changes here, please make sure to also update /shared/schemas/oauth.ts to match
  return parse(OAuthMetadataSchema, {
    client_name: 'npmx.dev',
    client_id,
    client_uri,
    scope,
    redirect_uris: [redirect_uri] as [string, ...string[]],
    grant_types: ['authorization_code', 'refresh_token'],
    application_type: 'web',
    token_endpoint_auth_method: 'none',
    dpop_bound_access_tokens: true,
  }) as OAuthClientMetadataInput
}

type EventHandlerWithOAuthSession<T extends EventHandlerRequest, D> = (
  event: H3Event<T>,
  session: OAuthSession | undefined,
  serverSession: SessionManager,
) => Promise<D>

async function getOAuthSession(event: H3Event): Promise<OAuthSession | undefined> {
  const clientMetadata = getOauthClientMetadata()
  const { stateStore, sessionStore } = useOAuthStorage(event)

  const client = new NodeOAuthClient({
    stateStore,
    sessionStore,
    clientMetadata,
    requestLock: getOAuthLock(),
  })

  const currentSession = await sessionStore.get()
  if (!currentSession) return undefined

  // restore using the subject
  return await client.restore(currentSession.tokenSet.sub)
}

export function eventHandlerWithOAuthSession<T extends EventHandlerRequest, D>(
  handler: EventHandlerWithOAuthSession<T, D>,
) {
  return defineEventHandler(async event => {
    const config = useRuntimeConfig(event)

    if (!config.sessionPassword) {
      throw createError({
        status: 500,
        message: UNSET_NUXT_SESSION_PASSWORD,
      })
    }

    const serverSession = await useSession(event, {
      password: config.sessionPassword,
    })

    const oAuthSession = await getOAuthSession(event)
    return await handler(event, oAuthSession, serverSession)
  })
}
