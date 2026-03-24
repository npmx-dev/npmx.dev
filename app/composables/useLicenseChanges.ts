import type { MaybeRefOrGetter } from "vue";
import { toValue } from "vue";

export interface LicenseChange {
  from: string;
  to: string;
  version: string;
}

export interface LicenseChangesResult {
  changes: LicenseChange[];
}

// Type definitions for npm registry response
interface NpmRegistryVersion {
  version: string;
  license?: string;
}

// for registry responses of $fetch function, the type includes the key versions as well as many others too.
interface NpmRegistryResponse {
  time: Record<string, string>;
  versions: Record<string, NpmRegistryVersion>;
}

/**
 * Composable to detect license changes across all versions of a package
 */
export function useLicenseChanges(
  packageName: MaybeRefOrGetter<string | null | undefined>,
) {
  return useAsyncData<LicenseChangesResult>(
    () => `license-changes:${toValue(packageName)}`,
    async () => {
      const name = toValue(packageName);
      if (!name) return { changes: [] };

      // Fetch full package metadata from npm registry
      const url = `https://registry.npmjs.org/${name}`;
      const data = await $fetch<NpmRegistryResponse>(url);

      const changes: LicenseChange[] = [];
      let prevLicense: string | undefined = undefined;

      // `data.versions` is an object with version keys
      const versions = Object.values(data.versions) as NpmRegistryVersion[];

      // Sort versions ascending to compare chronologically
      versions.sort((a, b) => {
        const dateA = new Date(data.time[a.version] as string).getTime();
        const dateB = new Date(data.time[b.version] as string).getTime();

        // Ascending order (oldest to newest)
        return dateA - dateB;
      });

      // Detect license changes
      for (const version of versions) {
        const license = (version.license as string) ?? "UNKNOWN";
        if (prevLicense && license !== prevLicense) {
          changes.push({
            from: prevLicense,
            to: license,
            version: version.version as string,
          });
        }
        prevLicense = license;
      }
      return { changes };
    },
    {
      default: () => ({ changes: [] }),
      watch: [() => toValue(packageName)],
    },
  );
}
