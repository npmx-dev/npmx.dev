import type { OAuthClientMetadataInput, OAuthSession } from '@atproto/oauth-client-node'
import type { EventHandlerRequest, H3Event, SessionManager } from 'h3'
import { NodeOAuthClient } from '@atproto/oauth-client-node'
import { parse } from 'valibot'
import { getOAuthLock } from '#server/utils/atproto/lock'
import { useOAuthStorage } from '#server/utils/atproto/storage'
import { LIKES_SCOPE } from '#shared/utils/constants'
import { OAuthMetadataSchema } from '#shared/schemas/oauth'
// @ts-expect-error virtual file from oauth module
import { clientUri } from '#oauth/config'
// TODO: If you add writing a new record you will need to add a scope for it
export const scope = `atproto ${LIKES_SCOPE}`

export function getOauthClientMetadata() {
  const dev = import.meta.dev

  const client_uri = clientUri
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
    response_types: ['code'],
  }) as OAuthClientMetadataInput
}

type EventHandlerWithOAuthSession<T extends EventHandlerRequest, D> = (
  event: H3Event<T>,
  session: OAuthSession | undefined,
  serverSession: SessionManager,
) => Promise<D>

async function getOAuthSession(event: H3Event): Promise<OAuthSession | undefined> {
  const clientMetadata = getOauthClientMetadata()
  const serverSession = await useServerSession(event)
  const { stateStore, sessionStore } = useOAuthStorage(serverSession)

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

/**
 * Throws if the logged in OAuth Session does not have the required scopes.
 * As we add new scopes we need to check if the client has the ability to use it.
 * If not need to let the client know to redirect the user to the PDS to upgrade their scopes.
 * @param oAuthSession - The current OAuth session from the event
 * @param requiredScopes - The required scope you are checking if you can use
 */
export async function throwOnMissingOAuthScope(oAuthSession: OAuthSession, requiredScopes: string) {
  const tokenInfo = await oAuthSession.getTokenInfo()
  if (!tokenInfo.scope.includes(requiredScopes)) {
    throw createError({
      status: 403,
      message: ERROR_NEED_REAUTH,
    })
  }
}

export function eventHandlerWithOAuthSession<T extends EventHandlerRequest, D>(
  handler: EventHandlerWithOAuthSession<T, D>,
) {
  return defineEventHandler(async event => {
    const serverSession = await useServerSession(event)

    const oAuthSession = await getOAuthSession(event)
    return await handler(event, oAuthSession, serverSession)
  })
}
