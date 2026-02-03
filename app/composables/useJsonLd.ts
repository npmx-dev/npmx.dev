import type { Thing, WebSite, WithContext } from 'schema-dts'

/**
 * Inject JSON-LD script into head
 */
export function setJsonLd(schema: WithContext<Thing> | WithContext<Thing>[]): void {
  const schemas = Array.isArray(schema) ? schema : [schema]

  useHead({
    script: schemas.map((s, i) => ({
      type: 'application/ld+json',
      innerHTML: JSON.stringify(s),
      key: `json-ld-${i}`,
    })),
  })
}

/**
 * Create WebSite schema with search action
 */
export function createWebSiteSchema(options?: {
  name?: string
  description?: string
}): WithContext<WebSite> {
  const siteUrl = 'https://npmx.dev'
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': options?.name ?? 'npmx',
    'url': siteUrl,
    'description': options?.description ?? 'A fast, modern browser for the npm registry',
    'potentialAction': {
      '@type': 'SearchAction',
      'target': {
        '@type': 'EntryPoint',
        'urlTemplate': `${siteUrl}/search?q={search_term_string}`,
      },
      'query': 'required name=search_term_string',
    },
  }
}
