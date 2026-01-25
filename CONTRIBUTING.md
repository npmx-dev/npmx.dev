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

### E2e tests

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

### Commit messages

Write clear, concise commit messages that explain the "why" behind changes:

- `fix: resolve search pagination issue`
- `feat: add package version comparison`
- `docs: update installation instructions`

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
