export const MAX_PACKAGE_SELECTION = 4

export function usePackageSelection() {
  const selectedPackagesParam = useRouteQuery<string>('selection', '', { mode: 'push' })
  const showSelectionViewParam = useRouteQuery<string>('view', '', { mode: 'push' })

  // Parse URL param into array of package names
  const selectedPackages = computed<string[]>({
    get() {
      const raw = selectedPackagesParam.value
      if (!raw) return []
      return raw
        .split(',')
        .map(p => String(p).trim())
        .filter(Boolean)
        .slice(0, MAX_PACKAGE_SELECTION)
    },
    set(pkgs: string[]) {
      // Ensure all items are strings before joining
      const validPkgs = (Array.isArray(pkgs) ? pkgs : []).map(p => String(p).trim()).filter(Boolean)
      selectedPackagesParam.value = validPkgs.length > 0 ? validPkgs.join(',') : ''
    },
  })

  const isMaxSelected = computed(() => selectedPackages.value.length >= MAX_PACKAGE_SELECTION)

  const showSelectionView = computed<boolean>({
    get() {
      return showSelectionViewParam.value === 'selection'
    },
    set(isOpen: boolean) {
      showSelectionViewParam.value = isOpen ? 'selection' : ''
    },
  })

  function closeSelectionView() {
    showSelectionView.value = false
  }

  function isPackageSelected(packageName: string): boolean {
    return selectedPackages.value.includes(String(packageName).trim())
  }

  function togglePackageSelection(packageName: string) {
    const safeName = String(packageName).trim()
    if (!safeName) return

    const pkgs = [...selectedPackages.value]
    const idx = pkgs.indexOf(safeName)
    if (idx !== -1) {
      pkgs.splice(idx, 1)
    } else {
      if (pkgs.length < MAX_PACKAGE_SELECTION) pkgs.push(safeName)
    }
    selectedPackages.value = pkgs
  }

  function clearSelectedPackages() {
    selectedPackages.value = []
  }

  function openSelectionView() {
    showSelectionView.value = true
  }

  return {
    selectedPackages,
    selectedPackagesParam,
    showSelectionView,
    isMaxSelected,
    clearSelectedPackages,
    isPackageSelected,
    togglePackageSelection,
    closeSelectionView,
    openSelectionView,
  }
}
