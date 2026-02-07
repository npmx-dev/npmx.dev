<script setup lang="ts">
const props = defineProps<{
  label: string
  description?: string
  class?: string
}>()

const checked = defineModel<boolean>({
  default: false,
})
const id = 'toggle-' + props.label
</script>

<template>
  <label :for="id">
    <span class="toggle--label-text">{{ label }}</span>
    <input
      role="switch"
      type="checkbox"
      :id
      class="toggle--checkbox"
      :aria-checked="checked"
      :checked="checked"
      @click="checked = !checked"
    />
    <span class="toggle--background"></span>
  </label>
  <p v-if="description" class="text-sm text-fg-muted mt-2">
    {{ description }}
  </p>
</template>

<style scoped>
@keyframes reverse {
  0% {
    left: 20px;
    width: 20px;
  }
  60% {
    left: 3px;
    width: 40px;
  }
  100% {
    left: 3px;
  }
}

@keyframes switch {
  0% {
    left: 3px;
  }
  60% {
    left: 3px;
    width: 40px;
  }
  100% {
    left: 20px;
    width: 20px;
  }
}

.toggle--label-text {
  grid-area: label-text;
}

.toggle--background {
  grid-area: toggle-background;
  justify-self: end;
}

.toggle--checkbox {
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

label:has(input:focus) .toggle--background {
  outline: solid 1px #030712;
  outline-offset: 2px;
  transition: outline 100ms ease-in;
}
label:has(input:hover) .toggle--background {
  background: #6b7280;
}

/* background */
.toggle--background {
  width: 44px;
  height: 24px;
  background: #9ca3af;
  border-radius: 100px;
  border: 1px solid #030712;
  display: flex;
  position: relative;
  transition: all 350ms ease-in;
}

label:has(input:checked) .toggle--background {
  background: #030712;
  border-color: #030712;
}

/* Circle that moves */
.toggle--checkbox:checked + .toggle--background:before {
  animation-name: reverse;
  animation-duration: 350ms;
  animation-fill-mode: forwards;
  transition: all 360ms ease-in;
  background: #f9fafb;
}

.toggle--background:before {
  animation-name: switch;
  animation-duration: 350ms;
  animation-fill-mode: forwards;
  content: '';
  width: 20px;
  height: 20px;
  top: 1px;
  left: 3px;
  position: absolute;
  border-radius: 20px;
  background: #f9fafb;
}
</style>
