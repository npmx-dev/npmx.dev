# Deploy your own npmx

The npmx community operates a public instance at [npmx.dev](https://npmx.dev), but is designed to be open and self-hostable by anyone [on any platform that supports Nuxt](https://nuxt.com/deploy).

To deploy your own instance, follow the steps below for your deployment target.

> [!TIP]
> This page is under construction. More deployment targets are coming soon.

<!-- NOTE: Please list targets alphabetically to remain neutral. -->

## Netlify

1. [Follow the Netlify instructions to import an existing GitHub project](https://docs.netlify.com/start/quickstarts/deploy-from-repository/), selecting https://github.com/npmx-dev/npmx.dev/ when prompted.
2. Generate a long, random key and set it as an environment variable in your new project called `SESSION_PASSWORD`.
3. TODO something something Upstash creds?
4. Run `pnpm remove @vercel/kv && pnpm add @netlify/blobs`
5. Commit and push this change. This will trigger a successful deploy.
6. TODO anything else?

## Vercel

1. [Follow the Vercel instructions to import an existing GitHub project](https://vercel.com/docs/getting-started-with-vercel/import), selecting https://github.com/npmx-dev/npmx.dev/ when prompted.
2. Generate a long, random key and set it as an environment variable in your new project called `SESSION_PASSWORD`.
3. TODO something something Upstash creds?
4. TODO anything else?
