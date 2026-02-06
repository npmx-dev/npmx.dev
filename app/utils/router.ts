export function packageRoute(packageName: string, version?: string | null) {
  const [org, name] = packageName.startsWith('@') ? packageName.split('/') : [null, packageName]

  if (version) {
    return {
      name: 'package-version' as const,
      params: {
        org,
        name,
        version,
      },
    }
  }

  return {
    name: 'package' as const,
    params: {
      org,
      name,
    },
  }
}
