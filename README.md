# npmx.dev

> A fast, modern npm package browser for power users.

<p align="center">
  <a href="https://npmx.dev/">
    <img width="1090" alt="Screenshot of npmx.dev showing the nuxt package" src="https://github.com/user-attachments/assets/229497a2-8491-461c-aa1d-fba981215340">
  </a>
</p>

- [👉 &nbsp;Check it out](https://npmx.dev/)

## Vision

The aim of [npmx.dev](https://npmx.dev) is to provide a better npm package browsing experience - fast, accessible, and designed for power users.

- **Speed first** - Insanely fast searching, filtering, and navigation.
- **URL compatible** - Replace `npmjs.com` with `xnpmjs.com` or `npmx.dev` in any URL and it just works.
- **Provenance aware** - See at a glance which packages have verified build provenance.

## Features

- **Dark mode by default** - Easy on the eyes, no toggle needed
- **Package browsing** - Fast search, package details, READMEs, versions, dependencies
- **Dependencies view** - Shows regular dependencies and peer dependencies (with optional badges)
- **User profiles** - View any npm user's public packages at `/~username`
- **Organization pages** - Browse org packages at `/org/orgname`
- **Provenance indicators** - Verified build indicators for packages with npm provenance
- **Admin features** - Org/team management, package access controls via local connector

### URL Compatibility

npmx.dev supports npm permalink patterns:

| Pattern | Example |
|---------|---------|
| `/package/<name>` | [`/package/nuxt`](https://npmx.dev/package/nuxt) |
| `/package/@scope/name` | [`/package/@nuxt/kit`](https://npmx.dev/package/@nuxt/kit) |
| `/package/<name>/v/<version>` | [`/package/vue/v/3.4.0`](https://npmx.dev/package/vue/v/3.4.0) |
| `/search?q=<query>` | [`/search?q=vue`](https://npmx.dev/search?q=vue) |
| `/~<username>` | [`/~sindresorhus`](https://npmx.dev/~sindresorhus) |
| `/org/<name>` | [`/org/nuxt`](https://npmx.dev/org/nuxt) |

**Coming soon** (with local connector): `/package/<name>/access`, `/package/<name>/collaborators`, `/settings/*`

## Tech Stack

- [Nuxt 4](https://nuxt.com/) - Vue framework
- [Nitro](https://nuxt.com/docs/guide/concepts/server-engine) - Server engine with API routes
- [UnoCSS](https://unocss.dev/) - Atomic CSS engine
- [nuxt-og-image](https://github.com/nuxt-modules/og-image) - Dynamic OG images
- [npm Registry API](https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md) - Package data

## Try it out locally

### Setup

```bash
# install dependencies
corepack enable
pnpm install

# serve in dev mode, with hot reload at localhost:3000
pnpm dev

# build for production
pnpm build

# preview in production mode
pnpm preview
```

### Testing

```bash
# run all tests
pnpm test

# run unit tests
pnpm test:unit

# run e2e tests
pnpm test:browser

# type check
pnpm test:types
```

## License

Made with ❤️

Published under [MIT License](./LICENSE).
