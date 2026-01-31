# Contributing to npmx.dev

Thank you for your interest in contributing! ❤️ This document provides guidelines and instructions for contributing.

> [!IMPORTANT]
> Please be respectful and constructive in all interactions. We aim to maintain a welcoming environment for all contributors.
> [👉 Read more](./CODE_OF_CONDUCT.md)

## Goals

We want to create 'a fast, modern browser for the npm registry.' This means, among other things:

- We don't aim to replace the [npmjs.com](https://www.npmjs.com/) registry, just provide a better UI and DX.
- Layout shift, flakiness, slowness is The Worst. We need to continually iterate to create the most performant, best DX possible.
- We want to provide information in the best way. We don't want noise, cluttered display, or confusing UI. If in doubt: choose simplicity.

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

### Typescript

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
| Vue components   | PascalCase               | `MarkdownText.vue`             |
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

   > [!IMPORTANT]
   > This file must be committed. Lunaria uses git history to track translation progress, so the build will fail if this file is missing.

5. If the language is `right-to-left`, add `dir: 'rtl'` (see `ar-EG` in config for example)
6. If the language requires special pluralization rules, add a `pluralRule` callback (see `ar-EG` or `ru-RU` in config for examples)

Check [Pluralization rule callback](https://vue-i18n.intlify.dev/guide/essentials/pluralization.html#custom-pluralization) for more info.

### Update translation

We track the current progress of translations with [Lunaria](https://lunaria.dev/) on this site: https://i18n.npmx.dev/
If you see any outdated translations in your language, feel free to update the keys to match then English version.

In order to make sure you have everything up-to-date, you can run:

```bash
pnpm i18n:check <country-code>
```

For example to check if all Japanese translation keys are up-to-date, run:

```bash
pnpm i18n:check ja-JP
```

To automatically add missing keys with English placeholders, use `--fix`:

```bash
pnpm i18n:check:fix fr-FR
```

This will add missing keys with `"EN TEXT TO REPLACE: {english text}"` as placeholder values, making it easier to see what needs translation.

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

### Translation key conventions

- Use dot notation for hierarchy: `section.subsection.key`
- Keep keys descriptive but concise
- Group related keys together
- Use `common.*` for shared strings (loading, retry, close, etc.)
- Use component-specific prefixes: `package.card.*`, `settings.*`, `nav.*`

### Using i18n-ally (recommended)

We recommend the [i18n-ally](https://marketplace.visualstudio.com/items?itemName=lokalise.i18n-ally) VSCode extension for a better development experience:

- Inline translation previews in your code
- Auto-completion for translation keys
- Missing translation detection
- Easy navigation to translation files

The extension is included in our workspace recommendations, so VSCode should prompt you to install it.

### Formatting with locale

When formatting numbers or dates that should respect the user's locale, pass the locale:

```typescript
const { locale } = useI18n()
const formatted = formatNumber(12345, locale.value) // "12,345" in en-US
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

All new components should have a basic accessibility test in `test/nuxt/components.spec.ts`. These tests use [axe-core](https://github.com/dequelabs/axe-core) to catch common accessibility violations.

```typescript
import MyComponent from '~/components/MyComponent.vue'

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

> [!IMPORTANT]
> Just because axe-core doesn't find any obvious issues, it does not mean a component is accessible. Please do additional checks and use best practices.

### End to end tests

Write end-to-end tests using Playwright:

```bash
pnpm test:browser        # Run tests
pnpm test:browser:ui     # Run with Playwright UI
```

Make sure to read about [Playwright best practices](https://playwright.dev/docs/best-practices) and don't rely on classes/IDs but try to follow user-replicable behaviour (like selecting an element based on text content instead).

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
