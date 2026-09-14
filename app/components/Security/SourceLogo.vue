<script setup lang="ts">
import type { SecuritySourceId } from '#shared/types/dependency-analysis'
import OsvLight from '~/assets/logos/security-sources/osv-mark-light.svg'
import OsvDark from '~/assets/logos/security-sources/osv-mark-dark.svg'
import SocketLogo from '~/assets/logos/security-sources/socket.svg'

const props = defineProps<{
  source: SecuritySourceId
}>()

// OSV's mark is dark ink + a red dot, so it needs a light-on-dark variant;
// Socket's brand gradient reads on either theme, so one asset suffices.
const osv = { light: OsvLight, dark: OsvDark }
</script>

<template>
  <img
    v-if="source === 'socket'"
    :src="SocketLogo"
    alt="Socket"
    title="Socket"
    class="security-source-logo"
  />
  <!-- theme-adaptive pair; only the visible <img> is in the a11y tree, so alt
       is announced in whichever theme is active. Theme is driven by
       :root[data-theme] (see app/assets/main.css), with dark as the default -->
  <span v-else class="security-source-logo inline-flex">
    <img :src="osv.light" alt="OSV" title="OSV" class="ssl-light h-full w-auto" />
    <img :src="osv.dark" alt="OSV" title="OSV" class="ssl-dark h-full w-auto" />
  </span>
</template>

<style scoped>
/* dark is the default theme (:root:not([data-theme='light'])) */
.ssl-light {
  display: none;
}
.ssl-dark {
  display: inline-block;
}
:root[data-theme='light'] .ssl-light {
  display: inline-block;
}
:root[data-theme='light'] .ssl-dark {
  display: none;
}
</style>
