<script setup lang="ts">
import { NPMX_DOCS_SITE } from '#shared/utils/constants'

const atprotoLink = useAtprotoSiteUrl()
</script>

<template>
  <details class="text-sm">
    <summary
      class="w-fit text-fg-subtle hover:text-fg-muted transition-colors duration-200 focus-visible:(outline-2 outline-accent/70)"
    >
      {{ $t('collections.your_data.summary') }}
    </summary>
    <div class="mt-3 flex max-w-prose flex-col gap-2 text-fg-muted">
      <i18n-t keypath="collections.your_data.body" tag="p" scope="global">
        <template #atproto>
          <LinkBase :to="atprotoLink">AT Protocol</LinkBase>
        </template>
      </i18n-t>
      <p>
        <LinkBase :to="`${NPMX_DOCS_SITE}/integrations/collections`">
          {{ $t('collections.your_data.docs') }}
        </LinkBase>
      </p>
    </div>
  </details>
</template>
