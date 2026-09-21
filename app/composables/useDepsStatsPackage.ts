import type { PackageJsonDependency } from '~/utils/parse-package-json-deps'
import { parsePackageJsonText } from '~/utils/parse-package-json-deps'

export function useDepsStatsPackage() {
  const { t } = useI18n()

  const fileName = useState<string | null>('deps-stats:file-name', () => null)
  const parseError = useState<string | null>('deps-stats:parse-error', () => null)
  const dependencies = useState<PackageJsonDependency[]>('deps-stats:dependencies', () => [])

  const defaultDependency = computed(() => dependencies.value.find(dep => !dep.nonRegistry))
  const hasParsedFile = computed(() => fileName.value !== null && !parseError.value)

  function clear() {
    fileName.value = null
    dependencies.value = []
    parseError.value = null
  }

  function parse(file: File, text: string): PackageJsonDependency | null {
    try {
      const parsed = parsePackageJsonText(text)
      fileName.value = file.name
      parseError.value = null
      dependencies.value = parsed.dependencies
      return defaultDependency.value ?? null
    } catch (error) {
      clear()
      fileName.value = file.name
      parseError.value =
        error instanceof Error ? error.message : t('deps_stats.upload.invalid_package_json')
      return null
    }
  }

  return {
    fileName,
    parseError,
    dependencies,
    hasParsedFile,
    parse,
    clear,
    defaultDependency,
  }
}
