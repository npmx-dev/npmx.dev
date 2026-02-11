<script setup lang="ts">
const props = defineProps<{
  label: string
  description?: string
}>()
const checked = defineModel<boolean>({
  required: true,
})
const id = useId()
</script>

<template>
  <label :for="id">
    <span class="label-text">{{ label }}</span>
    <input role="switch" type="checkbox" :id class="checkbox" v-model="checked" />
    <span class="background"></span>
  </label>
  <p v-if="description" class="text-sm text-fg-muted mt-2">
    {{ description }}
  </p>
</template>

<style scoped>
.label-text {
  grid-area: label-text;
}

.background {
  grid-area: toggle-background;
  justify-self: end;
}

.checkbox {
  opacity: 0;
}

label {
  display: grid;
  grid-template-areas: 'label-text . toggle-background';
}

input {
  grid-row: 1;
  grid-column: 3;
  justify-self: end;
}

/* background */
.background {
  width: 44px;
  height: 24px;
  background: var(--fg-subtle);
  border-radius: 9999px;
  border: 1px solid var(--fg);
  display: flex;
  position: relative;
}

label:has(input:focus-visible) .background {
  outline: solid 2px var(--fg);
  outline-offset: 2px;
}

label:has(input:checked) .background {
  background: var(--fg);
  border-color: var(--fg);
}

label:has(input:hover) .background {
  background: var(--fg-muted);
}

/* Circle that moves */
.background::before {
  transition: transform 200ms ease-in-out;
  content: '';
  width: 20px;
  height: 20px;
  top: 1px;
  inset-inline-start: 1px;
  position: absolute;
  border-radius: 9999px;
  background: var(--bg);
}

/* Support rtl locales */
:dir(ltr) .checkbox:checked + .background::before {
  transform: translate(20px);
}

:dir(rtl) .checkbox:checked + .background::before {
  transform: translate(-20px);
}
</style>
