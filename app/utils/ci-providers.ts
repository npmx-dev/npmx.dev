const CI_PROVIDER_LABELS: Record<string, string> = {
  github: 'GitHub Actions',
  gitlab: 'GitLab CI',
}

/**
 * Returns a human-readable label for a CI provider ID (e.g. "github" → "GitHub Actions"),
 * falling back to the ID itself for unknown providers.
 */
export function getCiProviderLabel(provider: string): string {
  return CI_PROVIDER_LABELS[provider] ?? provider
}
