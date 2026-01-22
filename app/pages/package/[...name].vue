<script setup lang="ts">
import type { PackumentVersion } from '#shared/types'

const route = useRoute('package-name')

const packageName = computed(() => {
  const segments = route.params.name
  if (Array.isArray(segments)) {
    return segments.join('/')
  }
  return segments ?? ''
})

const { data: pkg, status, error } = usePackage(packageName)

const { data: downloads } = usePackageDownloads(packageName, 'last-week')

const { data: readmeData } = useLazyFetch(() => `/api/registry/readme/${packageName.value}`, {
  key: `readme:${packageName.value}`,
  default: () => ({ html: '' }),
})

const latestVersion = computed(() => {
  if (!pkg.value) return null
  const latestTag = pkg.value['dist-tags']?.latest
  if (!latestTag) return null
  return pkg.value.versions[latestTag] ?? null
})

const sortedVersions = computed(() => {
  if (!pkg.value?.versions) return []
  return Object.keys(pkg.value.versions)
    .sort((a, b) => {
      const timeA = pkg.value?.time[a]
      const timeB = pkg.value?.time[b]
      if (!timeA || !timeB) return 0
      return new Date(timeB).getTime() - new Date(timeA).getTime()
    })
    .slice(0, 20)
})

const repositoryUrl = computed(() => {
  const repo = latestVersion.value?.repository
  if (!repo?.url) return null
  return normalizeGitUrl(repo.url)
})

const homepageUrl = computed(() => {
  return latestVersion.value?.homepage ?? null
})

function normalizeGitUrl(url: string): string {
  return url
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/\.git$/, '')
    .replace(/^ssh:\/\/git@github\.com/, 'https://github.com')
    .replace(/^git@github\.com:/, 'https://github.com/')
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

function getDependencyCount(version: PackumentVersion | null): number {
  if (!version?.dependencies) return 0
  return Object.keys(version.dependencies).length
}

useSeoMeta({
  title: () => pkg.value?.name ? `${pkg.value.name} - npmx` : 'Package - npmx',
  description: () => pkg.value?.description ?? '',
})
</script>

<template>
  <main>
    <PackageSkeleton v-if="status === 'pending'" />

    <article v-else-if="status === 'success' && pkg">
      <header>
        <h1>{{ pkg.name }}</h1>
        <p v-if="pkg.description">
          {{ pkg.description }}
        </p>

        <dl>
          <div v-if="latestVersion">
            <dt>Version</dt>
            <dd>{{ latestVersion.version }}</dd>
          </div>

          <div v-if="pkg.license">
            <dt>License</dt>
            <dd>{{ pkg.license }}</dd>
          </div>

          <div v-if="downloads">
            <dt>Weekly Downloads</dt>
            <dd>{{ formatNumber(downloads.downloads) }}</dd>
          </div>

          <div v-if="latestVersion?.dist?.unpackedSize">
            <dt>Unpacked Size</dt>
            <dd>{{ formatBytes(latestVersion.dist.unpackedSize) }}</dd>
          </div>

          <div v-if="getDependencyCount(latestVersion) > 0">
            <dt>Dependencies</dt>
            <dd>{{ getDependencyCount(latestVersion) }}</dd>
          </div>

          <div v-if="pkg.time?.modified">
            <dt>Last Published</dt>
            <dd>
              <time :datetime="pkg.time.modified">{{ formatDate(pkg.time.modified) }}</time>
            </dd>
          </div>
        </dl>

        <nav aria-label="Package links">
          <ul>
            <li v-if="repositoryUrl">
              <a
                :href="repositoryUrl"
                rel="noopener noreferrer"
              >Repository</a>
            </li>
            <li v-if="homepageUrl">
              <a
                :href="homepageUrl"
                rel="noopener noreferrer"
              >Homepage</a>
            </li>
            <li v-if="latestVersion?.bugs?.url">
              <a
                :href="latestVersion.bugs.url"
                rel="noopener noreferrer"
              >Issues</a>
            </li>
            <li>
              <a
                :href="`https://www.npmjs.com/package/${pkg.name}`"
                rel="noopener noreferrer"
              >npmjs.com</a>
            </li>
          </ul>
        </nav>
      </header>

      <section aria-labelledby="install-heading">
        <h2 id="install-heading">
          Install
        </h2>
        <pre><code>npm install {{ pkg.name }}</code></pre>
      </section>

      <section
        v-if="pkg.maintainers?.length"
        aria-labelledby="maintainers-heading"
      >
        <h2 id="maintainers-heading">
          Maintainers
        </h2>
        <ul>
          <li
            v-for="maintainer in pkg.maintainers"
            :key="maintainer.name ?? maintainer.email"
          >
            <a
              v-if="maintainer.name"
              :href="`https://www.npmjs.com/~${maintainer.name}`"
              rel="noopener noreferrer"
            >
              {{ maintainer.name }}
            </a>
            <span v-else>{{ maintainer.email }}</span>
          </li>
        </ul>
      </section>

      <section
        v-if="latestVersion?.keywords?.length"
        aria-labelledby="keywords-heading"
      >
        <h2 id="keywords-heading">
          Keywords
        </h2>
        <ul>
          <li
            v-for="keyword in latestVersion.keywords"
            :key="keyword"
          >
            <NuxtLink :to="`/search?q=keywords:${encodeURIComponent(keyword)}`">
              {{ keyword }}
            </NuxtLink>
          </li>
        </ul>
      </section>

      <section
        v-if="sortedVersions.length"
        aria-labelledby="versions-heading"
      >
        <h2 id="versions-heading">
          Versions
        </h2>
        <table>
          <thead>
            <tr>
              <th scope="col">
                Version
              </th>
              <th scope="col">
                Published
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="version in sortedVersions"
              :key="version"
            >
              <td>
                <NuxtLink :to="`/package/${pkg.name}/v/${version}`">
                  {{ version }}
                </NuxtLink>
                <span v-if="pkg['dist-tags']?.latest === version"> (latest)</span>
              </td>
              <td>
                <time
                  v-if="pkg.time[version]"
                  :datetime="pkg.time[version]"
                >
                  {{ formatDate(pkg.time[version]) }}
                </time>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section
        v-if="latestVersion?.dependencies && Object.keys(latestVersion.dependencies).length > 0"
        aria-labelledby="dependencies-heading"
      >
        <h2 id="dependencies-heading">
          Dependencies
        </h2>
        <ul>
          <li
            v-for="(version, dep) in latestVersion.dependencies"
            :key="dep"
          >
            <NuxtLink :to="`/package/${dep}`">
              {{ dep }}
            </NuxtLink>
            <span>{{ version }}</span>
          </li>
        </ul>
      </section>

      <section
        v-if="readmeData?.html"
        aria-labelledby="readme-heading"
      >
        <h2 id="readme-heading">
          Readme
        </h2>
        <!-- eslint-disable-next-line vue/no-v-html -- HTML is sanitized server-side -->
        <div v-html="readmeData.html" />
      </section>
    </article>

    <div
      v-else-if="status === 'error'"
      role="alert"
    >
      <h1>Package Not Found</h1>
      <p>{{ error?.message ?? 'The package could not be found.' }}</p>
      <NuxtLink to="/">
        Go back home
      </NuxtLink>
    </div>
  </main>
</template>
