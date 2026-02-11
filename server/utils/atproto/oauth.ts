import type {
  OAuthClientMetadata,
  OAuthRedirectUri,
  OAuthSession,
  WebUri,
} from '@atproto/oauth-client-node'
import { JoseKey, Keyset, oauthRedirectUriSchema, webUriSchema } from '@atproto/oauth-client-node'
import type { EventHandlerRequest, H3Event, SessionManager } from 'h3'
import { NodeOAuthClient, AtprotoDohHandleResolver } from '@atproto/oauth-client-node'
import { getOAuthLock } from '#server/utils/atproto/lock'
import { useOAuthStorage } from '#server/utils/atproto/storage'
import { LIKES_SCOPE } from '#shared/utils/constants'
import type { RuntimeConfig } from 'nuxt/schema'
import type { UserServerSession } from '#shared/types/userSession'
// @ts-expect-error virtual file from oauth module
import { clientUri } from '#oauth/config'

// TODO: If you add writing a new record you will need to add a scope for it
export const scope = `atproto ${LIKES_SCOPE}`

/**
 * Resolves a did to a handle via DoH or via the http website calls
 */
export const handleResolver = new AtprotoDohHandleResolver({
  dohEndpoint: 'https://cloudflare-dns.com/dns-query',
})

/**
 * Generates the OAuth client metadata. pkAlg is used to signify that the OAuth client is confendital
 */
export function getOauthClientMetadata(pkAlg: string | undefined = undefined): OAuthClientMetadata {
  const dev = import.meta.dev

  const client_uri = clientUri
  const redirect_uri: OAuthRedirectUri = oauthRedirectUriSchema.parse(
    `${client_uri}/api/auth/atproto`,
  )
  const jwks_uri: WebUri | undefined = pkAlg
    ? webUriSchema.parse(`${client_uri}/.well-known/jwks.json`)
    : undefined

  const client_id = dev
    ? `http://localhost?redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scope)}`
    : `${client_uri}/oauth-client-metadata.json`

  // If anything changes here, please make zsure to also update /shared/schemas/oauth.ts to match
  return {
    client_name: 'npmx.dev',
    client_id,
    client_uri,
    scope,
    redirect_uris: [redirect_uri],
    grant_types: ['authorization_code', 'refresh_token'],
    application_type: 'web',
    dpop_bound_access_tokens: true,
    response_types: ['code'],
    subject_type: 'public',
    authorization_signed_response_alg: 'RS256',
    // confendital client values
    token_endpoint_auth_method: pkAlg ? 'private_key_jwt' : 'none',
    jwks_uri,
    token_endpoint_auth_signing_alg: pkAlg,
  }
}

type EventHandlerWithOAuthSession<T extends EventHandlerRequest, D> = (
  event: H3Event<T>,
  session: OAuthSession | undefined,
  serverSession: SessionManager,
) => Promise<D>

export async function getNodeOAuthClient(
  serverSession: SessionManager,
  config: RuntimeConfig,
): Promise<NodeOAuthClient> {
  const { stateStore, sessionStore } = useOAuthStorage(serverSession)

  // These are optional and not expected or can be used easily in local development, only in production
  const keyset = await loadJWKs(config)
  // @ts-expect-error Taken from statusphere-example-app. Throws a ts error
  const pk = keyset?.findPrivateKey({ use: 'sig' })
  const clientMetadata = getOauthClientMetadata(pk?.alg)

  return new NodeOAuthClient({
    stateStore,
    sessionStore,
    clientMetadata,
    requestLock: getOAuthLock(),
    handleResolver,
    keyset,
  })
}

export async function loadJWKs(config: RuntimeConfig): Promise<Keyset | undefined> {
  // If we ever need to add multiple JWKs to rotate keys we will need to add a new one
  // under a new variable and update here
  const jwkOne = config.oauthJwkOne
  if (!jwkOne) return undefined

  // For multiple keys if we need to rotate
  // const keys = await Promise.all([JoseKey.fromImportable(jwkOne)])

  const keys = await JoseKey.fromImportable(jwkOne)
  return new Keyset([keys])
}

async function getOAuthSession(event: H3Event): Promise<{
  oauthSession: OAuthSession | undefined
  serverSession: SessionManager<UserServerSession>
}> {
  const serverSession = await useServerSession(event)
  const config = useRuntimeConfig(event)

  try {
    const client = await getNodeOAuthClient(serverSession, config)

    const currentSession = serverSession.data
    // TODO (jg): why can a session be `{}`?
    if (!currentSession || !currentSession.public?.did) {
      return { oauthSession: undefined, serverSession }
    }

    const oauthSession = await client.restore(currentSession.public.did)
    return { oauthSession, serverSession }
  } catch (error) {
    // Log error safely without using util.inspect on potentially problematic objects
    // The @atproto library creates error objects with getters that crash Node's util.inspect
    // eslint-disable-next-line no-console
    console.error(
      '[oauth] Failed to get session:',
      error instanceof Error ? error.message : 'Unknown error',
    )
    return { oauthSession: undefined, serverSession }
  }
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
    const { oauthSession, serverSession } = await getOAuthSession(event)

    return await handler(event, oauthSession, serverSession)
  })
}
