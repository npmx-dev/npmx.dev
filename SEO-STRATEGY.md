# SEO Strategy for npmx.dev

This document outlines the technical SEO strategy adopted for `npmx.dev`, considering its nature as a dynamic SSR application with infinite content (the npm registry) and current internationalization constraints.

## 1. Indexing & Crawling

### The Challenge

`npmx` acts as a mirror/browser for the npm registry. We do not know all valid URLs (`/package/[name]`) in advance, and there are millions of possible combinations. Additionally, invalid URLs could generate spam content or infinite loops.

### The Solution: Organic Crawling

We do not use a massive `sitemap.xml`. We rely on natural link discovery by bots (Googlebot, Bingbot, etc.):

1.  **Entry Point:** The Home page (`/`) links to popular packages.
2.  **Expansion:** Each package page links to its **Dependencies**, **DevDependencies**, and **PeerDependencies**.
3.  **Result:** Bots jump from package to package, indexing the npm dependency graph organically and efficiently.

### Error Handling (404)

To prevent indexing of non-existent URLs (`/package/fake-package`):

- The SSR server returns a real **HTTP 404 Not Found** status code when the npm API indicates the package does not exist.
- This causes search engines to immediately discard the URL and not index it, without needing an explicit `noindex` tag.

## 2. `robots.txt` File

The goal of `robots.txt` is to optimize the _Crawl Budget_ by blocking low-value or computationally expensive areas.

**Proposed `public/robots.txt`:**

```txt
User-agent: *
Allow: /

# Block internal search results (duplicate/infinite content)
Disallow: /search

# Block user utilities and settings
Disallow: /settings
Disallow: /compare
Disallow: /auth/

# Block code explorer and docs (high crawl cost, low SEO value for general search)
Disallow: /package-code/
Disallow: /package-docs/

# Block internal API endpoints
Disallow: /api/
```

## 3. Internationalization (i18n) & SEO

### Current Status

- The application supports multiple languages (UI).
- **No URL prefixes are used** (e.g., `/es/package/react` does not exist, only `/package/react`).
- Language is determined on the client-side (browser) or defaults to English on the server.

### SEO Implications

- **Canonicalization:** There is only one canonical URL per package (`https://npmx.dev/package/react`).
- **Indexing Language:** Googlebot typically crawls from the US without specific cookies/preferences. The SSR server renders in `en-US` by default.
- **Result:** **Google will index the site exclusively in English.**

### Is this a problem?

**No.** For a global technical tool like `npmx`:

- Search traffic is predominantly in English (package names, technical terms).
- We avoid the complexity of managing `hreflang` and duplicate content across 20+ languages.
- User Experience (UX) remains localized: users land on the page (indexed in English), and the client hydrates the app in their preferred language.

## 4. Summary of Actions

1.  ✅ **404 Status:** Ensured in SSR for non-existent packages.
2.  ✅ **Internal Linking:** Dependency components (`Dependencies.vue`) generate crawlable links (`<NuxtLink>`).
3.  ✅ **Dynamic Titles:** `useSeoMeta` correctly manages titles and descriptions, escaping special characters for security and proper display.
4.  📝 **Pending:** Update `public/robots.txt` with the proposed blocking rules to protect the _Crawl Budget_.

## 5. Implementation Details: Meta Tags & Sitemap

### Pages Requiring `noindex, nofollow`

Based on the `robots.txt` strategy, the following Vue pages should explicitly include the `<meta name="robots" content="noindex, nofollow">` tag via `useSeoMeta`. This acts as a second layer of defense against indexing low-value content.

- **`app/pages/search.vue`**: Internal search results.
- **`app/pages/settings.vue`**: User preferences.
- **`app/pages/compare.vue`**: Dynamic comparison tool.
- **`app/pages/package-code/[...path].vue`**: Source code explorer.
- **`app/pages/package-docs/[...path].vue`**: Generated documentation (consistent with robots.txt block).

### Canonical URLs & i18n

- **Canonical Rule:** The canonical URL is **always the English (default) URL**, regardless of the user's selected language or browser settings.
  - Example: `https://npmx.dev/package/react`
- **Reasoning:** Since we do not use URL prefixes for languages (e.g., `/es/...`), there is technically only _one_ URL per resource. The language change happens client-side. Therefore, the canonical tag must point to this single, authoritative URL to prevent confusion for search engines.

### Sitemap Strategy

- **Decision:** **No `sitemap.xml` will be generated.**
- **Why?**
  - Generating a sitemap for 2+ million npm packages is technically unfeasible and expensive to maintain.
  - A partial sitemap (e.g., top 50k packages) is redundant because these packages are already well-linked from the Home page and "Popular" lists.
  - **Organic Discovery:** As detailed in Section 1, bots will discover content naturally by following dependency links, which is the most efficient way to index a graph-based dataset like npm.
