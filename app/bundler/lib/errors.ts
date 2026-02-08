/**
 * base class for all teardown errors.
 */
class BundlerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BundlerError'
  }
}

/**
 * thrown when a package cannot be found in the registry.
 */
export class PackageNotFoundError extends BundlerError {
  readonly packageName: string
  readonly registry: string

  constructor(packageName: string, registry: string) {
    super(`package not found: ${packageName}`)
    this.name = 'PackageNotFoundError'
    this.packageName = packageName
    this.registry = registry
  }
}

/**
 * thrown when no version of a package satisfies the requested range.
 */
export class NoMatchingVersionError extends BundlerError {
  readonly packageName: string
  readonly range: string

  constructor(packageName: string, range: string) {
    super(`no version of ${packageName} satisfies ${range}`)
    this.name = 'NoMatchingVersionError'
    this.packageName = packageName
    this.range = range
  }
}

/**
 * thrown when a package specifier is malformed.
 */
export class InvalidSpecifierError extends BundlerError {
  readonly specifier: string

  constructor(specifier: string, reason?: string) {
    super(
      reason ? `invalid specifier: ${specifier} (${reason})` : `invalid specifier: ${specifier}`,
    )
    this.name = 'InvalidSpecifierError'
    this.specifier = specifier
  }
}

/**
 * thrown when a network request fails.
 */
export class FetchError extends BundlerError {
  readonly url: string
  readonly status: number
  readonly statusText: string

  constructor(url: string, status: number, statusText: string) {
    super(`fetch failed: ${status} ${statusText}`)
    this.name = 'FetchError'
    this.url = url
    this.status = status
    this.statusText = statusText
  }
}

/**
 * thrown when bundling fails.
 */
export class BundleError extends BundlerError {
  constructor(message: string) {
    super(message)
    this.name = 'BundleError'
  }
}
