<script setup lang="ts">
const { backgroundThemes, selectedBackgroundTheme, setBackgroundTheme } = useBackgroundTheme()

onPrehydrate(el => {
  const settings = JSON.parse(localStorage.getItem('npmx-settings') || '{}')
  const id = settings.preferredBackgroundTheme
  if (id) {
    const input = el.querySelector<HTMLInputElement>(`input[value="${id}"]`)
    if (input) {
      input.checked = true
      input.setAttribute('checked', '')
    }
  }
})
</script>

<template>
  <fieldset
    class="flex items-center gap-4 has-[input:focus-visible]:(outline-solid outline-accent/70 outline-offset-4) rounded-xl w-fit"
  >
    <legend class="sr-only">{{ $t('settings.background_themes') }}</legend>
    <label
      v-for="theme in backgroundThemes"
      :key="theme.id"
      class="size-6 rounded-full transition-transform duration-150 motion-safe:hover:scale-110 cursor-pointer has-[:checked]:(ring-2 ring-fg ring-offset-2 ring-offset-bg-subtle) has-[:focus-visible]:(ring-2 ring-fg ring-offset-2 ring-offset-bg-subtle)"
      :style="{ backgroundColor: theme.value }"
    >
      <input
        type="radio"
        name="background-theme"
        class="sr-only"
        :value="theme.id"
        :checked="selectedBackgroundTheme === theme.id"
        :aria-label="theme.name"
        @change="setBackgroundTheme(theme.id)"
      />
    </label>
  </fieldset>
</template>
