# Contributing to npmx.dev

Thank you for your interest in contributing! ❤️ This document provides guidelines and instructions for contributing.

> [!IMPORTANT]
> Please be respectful and constructive in all interactions. We aim to maintain a welcoming environment for all contributors.
> [👉 Read more](./CODE_OF_CONDUCT.md)

## Goals

The goal of [npmx.dev](https://npmx.dev) is to build a fast, modern and open-source browser for the npm registry, prioritizing speed, simplicity and a community-driven developer experience.

### Core values

- Speed
- Simplicity
- Community-first

### Target audience

npmx is built for open-source developers, by open-source developers.

Our goal is to create tools and capabilities that solve real problems for package maintainers and power users, while also providing a great developer experience for everyone who works in the JavaScript ecosystem.

This focus helps guide our project decisions as a community and what we choose to build.

## Table of Contents

- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
- [Development workflow](#development-workflow)
  - [Available commands](#available-commands)
  - [Project structure](#project-structure)
  - [Local connector CLI](#local-connector-cli)
- [Code style](#code-style)
  - [TypeScript](#typescript)
  - [Server API patterns](#server-api-patterns)
  - [Import order](#import-order)
  - [Naming conventions](#naming-conventions)
  - [Vue components](#vue-components)
  - [Internal linking](#internal-linking)
- [RTL Support](#rtl-support)
- [Localization (i18n)](#localization-i18n)
  - [Approach](#approach)
  - [i18n commands](#i18n-commands)
  - [Adding a new locale](#adding-a-new-locale)
  - [Update translation](#update-translation)
  - [Adding translations](#adding-translations)
  - [Translation key conventions](#translation-key-conventions)
  - [Using i18n-ally (recommended)](#using-i18n-ally-recommended)
  - [Formatting numbers and dates](#formatting-numbers-and-dates)
- [Testing](#testing)
  - [Unit tests](#unit-tests)
  - [Component accessibility tests](#component-accessibility-tests)
  - [Lighthouse accessibility tests](#lighthouse-accessibility-tests)
  - [End to end tests](#end-to-end-tests)
  - [Test fixtures (mocking external APIs)](#test-fixtures-mocking-external-apis)
- [Submitting changes](#submitting-changes)
  - [Before submitting](#before-submitting)
  - [Pull request process](#pull-request-process)
  - [Commit messages and PR titles](#commit-messages-and-pr-titles)
- [Pre-commit hooks](#pre-commit-hooks)
- [Using AI](#using-ai)
- [Questions](#questions)
- [License](#license)

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS version recommended)
- [pnpm](https://pnpm.io/) v10.28.1 or later

### Setup

1. fork and clone the repository
2. install dependencies:

   ```bash
   pnpm install
   ```

3. start the development server:

   ```bash
   pnpm dev
   ```

4. (optional) if you want to test the admin UI/flow, you can run the local connector:

   ```bash
   pnpm npmx-connector
   ```

## Development workflow

### Available commands

```bash
# Development
pnpm dev              # Start development server
pnpm build            # Production build
pnpm preview          # Preview production build

# Code Quality
pnpm lint             # Run linter (oxlint + oxfmt)
pnpm lint:fix         # Auto-fix lint issues
pnpm test:types       # TypeScript type checking

# Testing
pnpm test             # Run all Vitest tests
pnpm test:unit        # Unit tests only
pnpm test:nuxt        # Nuxt component tests
pnpm test:browser     # Playwright E2E tests
pnpm test:a11y        # Lighthouse accessibility audits
```

### Project structure

```
app/                    # Nuxt 4 app directory
├── components/         # Vue components (PascalCase.vue)
├── composables/        # Vue composables (useFeature.ts)
├── pages/              # File-based routing
├── plugins/            # Nuxt plugins
├── app.vue             # Root component
└── error.vue           # Error page

server/                 # Nitro server
├── api/                # API routes
└── utils/              # Server utilities

shared/                 # Shared between app and server
└── types/              # TypeScript type definitions

cli/                    # Local connector CLI (separate workspace)
test/                   # Vitest tests
├── unit/               # Unit tests (*.spec.ts)
└── nuxt/               # Nuxt component tests
tests/                  # Playwright E2E tests
```

> [!TIP]
> For more about the meaning of these directories, check out the docs on the [Nuxt directory structure](https://nuxt.com/docs/4.x/directory-structure).

### Local connector CLI

The `cli/` workspace contains a local connector that enables authenticated npm operations from the web UI. It runs on your machine and uses your existing npm credentials.

```bash
# run the connector from the root of the repository
pnpm npmx-connector
```

The connector will check your npm authentication, generate a connection token, and listen for requests from npmx.dev.

## Code style

When committing changes, try to keep an eye out for unintended formatting updates. These can make a pull request look noisier than it really is and slow down the review process. Sometimes IDEs automatically reformat files on save, which can unintentionally introduce extra changes.

To help with this, the project uses `oxfmt` to handle formatting via a pre-commit hook. The hook will automatically reformat files when needed. If something can’t be fixed automatically, it will let you know what needs to be updated before you can commit.

If you want to get ahead of any formatting issues, you can also run `pnpm lint:fix` before committing to fix formatting across the whole project.

### npmx name

When displaying the project name anywhere in the UI, use `npmx` in all lowercase letters.

### TypeScript

- We care about good types &ndash; never cast things to `any` 💪
- Validate rather than just assert

### Server API patterns

#### Input validation with Valibot

Use Valibot schemas from `#shared/schemas/` to validate API inputs. This ensures type safety and provides consistent error messages:

```typescript
import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'

// In your handler:
const { packageName, version } = v.parse(PackageRouteParamsSchema, {
  packageName: rawPackageName,
  version: rawVersion,
})
```

#### Error handling with `handleApiError`

Use the `handleApiError` utility for consistent error handling in API routes. It re-throws H3 errors (like 404s) and wraps other errors with a fallback message:

```typescript
import { ERROR_NPM_FETCH_FAILED } from '#shared/utils/constants'

try {
  // API logic...
} catch (error: unknown) {
  handleApiError(error, {
    statusCode: 502,
    message: ERROR_NPM_FETCH_FAILED,
  })
}
```

#### URL parameter parsing with `parsePackageParams`

Use `parsePackageParams` to extract package name and version from URL segments:

```typescript
const pkgParamSegments = getRouterParam(event, 'pkg')?.split('/') ?? []
const { rawPackageName, rawVersion } = parsePackageParams(pkgParamSegments)
```

This handles patterns like `/pkg`, `/pkg/v/1.0.0`, `/@scope/pkg`, and `/@scope/pkg/v/1.0.0`.

#### Constants

Define error messages and other string constants in `#shared/utils/constants.ts` to ensure consistency across the codebase:

```typescript
export const ERROR_NPM_FETCH_FAILED = 'Failed to fetch package from npm registry.'
```

### Import order

1. Type imports first (`import type { ... }`)
2. External packages
3. Internal aliases (`#shared/types`, `#server/`, etc.)
4. No blank lines between groups

```typescript
import type { Packument, NpmSearchResponse } from '#shared/types'
import type { Tokens } from 'marked'
import { marked } from 'marked'
import { hasProtocol } from 'ufo'
```

### Naming conventions

| Type             | Convention               | Example                        |
| ---------------- | ------------------------ | ------------------------------ |
| Vue components   | PascalCase               | `DateTime.vue`                 |
| Pages            | kebab-case               | `search.vue`, `[...name].vue`  |
| Composables      | camelCase + `use` prefix | `useNpmRegistry.ts`            |
| Server routes    | kebab-case + method      | `search.get.ts`                |
| Functions        | camelCase                | `fetchPackage`, `formatDate`   |
| Constants        | SCREAMING_SNAKE_CASE     | `NPM_REGISTRY`, `ALLOWED_TAGS` |
| Types/Interfaces | PascalCase               | `NpmSearchResponse`            |

> [!TIP]
> Exports in `app/composables/`, `app/utils/`, and `server/utils/` are auto-imported by Nuxt. To prevent [knip](https://knip.dev/) from flagging them as unused, add a `@public` JSDoc annotation:
>
> ```typescript
> /**
>  * @public
>  */
> export function myAutoImportedFunction() {
>   // ...
> }
> ```

### Vue components

- Use Composition API with `<script setup lang="ts">`
- Define props with TypeScript: `defineProps<{ text: string }>()`
- Keep functions under 50 lines
- Accessibility is a first-class consideration &ndash; always consider ARIA attributes and keyboard navigation

```vue
<script setup lang="ts">
import type { PackumentVersion } from '#shared/types'

const props = defineProps<{
  version: PackumentVersion
}>()
</script>
```

Ideally, extract utilities into separate files so they can be unit tested. 🙏

### Internal linking

Always use **object syntax with named routes** for internal navigation. This makes links resilient to URL structure changes and provides type safety via `unplugin-vue-router`.

```vue
<!-- Good: named route -->
<NuxtLink :to="{ name: 'settings' }">Settings</NuxtLink>

<!-- Bad: string path -->
<NuxtLink to="/settings">Settings</NuxtLink>
```

The same applies to programmatic navigation:

```typescript
// Good
navigateTo({ name: 'compare' })
router.push({ name: 'search' })

// Bad
navigateTo('/compare')
router.push('/search')
```

For routes with parameters, pass them explicitly:

```vue
<NuxtLink :to="{ name: '~username', params: { username } }">Profile</NuxtLink>
<NuxtLink :to="{ name: 'org', params: { org: orgName } }">Organization</NuxtLink>
```

Query parameters work as expected:

```vue
<NuxtLink :to="{ name: 'compare', query: { packages: pkg.name } }">Compare</NuxtLink>
```

#### Package routes

For package links, use the auto-imported `packageRoute()` utility from `app/utils/router.ts`. It handles scoped/unscoped packages and optional versions:

```vue
<!-- Links to /package/vue -->
<NuxtLink :to="packageRoute('vue')">vue</NuxtLink>

<!-- Links to /package/@nuxt/kit -->
<NuxtLink :to="packageRoute('@nuxt/kit')">@nuxt/kit</NuxtLink>

<!-- Links to /package/vue/v/3.5.0 -->
<NuxtLink :to="packageRoute('vue', '3.5.0')">vue@3.5.0</NuxtLink>
```

> [!IMPORTANT]
> Never construct package URLs as strings. The route structure uses separate `org` and `name` params, and `packageRoute()` handles the splitting correctly.

#### Available route names

| Route name        | URL pattern                       | Parameters                |
| ----------------- | --------------------------------- | ------------------------- |
| `index`           | `/`                               | &mdash;                   |
| `about`           | `/about`                          | &mdash;                   |
| `compare`         | `/compare`                        | &mdash;                   |
| `privacy`         | `/privacy`                        | &mdash;                   |
| `search`          | `/search`                         | &mdash;                   |
| `settings`        | `/settings`                       | &mdash;                   |
| `package`         | `/package/:org?/:name`            | `org?`, `name`            |
| `package-version` | `/package/:org?/:name/v/:version` | `org?`, `name`, `version` |
| `code`            | `/package-code/:path+`            | `path` (array)            |
| `docs`            | `/package-docs/:path+`            | `path` (array)            |
| `org`             | `/org/:org`                       | `org`                     |
| `~username`       | `/~:username`                     | `username`                |
| `~username-orgs`  | `/~:username/orgs`                | `username`                |

## RTL Support

We support `right-to-left` languages, we need to make sure that the UI is working correctly in both directions.

Simple approach used by most websites of relying on direction set in HTML element does not work because direction for various items, such as timeline, does not always match direction set in HTML.

We've added some `UnoCSS` utilities styles to help you with that:

- Do not use `left/right` padding and margin: for example `pl-1`. Use `padding-inline-start/end` instead. So `pl-1` should be `ps-1`, `pr-1` should be `pe-1`. The same rules apply to margin.
- Do not use `rtl-` classes, such as `rtl-left-0`.
- For icons that should be rotated for RTL, add `class="rtl-flip"`. This can only be used for icons outside of elements with `dir="auto"`.
- For absolute positioned elements, don't use `left/right`: for example `left-0`. Use `inset-inline-start/end` instead. `UnoCSS` shortcuts are `inset-is` for `inset-inline-start` and `inset-ie` for `inset-inline-end`. Example: `left-0` should be replaced with `inset-is-0`.
- If you need to change the border radius for an entire left or right side, use `border-inline-start/end`. `UnoCSS` shortcuts are `rounded-is` for left side, `rounded-ie` for right side. Example: `rounded-l-5` should be replaced with `rounded-is-5`.
- If you need to change the border radius for one corner, use `border-start-end-radius` and similar rules. `UnoCSS` shortcuts are `rounded` + top/bottom as either `-bs` (top) or `-be` (bottom) + left/right as either `-is` (left) or `-ie` (right). Example: `rounded-tl-0` should be replaced with `rounded-bs-is-0`.

## Localization (i18n)

npmx.dev uses [@nuxtjs/i18n](https://i18n.nuxtjs.org/) for internationalization. We aim to make the UI accessible to users in their preferred language.

### Approach

- All user-facing strings should use translation keys via `$t()` in templates and script
- Translation files live in [`i18n/locales/`](i18n/locales) (e.g., `en-US.json`)
- We use the `no_prefix` strategy (no `/en-US/` or `/fr-FR/` in URLs)
- Locale preference is stored in cookies and respected on subsequent visits

### i18n commands

The following scripts help manage translation files. `en.json` is the reference locale.

| Command                        | Description                                                                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm i18n:check [locale]`     | Compares `en.json` with other locale files. Shows missing and extra keys. Optionally filter output by locale (e.g. `pnpm i18n:check ja-JP`).                                            |
| `pnpm i18n:check:fix [locale]` | Same as check, but adds missing keys to other locales with English placeholders.                                                                                                        |
| `pnpm i18n:report`             | Audits translation keys against code usage in `.vue` and `.ts` files. Reports missing keys (used in code but not in locale), unused keys (in locale but not in code), and dynamic keys. |
| `pnpm i18n:report:fix`         | Removes unused keys from `en.json` and all other locale files.                                                                                                                          |

### Adding a new locale

We are using localization using country variants (ISO-6391) via [multiple translation files](https://i18n.nuxtjs.org/docs/guide/lazy-load-translations#multiple-files-lazy-loading) to avoid repeating every key per country.

The [config/i18n.ts](./config/i18n.ts) configuration file will be used to register the new locale:

- `countryLocaleVariants` object will be used to register the country variants
- `locales` object will be used to link the supported locales (country and single one)
- `buildLocales` function will build the target locales

To add a new locale:

1. Create a new JSON file in [`i18n/locales/`](./i18n/locales) with the locale code as the filename (e.g., `uk-UA.json`, `de-DE.json`)
2. Copy [`en.json`](./i18n/locales/en.json) and translate the strings
3. Add the locale to the `locales` array in [config/i18n.ts](./config/i18n.ts):

   ```typescript
   {
     code: 'uk-UA',        // Must match the filename (without .json)
     file: 'uk-UA.json',
     name: 'Українська',   // Native name of the language
   },
   ```

4. Copy your translation file to `lunaria/files/` for translation tracking:

   ```bash
   cp i18n/locales/uk-UA.json lunaria/files/uk-UA.json
   ```

   > ⚠**Important:**
   > This file must be committed. Lunaria uses git history to track translation progress, so the build will fail if this file is missing.

5. If the language is `right-to-left`, add `dir: 'rtl'` (see `ar-EG` in config for example)
6. If the language requires special pluralization rules, add a `pluralRule` callback (see `ar-EG` or `ru-RU` in config for examples)

Check [Pluralization rule callback](https://vue-i18n.intlify.dev/guide/essentials/pluralization#custom-pluralization) and [Plural Rules](https://cldr.unicode.org/index/cldr-spec/plural-rules#TOC-Determining-Plural-Categories) for more info.

### Update translation

We track the current progress of translations with [Lunaria](https://lunaria.dev/) on this site: https://i18n.npmx.dev/
If you see any outdated translations in your language, feel free to update the keys to match the English version.

Use `pnpm i18n:check` and `pnpm i18n:check:fix` to verify and fix your locale (see [i18n commands](#i18n-commands) above for details).

#### Country variants (advanced)

Most languages only need a single locale file. Country variants are only needed when you want to support regional differences (e.g., `es-ES` for Spain vs `es-419` for Latin America).

If you need country variants:

1. Create a base language file (e.g., `es.json`) with all translations
2. Create country variant files (e.g., `es-ES.json`, `es-419.json`) with only the differing translations
3. Register the base language in `locales` and add variants to `countryLocaleVariants`

See how `es`, `es-ES`, and `es-419` are configured in [config/i18n.ts](./config/i18n.ts) for a complete example.

### Adding translations

1. Add your translation key to `i18n/locales/en.json` first (American English is the source of truth)
2. Use the key in your component:

   ```vue
   <template>
     <p>{{ $t('my.translation.key') }}</p>
   </template>
   ```

   Or in script:

   ```typescript
   <script setup lang="ts">
   const message = computed(() => $t('my.translation.key'))
   </script>
   ```

3. For dynamic values, use interpolation:

   ```json
   { "greeting": "Hello, {name}!" }
   ```

   ```vue
   <p>{{ $t('greeting', { name: userName }) }}</p>
   ```

4. Don't concatenate string messages in the Vue templates, some languages can have different word order. Use placeholders instead.

   **Bad:**

   ```vue
   <p>{{ $t('hello') }} {{ userName }}</p>
   ```

   **Good:**

   ```vue
   <p>{{ $t('greeting', { name: userName }) }}</p>
   ```

   **Complex content:**

   If you need to include HTML or components inside the translation, use [`i18n-t`](https://vue-i18n.intlify.dev/guide/advanced/component.html) component. This is especially useful when the order of elements might change between languages.

   ```json
   {
     "agreement": "I accept the {terms} and {privacy}.",
     "terms_link": "Terms of Service",
     "privacy_policy": "Privacy Policy"
   }
   ```

   ```vue
   <i18n-t keypath="agreement" tag="p">
     <template #terms>
       <NuxtLink to="/terms">{{ $t('terms_link') }}</NuxtLink>
     </template>
     <template #privacy>
       <strong>{{ $t('privacy_policy') }}</strong>
     </template>
   </i18n-t>
   ```

### Translation key conventions

- Use dot notation for hierarchy: `section.subsection.key`
- Keep keys descriptive but concise
- Group related keys together
- Use `common.*` for shared strings (loading, retry, close, etc.)
- Use component-specific prefixes: `package.card.*`, `settings.*`, `nav.*`
- Do not use dashes (`-`) in translation keys; always use underscore (`_`): e.g., `privacy_policy` instead of `privacy-policy`
- **Always use static string literals as translation keys.** Our i18n scripts (`pnpm i18n:report`) rely on static analysis to detect unused and missing keys. Dynamic keys cannot be analyzed and will be flagged as errors.

  **Bad:**

  ```vue
  <!-- Template literal -->
  <p>{{ $t(`package.tabs.${tab}`) }}</p>

  <!-- Variable -->
  <p>{{ $t(myKey) }}</p>
  ```

  **Good:**

  ```typescript
  const { t } = useI18n()

  const tabLabels = computed(() => ({
    readme: t('package.tabs.readme'),
    versions: t('package.tabs.versions'),
  }))
  ```

  ```vue
  <p>{{ tabLabels[tab] }}</p>
  ```

### Using i18n-ally (recommended)

We recommend the [i18n-ally](https://marketplace.visualstudio.com/items?itemName=lokalise.i18n-ally) VSCode extension for a better development experience:

- Inline translation previews in your code
- Auto-completion for translation keys
- Missing translation detection
- Easy navigation to translation files

The extension is included in our workspace recommendations, so VSCode should prompt you to install it.

### Formatting numbers and dates

Use vue-i18n's built-in formatters for locale-aware formatting:

```vue
<template>
  <p>{{ $n(12345) }}</p>
  <!-- "12,345" in en-US, "12 345" in fr-FR -->
  <p>{{ $d(new Date()) }}</p>
  <!-- locale-aware date -->
</template>
```

## Testing

### Unit tests

Write unit tests for core functionality using Vitest:

```typescript
import { describe, it, expect } from 'vitest'

describe('featureName', () => {
  it('should handle expected case', () => {
    expect(result).toBe(expected)
  })
})
```

> [!TIP]
> If you need access to the Nuxt context in your unit or component test, place your test in the `test/nuxt/` directory and run with `pnpm test:nuxt`

### Component accessibility tests

All Vue components should have accessibility tests in `test/nuxt/a11y.spec.ts`. These tests use [axe-core](https://github.com/dequelabs/axe-core) to catch common accessibility violations and run in a real browser environment via Playwright.

```typescript
import { MyComponent } from '#components'

describe('MyComponent', () => {
  it('should have no accessibility violations', async () => {
    const component = await mountSuspended(MyComponent, {
      props: {
        /* required props */
      },
    })
    const results = await runAxe(component)
    expect(results.violations).toEqual([])
  })
})
```

The `runAxe` helper handles DOM isolation and disables page-level rules that don't apply to isolated component testing.

A coverage test in `test/unit/a11y-component-coverage.spec.ts` ensures all components are either tested or explicitly skipped with justification. When you add a new component, this test will fail until you add accessibility tests for it.

> [!IMPORTANT]
> Just because axe-core doesn't find any obvious issues, it does not mean a component is accessible. Please do additional checks and use best practices.

### Lighthouse accessibility tests

In addition to component-level axe audits, the project runs full-page accessibility audits using [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci). These test the rendered pages in both light and dark mode against Lighthouse's accessibility category, requiring a perfect score.

#### How it works

1. The project is built in test mode (`pnpm build:test`), which activates server-side fixture mocking
2. Lighthouse CI starts a preview server and audits three URLs: `/`, `/search?q=nuxt`, and `/package/nuxt`
3. A Puppeteer setup script (`lighthouse-setup.cjs`) runs before each audit to set the color mode and intercept client-side API requests using the same fixtures as the E2E tests

#### Running locally

```bash
# Build + run both light and dark audits
pnpm test:a11y

# Or against an existing test build
pnpm test:a11y:prebuilt

# Or run a single color mode manually
pnpm build:test
LIGHTHOUSE_COLOR_MODE=dark ./scripts/lighthouse-a11y.sh
```

This requires Chrome or Chromium to be installed. The script will auto-detect common installation paths. Results are printed to the terminal and saved in `.lighthouseci/`.

#### Configuration

| File                         | Purpose                                                   |
| ---------------------------- | --------------------------------------------------------- |
| `.lighthouserc.cjs`          | Lighthouse CI config (URLs, assertions, Chrome path)      |
| `lighthouse-setup.cjs`       | Puppeteer script for color mode + client-side API mocking |
| `scripts/lighthouse-a11y.sh` | Shell wrapper that runs the audit for a given color mode  |

### End to end tests

Write end-to-end tests using Playwright:

```bash
pnpm test:browser        # Run tests
pnpm test:browser:ui     # Run with Playwright UI
```

Make sure to read about [Playwright best practices](https://playwright.dev/docs/best-practices) and don't rely on classes/IDs but try to follow user-replicable behaviour (like selecting an element based on text content instead).

### Test fixtures (mocking external APIs)

E2E tests use a fixture system to mock external API requests, ensuring tests are deterministic and don't hit real APIs. This is handled at two levels:

**Server-side mocking** (`modules/fixtures.ts` + `modules/runtime/server/cache.ts`):

- Intercepts all `$fetch` calls during SSR
- Serves pre-recorded fixture data from `test/fixtures/`
- Enabled via `NUXT_TEST_FIXTURES=true` or Nuxt test mode

**Client-side mocking** (`test/fixtures/mock-routes.cjs`):

- Shared URL matching and response generation logic used by both Playwright E2E tests and Lighthouse CI
- Playwright tests (`test/e2e/test-utils.ts`) use this via `page.route()` interception
- Lighthouse tests (`lighthouse-setup.cjs`) use this via Puppeteer request interception
- All E2E test files import from `./test-utils` instead of `@nuxt/test-utils/playwright`
- Throws a clear error if an unmocked external request is detected

#### Fixture files

Fixtures are stored in `test/fixtures/` with this structure:

```
test/fixtures/
├── npm-registry/
│   ├── packuments/       # Package metadata (vue.json, @nuxt/kit.json)
│   ├── search/           # Search results (vue.json, nuxt.json)
│   └── orgs/             # Org package lists (nuxt.json)
├── npm-api/
│   └── downloads/        # Download stats
└── users/                # User package lists
```

#### Adding new fixtures

1. **Generate fixtures** using the script:

   ```bash
   pnpm generate:fixtures vue lodash @nuxt/kit
   ```

2. **Or manually create** a JSON file in the appropriate directory

#### Environment variables

| Variable                          | Purpose                            |
| --------------------------------- | ---------------------------------- |
| `NUXT_TEST_FIXTURES=true`         | Enable server-side fixture mocking |
| `NUXT_TEST_FIXTURES_VERBOSE=true` | Enable detailed fixture logging    |

#### When tests fail due to missing fixtures

If a test fails with an error like:

```
UNMOCKED EXTERNAL API REQUEST DETECTED
API:  npm registry
URL:  https://registry.npmjs.org/some-package
```

You need to either:

1. Add a fixture file for that package/endpoint
2. Update the mock handlers in `test/fixtures/mock-routes.cjs` (client) or `modules/runtime/server/cache.ts` (server)

## Submitting changes

### Before submitting

1. ensure your code follows the style guidelines
2. run linting: `pnpm lint:fix`
3. run type checking: `pnpm test:types`
4. run tests: `pnpm test`
5. write or update tests for your changes

### Pull request process

1. create a feature branch from `main`
2. make your changes with clear, descriptive commits
3. push your branch and open a pull request
4. ensure CI checks pass (lint, type check, tests)
5. request review from maintainers

### Commit messages and PR titles

Write clear, concise PR titles that explain the "why" behind changes.

We use [Conventional Commits](https://www.conventionalcommits.org/). Since we squash on merge, the PR title becomes the commit message in `main`, so it's important to get it right.

Format: `type(scope): description`

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Scopes (optional):** `docs`, `i18n`, `deps`

**Examples:**

- `fix: resolve search pagination issue`
- `feat: add package version comparison`
- `fix(i18n): update French translations`
- `chore(deps): update vite to v6`

> [!NOTE]
> The subject must start with a lowercase letter. Individual commit messages within your PR don't need to follow this format since they'll be squashed.

### PR descriptions

If your pull request directly addresses an open issue, use the following inside your PR description.

```text
Resolves | Fixes | Closes: #xxx
```

Replace `#xxx` with either a URL to the issue, or the number of the issue. For example:

```text
Fixes #123
```

or

```text
Closes https://github.com/npmx-dev/npmx.dev/issues/123
```

This provides the following benefits:

- it links the pull request to the issue (the merge icon will appear in the issue), so everybody can see there is an open PR
- when the pull request is merged, the linked issue is automatically closed

## Pre-commit hooks

The project uses `lint-staged` with `simple-git-hooks` to automatically lint files on commit.

## Using AI

You're welcome to use AI tools to help you contribute. But there are two important ground rules:

### 1. Never let an LLM speak for you

When you write a comment, issue, or PR description, use your own words. Grammar and spelling don't matter &ndash; real connection does. AI-generated summaries tend to be long-winded, dense, and often inaccurate. Simplicity is an art. The goal is not to sound impressive, but to communicate clearly.

### 2. Never let an LLM think for you

Feel free to use AI to write code, tests, or point you in the right direction. But always understand what it's written before contributing it. Take personal responsibility for your contributions. Don't say "ChatGPT says..." &ndash; tell us what _you_ think.

For more context, see [Using AI in open source](https://roe.dev/blog/using-ai-in-open-source).

## Questions?

If you have questions or need help, feel free to open an issue for discussion or join our [Discord server](https://chat.npmx.dev).

## License

By contributing to npmx.dev, you agree that your contributions will be licensed under the [MIT License](LICENSE).
