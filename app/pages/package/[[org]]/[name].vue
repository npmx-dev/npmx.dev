<script setup lang="ts">
import { assertValidPackageName } from "#shared/utils/npm";
import { getDependencyCount } from "~/utils/npm/dependency-count";

defineOgImageComponent("Package", {
  name: () => packageName.value,
  version: () => requestedVersion.value ?? "",
  primaryColor: "#60a5fa",
});

const readmeHeader = useTemplateRef("readmeHeader");
const isReadmeHeaderPinned = shallowRef(false);
const packageHeaderHeight = usePackageHeaderHeight();
const readmeStickyTop = computed(
  () => `${56 + (packageHeaderHeight.value || 44)}px`,
);

function isStickyPinned(el: HTMLElement | null): boolean {
  if (!el) return false;

  const style = getComputedStyle(el);
  const top = parseFloat(style.top) || 0;
  const rect = el.getBoundingClientRect();

  return Math.abs(rect.top - top) < 1;
}

function checkHeaderPosition() {
  isReadmeHeaderPinned.value = isStickyPinned(readmeHeader.value);
}

useEventListener("scroll", checkHeaderPosition, { passive: true });
useEventListener("resize", checkHeaderPosition);

onMounted(() => {
  checkHeaderPosition();
});

const { packageName, requestedVersion } = usePackageRoute();

const { data: resolvedVersion, status: resolvedStatus } =
  await useResolvedVersion(packageName, requestedVersion);

if (import.meta.server) {
  assertValidPackageName(packageName.value);
}

// Fetch README for specific version if requested, otherwise latest
const { data: readmeData } = useLazyFetch<ReadmeResponse>(
  () => {
    const base = `/api/registry/readme/${packageName.value}`;
    const version = resolvedVersion.value;
    return version ? `${base}/v/${version}` : base;
  },
  {
    default: () => ({
      html: "",
      mdExists: false,
      playgroundLinks: [],
      toc: [],
      defaultValue: true,
    }),
  },
);

const playgroundLinks = computed(() => [
  ...readmeData.value.playgroundLinks,
  // Libraries with a storybook field in package.json contain a link to their deployed playground
  ...(pkg.value?.storybook?.url
    ? [
        {
          url: pkg.value.storybook.url,
          provider: "storybook",
          providerName: "Storybook",
          label: "Storybook",
        },
      ]
    : []),
]);

const {
  data: readmeMarkdownData,
  status: readmeMarkdownStatus,
  execute: fetchReadmeMarkdown,
} = useLazyFetch<ReadmeMarkdownResponse>(
  () => {
    const base = `/api/registry/readme/markdown/${packageName.value}`;
    const version = resolvedVersion.value;
    return version ? `${base}/v/${version}` : base;
  },
  {
    server: false,
    immediate: false,
    default: () => ({}),
  },
);

//copy README file as Markdown
const { copied: copiedReadme, copy: copyReadme } = useClipboard({
  source: () => "",
  copiedDuring: 2000,
});

function prefetchReadmeMarkdown() {
  if (readmeMarkdownStatus.value === "idle") {
    fetchReadmeMarkdown();
  }
}

async function copyReadmeHandler() {
  await fetchReadmeMarkdown();

  const markdown = readmeMarkdownData.value?.markdown;
  if (!markdown) return;

  await copyReadme(markdown);
}

// Track active TOC item based on scroll position
const tocItems = computed(() => readmeData.value?.toc ?? []);
const { activeId: activeTocId } = useActiveTocItem(tocItems);

// Check if package exists on JSR (only for scoped packages)
const { data: jsrInfo } = useLazyFetch<JsrPackageInfo>(
  () => `/api/jsr/${packageName.value}`,
  {
    default: () => ({ exists: false }),
    // Only fetch for scoped packages (JSR requirement)
    immediate: computed(() => packageName.value.startsWith("@")).value,
  },
);

// Fetch total install size (lazy, can be slow for large dependency trees)
const {
  data: installSize,
  status: installSizeStatus,
  execute: fetchInstallSize,
} = useLazyFetch<InstallSizeResult | null>(
  () => {
    const base = `/api/registry/install-size/${packageName.value}`;
    const version = resolvedVersion.value;
    return version ? `${base}/v/${version}` : base;
  },
  {
    server: false,
    immediate: false,
  },
);

// Trigger fetch only when we have the real resolved version
watch(
  [resolvedVersion, resolvedStatus],
  ([version, status]) => {
    if (version && status === "success") {
      fetchInstallSize();
    }
  },
  { immediate: true },
);

const { data: skillsData } = useLazyFetch<SkillsListResponse>(
  () => {
    const base = `/skills/${packageName.value}`;
    const version = resolvedVersion.value;
    return version ? `${base}/v/${version}` : base;
  },
  { default: () => ({ package: "", version: "", skills: [] }) },
);

const { data: packageAnalysis } = usePackageAnalysis(
  packageName,
  requestedVersion,
);
const { data: moduleReplacement } = useModuleReplacement(packageName);

if (
  import.meta.server &&
  !resolvedVersion.value &&
  ["success", "error"].includes(resolvedStatus.value)
) {
  throw createError({
    statusCode: 404,
    statusMessage: $t("package.not_found"),
    message: $t("package.not_found_message"),
  });
}

watch(
  [resolvedStatus, resolvedVersion],
  ([status, version]) => {
    if ((!version && status === "success") || status === "error") {
      showError({
        statusCode: 404,
        statusMessage: $t("package.not_found"),
        message: $t("package.not_found_message"),
      });
    }
  },
  { immediate: true },
);

const {
  data: pkg,
  status,
  error,
} = usePackage(
  packageName,
  () => resolvedVersion.value ?? requestedVersion.value,
);

const { diff: sizeDiff } = useInstallSizeDiff(
  packageName,
  resolvedVersion,
  pkg,
  installSize,
);

// Detect two hydration scenarios where the external _payload.json is missing:
//
// 1. SPA fallback (200.html): No real content was server-rendered.
//    → Show skeleton while data fetches on the client.
//
// 2. SSR-rendered HTML with missing payload: Content was rendered but the external _payload.json
//    returned an ISR fallback.
//    → Preserve the server-rendered DOM, don't flash to skeleton.
const nuxtApp = useNuxtApp();
const route = useRoute();
// Gates template rendering only — data fetches intentionally still run.
// immediate is set once at mount — skipped requests won't re-fire on navigation, leaving data permanently missing.
const isVersionsRoute = computed(() => route.name === "package-versions");
const hasEmptyPayload =
  import.meta.client &&
  nuxtApp.payload.serverRendered &&
  !Object.keys(nuxtApp.payload.data ?? {}).length;
const isSpaFallback = shallowRef(
  nuxtApp.isHydrating && hasEmptyPayload && !nuxtApp.payload.path,
);
const isHydratingWithServerContent = shallowRef(
  nuxtApp.isHydrating && hasEmptyPayload && nuxtApp.payload.path === route.path,
);
const hasServerContentOnly = shallowRef(
  hasEmptyPayload && nuxtApp.payload.path === route.path,
);

// When we have server-rendered content but no payload data, capture the server
// DOM before Vue's hydration replaces it. This lets us show the server-rendered
// HTML as a static snapshot while data refetches, avoiding any visual flash.
const serverRenderedHtml = shallowRef<string | null>(
  hasServerContentOnly.value
    ? (document.getElementById("package-article")?.innerHTML ?? null)
    : null,
);

if (isSpaFallback.value || isHydratingWithServerContent.value) {
  nuxtApp.hooks.hookOnce("app:suspense:resolve", () => {
    isSpaFallback.value = false;
    isHydratingWithServerContent.value = false;
  });
}

const displayVersion = computed(() => pkg.value?.requestedVersion ?? null);
const versionSecurityMetadata = computed<PackageVersionInfo[]>(() => {
  if (!pkg.value) return [];
  if (pkg.value.securityVersions?.length) return pkg.value.securityVersions;

  return Object.entries(pkg.value.versions).map(([version, metadata]) => ({
    version,
    time: pkg.value?.time?.[version],
    hasProvenance: !!metadata.hasProvenance,
    trustLevel: metadata.trustLevel,
    deprecated: metadata.deprecated,
  }));
});

// Process package description
const pkgDescription = useMarkdown(() => ({
  text: pkg.value?.description ?? "",
  packageName: pkg.value?.name,
}));

// Fetch dependency analysis (lazy, client-side)
// This is the same composable used by PackageVulnerabilityTree and PackageDeprecatedTree
const { data: vulnTree, status: vulnTreeStatus } = useDependencyAnalysis(
  packageName,
  () => resolvedVersion.value ?? "",
);

const {
  data: provenanceData,
  status: provenanceStatus,
  execute: fetchProvenance,
} = useLazyFetch<ProvenanceDetails | null>(
  () => {
    const v = displayVersion.value;
    if (!v || !hasProvenance(v)) return "";
    return `/api/registry/provenance/${packageName.value}/v/${v.version}`;
  },
  {
    default: () => null,
    server: false,
    immediate: false,
  },
);
if (import.meta.client) {
  watch(
    displayVersion,
    (v) => {
      if (v && hasProvenance(v) && provenanceStatus.value === "idle") {
        fetchProvenance();
      }
    },
    { immediate: true },
  );
}

const isMounted = useMounted();

// Keep latestVersion for comparison (to show "(latest)" badge)
const latestVersion = computed(() => {
  if (!pkg.value) return null;
  const latestTag = pkg.value["dist-tags"]?.latest;
  if (!latestTag) return null;
  return pkg.value.versions[latestTag] ?? null;
});

const deprecationNotice = computed(() => {
  if (!displayVersion.value?.deprecated) return null;

  const isLatestDeprecated = !!latestVersion.value?.deprecated;

  // If latest is deprecated, show "package deprecated"
  if (isLatestDeprecated) {
    return {
      type: "package" as const,
      message: displayVersion.value.deprecated,
    };
  }

  // Otherwise show "version deprecated"
  return { type: "version" as const, message: displayVersion.value.deprecated };
});

const deprecationNoticeMessage = useMarkdown(() => ({
  text: deprecationNotice.value?.message ?? "",
}));

const publishSecurityDowngrade = computed(() => {
  const currentVersion = displayVersion.value?.version;
  if (!currentVersion) return null;
  return detectPublishSecurityDowngradeForVersion(
    versionSecurityMetadata.value,
    currentVersion,
  );
});

const installVersionOverride = computed(
  () => publishSecurityDowngrade.value?.trustedVersion ?? null,
);

const downgradeFallbackInstallText = computed(() => {
  const d = publishSecurityDowngrade.value;
  if (!d?.trustedVersion) return null;
  if (d.trustedTrustLevel === "provenance")
    return $t("package.security_downgrade.fallback_install_provenance", {
      version: d.trustedVersion,
    });
  if (d.trustedTrustLevel === "trustedPublisher")
    return $t("package.security_downgrade.fallback_install_trustedPublisher", {
      version: d.trustedVersion,
    });
  return null;
});

const sizeTooltip = computed(() => {
  const chunks = [
    displayVersion.value &&
      displayVersion.value.dist.unpackedSize &&
      $t("package.stats.size_tooltip.unpacked", {
        size: bytesFormatter.format(displayVersion.value.dist.unpackedSize),
      }),
    installSize.value &&
      installSize.value.dependencyCount &&
      $t("package.stats.size_tooltip.total", {
        size: bytesFormatter.format(installSize.value.totalSize),
        count: installSize.value.dependencyCount,
      }),
  ];
  return chunks.filter(Boolean).join("\n");
});

const hasDependencies = computed(() => {
  if (!displayVersion.value) return false;
  const deps = displayVersion.value.dependencies;
  const peerDeps = displayVersion.value.peerDependencies;
  const optionalDeps = displayVersion.value.optionalDependencies;
  return (
    (deps && Object.keys(deps).length > 0) ||
    (peerDeps && Object.keys(peerDeps).length > 0) ||
    (optionalDeps && Object.keys(optionalDeps).length > 0)
  );
});

// Vulnerability count for the stats banner
const vulnCount = computed(() => vulnTree.value?.totalCounts.total ?? 0);
const hasVulnerabilities = computed(() => vulnCount.value > 0);

// Total transitive dependencies count (from either vuln tree or install size)
// Subtract 1 to exclude the root package itself
const totalDepsCount = computed(() => {
  if (vulnTree.value) {
    return vulnTree.value.totalPackages ? vulnTree.value.totalPackages - 1 : 0;
  }
  if (installSize.value) {
    return installSize.value.dependencyCount;
  }
  return null;
});

const { repositoryUrl } = useRepositoryUrl(displayVersion);

const { repoRef } = useRepoMeta(repositoryUrl);

const viewOnGitProvider = useViewOnGitProvider(() => repoRef.value?.provider);

// Check if a version has provenance/attestations
// The dist object may have attestations that aren't in the base type
function hasProvenance(version: PackumentVersion | null): boolean {
  if (!version?.dist) return false;
  const dist = version.dist as NpmVersionDist;
  return !!dist.attestations;
}

// Get @types package name if available (non-deprecated)
const typesPackageName = computed(() => {
  if (!packageAnalysis.value) return null;
  if (packageAnalysis.value.types.kind !== "@types") return null;
  if (packageAnalysis.value.types.deprecated) return null;
  return packageAnalysis.value.types.packageName;
});

// Executable detection for run command
const executableInfo = computed(() => {
  if (!displayVersion.value || !pkg.value) return null;
  return getExecutableInfo(pkg.value.name, displayVersion.value.bin);
});

// Detect if package is binary-only (show only execute commands, no install)
const isBinaryOnly = computed(() => {
  if (!displayVersion.value || !pkg.value) return false;
  return isBinaryOnlyPackage({
    name: pkg.value.name,
    bin: displayVersion.value.bin,
    main: displayVersion.value.main,
    module: displayVersion.value.module,
    exports: displayVersion.value.exports,
  });
});

// Detect if package uses create-* naming convention
const isCreatePkg = computed(() => {
  if (!pkg.value) return false;
  return isCreatePackage(pkg.value.name);
});

// Get associated create-* package info (e.g., vite -> create-vite)
const createPackageInfo = computed(() => {
  if (!packageAnalysis.value?.createPackage) return null;
  // Don't show if deprecated
  if (packageAnalysis.value.createPackage.deprecated) return null;
  return packageAnalysis.value.createPackage;
});

// Canonical URL for this package page
const canonicalUrl = computed(() => {
  const base = `https://npmx.dev/package/${packageName.value}`;
  return requestedVersion.value ? `${base}/v/${requestedVersion.value}` : base;
});

// URL pattern for version selector - includes file path if present
const versionUrlPattern = computed(
  () => `/package/${pkg.value?.name || packageName.value}/v/{version}`,
);

const dependencyCount = computed(() =>
  getDependencyCount(displayVersion.value),
);

const numberFormatter = useNumberFormatter();
const bytesFormatter = useBytesFormatter();

useHead({
  link: [{ rel: "canonical", href: canonicalUrl }],
});

useSeoMeta({
  title: () =>
    pkg.value?.name ? `${pkg.value.name} - npmx` : "Package - npmx",
  ogTitle: () =>
    pkg.value?.name ? `${pkg.value.name} - npmx` : "Package - npmx",
  twitterTitle: () =>
    pkg.value?.name ? `${pkg.value.name} - npmx` : "Package - npmx",
  description: () => pkg.value?.description ?? "",
  ogDescription: () => pkg.value?.description ?? "",
  twitterDescription: () => pkg.value?.description ?? "",
});

const showSkeleton = shallowRef(false);
</script>

<template>
  <NuxtPage v-if="isVersionsRoute" />
  <DevOnly v-else>
    <ButtonBase
      class="fixed bottom-4 inset-is-4 z-50 shadow-lg rounded-full! px-3! py-2!"
      classicon="i-simple-icons:skeleton"
      variant="primary"
      title="Toggle skeleton loader (development only)"
      :aria-pressed="showSkeleton"
      @click="showSkeleton = !showSkeleton"
    >
      <span class="text-xs">Skeleton</span>
    </ButtonBase>
  </DevOnly>
  <main v-if="!isVersionsRoute" class="flex-1 pb-8">
    <!-- Scenario 1: SPA fallback — show skeleton (no real content to preserve) -->
    <!-- Scenario 2: SSR with missing payload — preserve server DOM, skip skeleton -->
    <PackageSkeleton
      v-if="
        isSpaFallback ||
        (!hasServerContentOnly && (showSkeleton || status === 'pending'))
      "
    />

    <!-- During hydration without payload, show captured server HTML as a static snapshot.
         This avoids a visual flash: the user sees the server content while data refetches.
         v-html is safe here: the content originates from the server's own SSR output,
         captured from the DOM before hydration — it is not user-controlled input.
         We also show SSR output until critical data is loaded, so that after rendering dynamic
         content, the user receives the same result as he received from the server-->
    <article
      v-else-if="
        isHydratingWithServerContent ||
        (hasServerContentOnly &&
          serverRenderedHtml &&
          (!pkg || readmeData?.defaultValue))
      "
      id="package-article"
      class="container w-full"
      :class="$style.packagePage"
      v-html="serverRenderedHtml"
    />

    <template v-else-if="pkg">
      <PackageHeader
        :pkg="pkg"
        :resolved-version="resolvedVersion"
        :display-version="displayVersion"
        :latest-version="latestVersion"
        :provenance-data="provenanceData"
        :provenance-status="provenanceStatus"
        :class="$style.areaHeader"
        page="main"
        :version-url-pattern="versionUrlPattern"
      />
      <article
        id="package-article"
        :class="$style.packagePage"
        class="container w-full"
      >
        <!-- Package details -->
        <section :class="$style.areaDetails">
          <div class="mb-4 pt-4">
            <!-- Description container with min-height to prevent CLS -->
            <div class="max-w-2xl">
              <p v-if="pkgDescription" class="text-fg-muted text-base m-0">
                <span v-html="pkgDescription" />
              </p>
              <p v-else class="text-fg-subtle text-base m-0 italic">
                {{ $t("package.no_description") }}
              </p>
            </div>

            <PackageExternalLinks :pkg :jsrInfo />
            <PackageMetricsBadges
              v-if="resolvedVersion"
              :package-name="packageName"
              :version="resolvedVersion"
              :is-binary="isBinaryOnly"
              class="self-baseline mt-4"
            />
          </div>

          <div
            v-if="deprecationNotice"
            class="border border-red-700 dark:border-red-400 bg-red-400/10 rounded-lg px-3 py-2 text-base text-red-700 dark:text-red-400"
          >
            <h2 class="font-medium mb-2">
              {{
                deprecationNotice.type === "package"
                  ? $t("package.deprecation.package")
                  : $t("package.deprecation.version")
              }}
            </h2>
            <p v-if="deprecationNoticeMessage" class="text-base m-0">
              <span v-html="deprecationNoticeMessage" />
            </p>
            <p v-else class="text-base m-0 italic">
              {{ $t("package.deprecation.no_reason") }}
            </p>
          </div>

          <!-- Stats grid -->
          <dl
            class="grid grid-cols-2 sm:grid-cols-7 md:grid-cols-11 gap-3 sm:gap-4 py-4 sm:py-6 mt-4 sm:mt-6 border-t border-b border-border"
          >
            <div class="space-y-1 sm:col-span-2">
              <dt class="text-xs text-fg-subtle uppercase tracking-wider">
                {{ $t("package.stats.license") }}
              </dt>
              <dd class="font-mono text-sm text-fg">
                <LicenseDisplay
                  v-if="pkg.license"
                  :license="pkg.license"
                  :package-name="pkg.name"
                />
                <span v-else>{{ $t("package.license.none") }}</span>
              </dd>
            </div>

            <div class="space-y-1 sm:col-span-2">
              <dt class="text-xs text-fg-subtle uppercase tracking-wider">
                {{ $t("package.stats.deps") }}
              </dt>
              <dd
                class="font-mono text-sm text-fg flex items-center justify-start gap-2"
              >
                <span class="flex items-center gap-1">
                  <!-- Direct deps (muted) -->
                  <span class="text-fg-muted">{{
                    numberFormatter.format(dependencyCount)
                  }}</span>

                  <!-- Total transitive deps in parens -->
                  <template
                    v-if="
                      dependencyCount > 0 && dependencyCount !== totalDepsCount
                    "
                  >
                    <ClientOnly>
                      <span
                        v-if="
                          vulnTreeStatus === 'pending' ||
                          (installSizeStatus === 'pending' && !vulnTree)
                        "
                        class="inline-flex items-center gap-1 text-fg-subtle"
                      >
                        (<span
                          class="i-svg-spinners:ring-resize w-3 h-3"
                          aria-hidden="true"
                        />)
                      </span>
                      <span v-else-if="totalDepsCount !== null"
                        ><span class="text-fg-subtle">(</span
                        >{{ numberFormatter.format(totalDepsCount)
                        }}<span class="text-fg-subtle">)</span></span
                      >
                      <span v-else class="text-fg-subtle">(-)</span>
                      <template #fallback>
                        <span class="text-fg-subtle">(-)</span>
                      </template>
                    </ClientOnly>
                  </template>
                </span>
                <ButtonGroup v-if="dependencyCount > 0" class="ms-auto">
                  <LinkBase
                    variant="button-secondary"
                    size="small"
                    :to="`https://npmgraph.js.org/?q=${pkg.name}${resolvedVersion ? `@${resolvedVersion}` : ''}`"
                    :title="$t('package.stats.view_dependency_graph')"
                    classicon="i-lucide:network -rotate-90"
                  >
                    <span class="sr-only">{{
                      $t("package.stats.view_dependency_graph")
                    }}</span>
                  </LinkBase>

                  <LinkBase
                    variant="button-secondary"
                    size="small"
                    :to="`https://node-modules.dev/grid/depth#install=${pkg.name}${resolvedVersion ? `@${resolvedVersion}` : ''}`"
                    :title="$t('package.stats.inspect_dependency_tree')"
                    classicon="i-lucide:table"
                  >
                    <span class="sr-only">{{
                      $t("package.stats.inspect_dependency_tree")
                    }}</span>
                  </LinkBase>
                </ButtonGroup>
              </dd>
            </div>

            <div class="space-y-1 sm:col-span-3">
              <dt
                class="text-xs text-fg-subtle uppercase tracking-wider flex items-center gap-1"
              >
                {{ $t("package.stats.install_size") }}
                <TooltipApp v-if="sizeTooltip" :text="sizeTooltip" interactive>
                  <span
                    tabindex="0"
                    class="inline-flex items-center justify-center min-w-6 min-h-6 -m-1 p-1 text-fg-subtle cursor-help focus-visible:outline-2 focus-visible:outline-accent/70 rounded"
                  >
                    <span class="i-lucide:info w-3 h-3" aria-hidden="true" />
                  </span>
                </TooltipApp>
              </dt>
              <dd class="font-mono text-sm text-fg">
                <!-- Package size (greyed out) -->
                <span class="text-fg-muted" dir="ltr">
                  <span v-if="displayVersion?.dist?.unpackedSize">
                    {{
                      bytesFormatter.format(displayVersion.dist.unpackedSize)
                    }}
                  </span>
                  <span v-else>-</span>
                </span>

                <!-- Total install size in parens -->
                <template
                  v-if="
                    displayVersion?.dist?.unpackedSize !==
                    installSize?.totalSize
                  "
                >
                  <span class="ms-1">
                    <span
                      v-if="installSizeStatus === 'pending'"
                      class="inline-flex items-center gap-1 text-fg-subtle"
                    >
                      (<span
                        class="i-svg-spinners:ring-resize w-3 h-3"
                        aria-hidden="true"
                      />)
                    </span>
                    <span v-else-if="installSize?.totalSize" dir="ltr">
                      <span class="text-fg-subtle">(</span
                      >{{ bytesFormatter.format(installSize.totalSize)
                      }}<span class="text-fg-subtle">)</span>
                    </span>
                    <span v-else class="text-fg-subtle">(-)</span>
                  </span>
                </template>
              </dd>
            </div>

            <!-- Vulnerabilities count -->
            <div class="space-y-1 sm:col-span-2">
              <dt class="text-xs text-fg-subtle uppercase tracking-wider">
                {{ $t("package.stats.vulns") }}
              </dt>
              <dd class="font-mono text-sm text-fg">
                <span
                  v-if="
                    vulnTreeStatus === 'pending' || vulnTreeStatus === 'idle'
                  "
                  class="inline-flex items-center gap-1 text-fg-subtle"
                >
                  <span
                    class="i-svg-spinners:ring-resize w-3 h-3"
                    aria-hidden="true"
                  />
                </span>
                <span v-else-if="vulnTreeStatus === 'success'">
                  <span
                    v-if="hasVulnerabilities"
                    class="text-amber-700 dark:text-amber-500"
                  >
                    {{ numberFormatter.format(vulnCount) }}
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1 text-fg-muted"
                  >
                    <span class="i-lucide:check w-3 h-3" aria-hidden="true" />
                    {{ numberFormatter.format(0) }}
                  </span>
                </span>
                <span v-else class="text-fg-subtle">-</span>
              </dd>
            </div>

            <div
              v-if="resolvedVersion && pkg.time?.[resolvedVersion]"
              class="space-y-1 sm:col-span-2"
            >
              <dt
                class="text-xs text-fg-subtle uppercase tracking-wider"
                :title="
                  $t('package.stats.published_tooltip', {
                    package: pkg.name,
                    version: resolvedVersion,
                  })
                "
              >
                {{ $t("package.stats.published") }}
              </dt>
              <dd class="font-mono text-sm text-fg">
                <DateTime
                  :datetime="pkg.time[resolvedVersion]!"
                  date-style="medium"
                />
              </dd>
            </div>
          </dl>

          <!-- Skills Modal -->
          <ClientOnly>
            <PackageSkillsModal
              :skills="skillsData?.skills ?? []"
              :package-name="pkg.name"
              :version="resolvedVersion || undefined"
            />
          </ClientOnly>
        </section>

        <!-- Binary-only packages: Show only execute command (no install) -->
        <section
          v-if="isBinaryOnly"
          class="scroll-mt-20"
          :class="$style.areaInstall"
        >
          <div class="flex flex-wrap items-center justify-between mb-3">
            <h2
              id="run-heading"
              class="text-xs text-fg-subtle uppercase tracking-wider"
            >
              {{ $t("package.run.title") }}
            </h2>
            <!-- Package manager dropdown -->
            <PackageManagerSelect />
          </div>
          <div>
            <TerminalExecute
              :package-name="pkg.name"
              :jsr-info="jsrInfo"
              :is-create-package="isCreatePkg"
            />
          </div>
        </section>

        <!-- Regular packages: Install command with optional run command -->
        <section
          v-else
          id="get-started"
          class="scroll-mt-20"
          :class="$style.areaInstall"
        >
          <div class="flex flex-wrap items-center justify-between mb-3">
            <h2
              id="get-started-heading"
              class="group text-xs text-fg-subtle uppercase tracking-wider"
            >
              <LinkBase to="#get-started">
                {{ $t("package.get_started.title") }}
              </LinkBase>
            </h2>
            <!-- Package manager dropdown -->
            <PackageManagerSelect />
          </div>
          <div>
            <div
              v-if="publishSecurityDowngrade"
              role="alert"
              class="mb-4 rounded-lg border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-amber-700 dark:text-amber-400"
            >
              <h3
                class="m-0 flex items-center gap-2 font-mono text-sm font-medium"
              >
                <span
                  class="i-lucide:circle-alert w-4 h-4 shrink-0"
                  aria-hidden="true"
                />
                {{ $t("package.security_downgrade.title") }}
              </h3>
              <p class="mt-2 mb-0 text-sm">
                <i18n-t
                  v-if="
                    publishSecurityDowngrade.downgradedTrustLevel === 'none' &&
                    publishSecurityDowngrade.trustedTrustLevel === 'provenance'
                  "
                  keypath="package.security_downgrade.description_to_none_provenance"
                  tag="span"
                  scope="global"
                >
                  <template #provenance>
                    <a
                      href="https://docs.npmjs.com/generating-provenance-statements"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 rounded-sm underline underline-offset-4 decoration-amber-600/60 dark:decoration-amber-400/50 hover:decoration-fg focus-visible:decoration-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 transition-colors"
                      >{{ $t("package.security_downgrade.provenance_link_text")
                      }}<span
                        class="i-lucide:external-link w-3 h-3"
                        aria-hidden="true"
                    /></a>
                  </template>
                </i18n-t>
                <i18n-t
                  v-else-if="
                    publishSecurityDowngrade.downgradedTrustLevel === 'none' &&
                    publishSecurityDowngrade.trustedTrustLevel ===
                      'trustedPublisher'
                  "
                  keypath="package.security_downgrade.description_to_none_trustedPublisher"
                  tag="span"
                  scope="global"
                >
                  <template #trustedPublishing>
                    <a
                      href="https://docs.npmjs.com/trusted-publishers"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 rounded-sm underline underline-offset-4 decoration-amber-600/60 dark:decoration-amber-400/50 hover:decoration-fg focus-visible:decoration-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 transition-colors"
                      >{{
                        $t(
                          "package.security_downgrade.trusted_publishing_link_text",
                        )
                      }}<span
                        class="i-lucide:external-link w-3 h-3"
                        aria-hidden="true"
                    /></a>
                  </template>
                </i18n-t>
                <i18n-t
                  v-else-if="
                    publishSecurityDowngrade.downgradedTrustLevel ===
                      'provenance' &&
                    publishSecurityDowngrade.trustedTrustLevel ===
                      'trustedPublisher'
                  "
                  keypath="package.security_downgrade.description_to_provenance_trustedPublisher"
                  tag="span"
                  scope="global"
                >
                  <template #provenance>
                    <a
                      href="https://docs.npmjs.com/generating-provenance-statements"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 rounded-sm underline underline-offset-4 decoration-amber-600/60 dark:decoration-amber-400/50 hover:decoration-fg focus-visible:decoration-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 transition-colors"
                      >{{ $t("package.security_downgrade.provenance_link_text")
                      }}<span
                        class="i-lucide:external-link w-3 h-3"
                        aria-hidden="true"
                    /></a>
                  </template>
                  <template #trustedPublishing>
                    <a
                      href="https://docs.npmjs.com/trusted-publishers"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 rounded-sm underline underline-offset-4 decoration-amber-600/60 dark:decoration-amber-400/50 hover:decoration-fg focus-visible:decoration-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 transition-colors"
                      >{{
                        $t(
                          "package.security_downgrade.trusted_publishing_link_text",
                        )
                      }}<span
                        class="i-lucide:external-link w-3 h-3"
                        aria-hidden="true"
                    /></a>
                  </template>
                </i18n-t>
                {{ " " }}
                <template v-if="downgradeFallbackInstallText">
                  {{ downgradeFallbackInstallText }}
                </template>
              </p>
            </div>
            <TerminalInstall
              :package-name="pkg.name"
              :requested-version="resolvedVersion"
              :install-version-override="installVersionOverride"
              :jsr-info="jsrInfo"
              :dev-dependency-suggestion="
                packageAnalysis?.devDependencySuggestion
              "
              :types-package-name="typesPackageName"
              :executable-info="executableInfo"
              :create-package-info="createPackageInfo"
            />
          </div>
        </section>

        <div class="space-y-6" :class="$style.areaVulns">
          <!-- Bad package warning -->
          <PackageReplacement
            v-if="moduleReplacement"
            :replacement="moduleReplacement"
          />
          <!-- Size / dependency increase notice -->
          <PackageSizeIncrease v-if="sizeDiff" :diff="sizeDiff" />
          <!-- Vulnerability scan -->
          <ClientOnly>
            <PackageVulnerabilityTree
              v-if="resolvedVersion"
              :package-name="pkg.name"
              :version="resolvedVersion"
            />
            <PackageDeprecatedTree
              v-if="resolvedVersion"
              :package-name="pkg.name"
              :version="resolvedVersion"
              class="mt-3"
            />
          </ClientOnly>
        </div>

        <PackageSidebar :class="$style.areaSidebar">
          <div class="flex flex-col gap-4 sm:gap-6 xl:pt-4">
            <!-- Team access controls (for scoped packages when connected) -->
            <ClientOnly>
              <PackageAccessControls :package-name="pkg.name" />
              <template #fallback>
                <!-- Show skeleton loaders when SSR or access controls are loading -->
              </template>
            </ClientOnly>

            <!-- Agent Skills -->
            <ClientOnly>
              <PackageSkillsCard
                v-if="skillsData?.skills?.length"
                :skills="skillsData.skills"
                :package-name="pkg.name"
                :version="resolvedVersion || undefined"
              />
              <template #fallback>
                <!-- Show skeleton loaders when SSR or access controls are loading -->
              </template>
            </ClientOnly>

            <!-- Download stats -->
            <PackageWeeklyDownloadStats
              :packageName
              :createdIso="pkg?.time?.created ?? null"
              :repoRef="repoRef"
            />

            <!-- Playground links -->
            <PackagePlaygrounds
              v-if="playgroundLinks.length"
              :links="playgroundLinks"
            />

            <PackageCompatibility :engines="displayVersion?.engines" />

            <!-- Versions (grouped by release channel) -->
            <PackageVersions
              v-if="pkg.versions && Object.keys(pkg.versions).length > 0"
              :package-name="pkg.name"
              :versions="pkg.versions"
              :dist-tags="pkg['dist-tags'] ?? {}"
              :time="pkg.time"
              :selected-version="
                resolvedVersion ?? pkg['dist-tags']?.['latest']
              "
            />

            <!-- Install Scripts Warning -->
            <PackageInstallScripts
              v-if="displayVersion?.installScripts"
              :package-name="pkg.name"
              :version="displayVersion.version"
              :install-scripts="displayVersion.installScripts"
            />

            <!-- Dependencies -->
            <PackageDependencies
              v-if="hasDependencies && resolvedVersion && displayVersion"
              :package-name="pkg.name"
              :version="resolvedVersion"
              :dependencies="displayVersion.dependencies"
              :peer-dependencies="displayVersion.peerDependencies"
              :peer-dependencies-meta="displayVersion.peerDependenciesMeta"
              :optional-dependencies="displayVersion.optionalDependencies"
            />

            <!-- Keywords -->
            <PackageKeywords :keywords="displayVersion?.keywords" />

            <!-- Maintainers (with admin actions when connected) -->
            <PackageMaintainers
              :package-name="pkg.name"
              :maintainers="pkg.maintainers"
            />
          </div>
        </PackageSidebar>

        <!-- README -->
        <section
          id="readme"
          class="min-w-0 scroll-mt-20"
          :class="$style.areaReadme"
        >
          <div
            ref="readmeHeader"
            class="flex [@media(min-height:800px)]:sticky z-10 flex-wrap items-center justify-between mb-3 py-2 -mx-1 px-2 transition-shadow duration-200"
            :class="{ 'bg-bg border-border border-b': isReadmeHeaderPinned }"
            :style="{ top: readmeStickyTop }"
          >
            <h2
              id="readme-heading"
              class="group text-fg-subtle uppercase font-medium"
            >
              <LinkBase to="#readme">
                {{ $t("package.readme.title") }}
              </LinkBase>
            </h2>
            <div class="flex gap-2">
              <!-- Copy readme as Markdown button -->
              <TooltipApp
                v-if="readmeData?.mdExists"
                :text="$t('package.readme.copy_as_markdown')"
                position="bottom"
              >
                <ButtonBase
                  @mouseenter="prefetchReadmeMarkdown"
                  @focus="prefetchReadmeMarkdown"
                  @click="copyReadmeHandler()"
                  :aria-pressed="copiedReadme"
                  :aria-label="
                    copiedReadme
                      ? $t('common.copied')
                      : $t('package.readme.copy_as_markdown')
                  "
                  :classicon="
                    copiedReadme ? 'i-lucide:check' : 'i-simple-icons:markdown'
                  "
                >
                  {{ copiedReadme ? $t("common.copied") : $t("common.copy") }}
                </ButtonBase>
              </TooltipApp>
              <ReadmeTocDropdown
                v-if="readmeData?.toc && readmeData.toc.length > 1"
                :toc="readmeData.toc"
                :active-id="activeTocId"
              />
            </div>
          </div>

          <!-- eslint-disable vue/no-v-html -- HTML is sanitized server-side -->
          <Readme v-if="readmeData?.html" :html="readmeData.html" />
          <p v-else class="text-fg-muted italic">
            {{ $t("package.readme.no_readme") }}
            <a
              v-if="repositoryUrl"
              :href="repositoryUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="link text-fg underline underline-offset-4 decoration-fg-subtle hover:(decoration-fg text-fg) transition-colors duration-200"
            >
              {{ viewOnGitProvider }}</a
            >
          </p>

          <section
            v-if="hasProvenance(displayVersion) && isMounted"
            id="provenance"
            class="scroll-mt-20"
          >
            <div
              v-if="provenanceStatus === 'pending'"
              class="mt-8 flex items-center gap-2 text-fg-subtle text-sm"
            >
              <span
                class="i-svg-spinners:ring-resize w-4 h-4"
                aria-hidden="true"
              />
              <span>{{ $t("package.provenance_section.title") }}…</span>
            </div>
            <PackageProvenanceSection
              v-else-if="provenanceData"
              :details="provenanceData"
              class="mt-8"
            />
            <!-- Error state: provenance exists but details failed to load -->
            <div
              v-else-if="provenanceStatus === 'error'"
              class="mt-8 flex items-center gap-2 text-fg-subtle text-sm"
            >
              <span class="i-lucide:circle-alert w-4 h-4" aria-hidden="true" />
              <span>{{ $t("package.provenance_section.error_loading") }}</span>
            </div>
          </section>
        </section>
      </article>
    </template>

    <!-- Error state -->
    <div
      v-else-if="status === 'error'"
      role="alert"
      class="flex flex-col items-center py-20 text-center container w-full"
    >
      <h1 class="font-mono text-2xl font-medium mb-4">
        {{ $t("package.not_found") }}
      </h1>
      <p class="text-fg-muted mb-8">
        {{ error?.message ?? $t("package.not_found_message") }}
      </p>
      <LinkBase variant="button-secondary" :to="{ name: 'index' }">{{
        $t("common.go_back_home")
      }}</LinkBase>
    </div>
  </main>
</template>

<style module>
.packagePage {
  display: grid;
  gap: 2rem;
  word-wrap: break-word;
  overflow-wrap: break-word;

  /* Mobile: single column, sidebar above readme */
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    "details"
    "install"
    "vulns"
    "sidebar"
    "readme";
}

/* Tablet/medium: install/vulns full width, readme+sidebar side by side */
@media (min-width: 1024px) {
  .packagePage {
    grid-template-columns: 2fr 1fr;
    grid-template-areas:
      "details details"
      "install sidebar"
      "vulns   sidebar"
      "readme  sidebar";
    grid-template-rows: auto auto auto auto 1fr;
  }
}

/* Desktop: floating sidebar alongside all content */
@media (min-width: 1280px) {
  .packagePage {
    grid-template-columns: 1fr 20rem;
    grid-template-areas:
      "details sidebar"
      "install sidebar"
      "vulns   sidebar"
      "readme  sidebar";
  }
}

/* Ensure all children respect max-width */
.packagePage > * {
  max-width: 100%;
  min-width: 0;
}

.areaDetails {
  grid-area: details;
}

.areaInstall {
  grid-area: install;
}

/* Allow install command text to break on narrow screens */
.areaInstall code {
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.areaVulns {
  grid-area: vulns;
  overflow-x: hidden;
}

.areaReadme {
  grid-area: readme;
}

.areaReadme > :global(.readme) {
  overflow-x: hidden;
}

.areaSidebar {
  grid-area: sidebar;
}

@media (max-width: 639.9px) {
  .packagePage {
    padding-bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px));
  }
}
</style>
