import { JoseKey } from '@atproto/oauth-client-node'

async function run() {
  const kid = Date.now().toString()
  const key = await JoseKey.generate(['ES256'], kid)
  const jwk = key.privateJwk

  console.log(JSON.stringify(jwk))
}

await run()
