/**
 * Composable for managing the selected package manager preference.
 *
 * This composable syncs the selected PM to both localStorage and the
 * `data-pm` attribute on `<html>`. The attribute enables CSS-based
 * visibility of PM-specific content without JavaScript.
 *
 */
export const useSelectedPackageManager = createSharedComposable(
  function useSelectedPackageManager() {
    const pm = useLocalStorage<PackageManagerId>('npmx-pm', 'npm')

    // Sync to data-pm attribute on the client
    if (import.meta.client) {
      // Watch for changes and update the attribute
      watch(
        pm,
        newPM => {
          document.documentElement.dataset.pm = newPM
        },
        { immediate: true },
      )
    }

    return pm
  },
)
