export function usePackageHeaderHeight() {
  return useState<number>('package-header-height', () => 0)
}
