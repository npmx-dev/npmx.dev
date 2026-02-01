// JSON-LD Schema Types
interface JsonLdBase {
  '@context': 'https://schema.org'
  '@type': string
}

interface WebSiteSchema extends JsonLdBase {
  '@type': 'WebSite'
  'name': string
  'url': string
  'description'?: string
  'potentialAction'?: SearchActionSchema
}

interface SearchActionSchema {
  '@type': 'SearchAction'
  'target': {
    '@type': 'EntryPoint'
    'urlTemplate': string
  }
  'query-input': string
}

interface SoftwareApplicationSchema extends JsonLdBase {
  '@type': 'SoftwareApplication'
  'name': string
  'description'?: string
  'applicationCategory': 'DeveloperApplication'
  'operatingSystem': 'Cross-platform'
  'url': string
  'softwareVersion'?: string
  'dateModified'?: string
  'datePublished'?: string
  'license'?: string
  'author'?: PersonSchema | OrganizationSchema | (PersonSchema | OrganizationSchema)[]
  'maintainer'?: PersonSchema | OrganizationSchema | (PersonSchema | OrganizationSchema)[]
  'offers'?: OfferSchema
  'downloadUrl'?: string
  'codeRepository'?: string
  'keywords'?: string[]
}

interface PersonSchema extends JsonLdBase {
  '@type': 'Person'
  'name': string
  'url'?: string
}

interface OrganizationSchema extends JsonLdBase {
  '@type': 'Organization'
  'name': string
  'url'?: string
  'logo'?: string
  'description'?: string
  'sameAs'?: string[]
}

interface OfferSchema {
  '@type': 'Offer'
  'price': string
  'priceCurrency': string
}

interface BreadcrumbListSchema extends JsonLdBase {
  '@type': 'BreadcrumbList'
  'itemListElement': BreadcrumbItemSchema[]
}

interface BreadcrumbItemSchema {
  '@type': 'ListItem'
  'position': number
  'name': string
  'item'?: string
}

interface ProfilePageSchema extends JsonLdBase {
  '@type': 'ProfilePage'
  'name': string
  'url': string
  'mainEntity': PersonSchema | OrganizationSchema
}

type JsonLdSchema =
  | WebSiteSchema
  | SoftwareApplicationSchema
  | PersonSchema
  | OrganizationSchema
  | BreadcrumbListSchema
  | ProfilePageSchema

/**
 * Inject JSON-LD script into head
 */
export function setJsonLd(schema: JsonLdSchema | JsonLdSchema[]) {
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
}): WebSiteSchema {
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
      'query-input': 'required name=search_term_string',
    },
  }
}
