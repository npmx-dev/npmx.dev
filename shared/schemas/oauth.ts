import { object, string, pipe, url, array, minLength, boolean } from 'valibot'

export const OAuthMetadataSchema = object({
  client_id: pipe(string(), url()),
  client_name: string(),
  client_uri: pipe(string(), url()),
  redirect_uris: pipe(array(string()), minLength(1)),
  scope: string(),
  grant_types: array(string()),
  application_type: string(),
  token_endpoint_auth_method: string(),
  dpop_bound_access_tokens: boolean(),
  response_types: array(string()),
})
