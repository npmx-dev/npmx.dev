<script lang="ts" setup>
import { useClipboard } from '@vueuse/core'

const pkg = useState('badge-pkg', () => 'nuxt')
const type = useState<BadgeType>('badge-type', () => 'version')
const isValid = ref(true)

const { copy, copied } = useClipboard({ copiedDuring: 2000 })

const labelColor = useState('badge-label-color', () => '')
const labelText = useState('badge-label-text', () => '')
const badgeValue = useState('badge-value', () => '')
const badgeColor = useState('badge-color', () => '')
const usePkgName = useState('badge-use-name', () => false)
const badgeStyle = useState('badge-style', () => 'default')

const styles = ['default', 'shieldsio']

const validateHex = (hex: string) => {
  if (!hex) return true
  const clean = hex.replace('#', '')
  return /^[0-9A-F]{3}$/i.test(clean) || /^[0-9A-F]{6}$/i.test(clean)
}

const isLabelHexValid = computed(() => validateHex(labelColor.value))
const isBadgeHexValid = computed(() => validateHex(badgeColor.value))
const isInputValid = computed(
  () => isLabelHexValid.value && isBadgeHexValid.value && pkg.value.length > 0,
)

const cleanHex = (hex: string) => hex?.replace('#', '') || ''

const queryParams = computed(() => {
  if (!isInputValid.value) return ''
  const params = new URLSearchParams()

  if (labelColor.value) params.append('labelColor', cleanHex(labelColor.value))
  if (badgeColor.value) params.append('color', cleanHex(badgeColor.value))
  if (badgeStyle.value !== 'default') params.append('style', badgeStyle.value)
  if (badgeValue.value) params.append('value', badgeValue.value)

  if (usePkgName.value) {
    params.append('name', 'true')
  } else if (labelText.value) {
    params.append('label', labelText.value)
  }

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
})

const badgeUrl = computed(() => {
  if (!isInputValid.value) return ''
  return `https://npmx.dev/api/registry/badge/${type.value}/${pkg.value}${queryParams.value}`
})

watch([pkg, type, queryParams], () => {
  isValid.value = true
})

const formatLabel = (str: string) => {
  if (!str || typeof str !== 'string') return ''
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' per ')
}

const copyToClipboard = async () => {
  const markdown = `[![Open on npmx.dev](${badgeUrl.value})](https://npmx.dev/package/${pkg.value})`
  copy(markdown)
}
</script>

<template>
  <div
    class="my-8 p-5 rounded-xl border border-gray-200/60 dark:border-white/5 bg-gray-50/50 dark:bg-white/2 flex flex-col gap-6"
  >
    <div class="flex flex-col lg:flex-row items-end gap-4">
      <div class="flex flex-col gap-1.5 flex-1 w-full">
        <label class="text-[11px] font-bold uppercase tracking-wider text-gray-400 ml-1"
          >Package Name</label
        >
        <input
          v-model="pkg"
          type="text"
          placeholder="e.g. nuxt"
          class="w-full h-10.5 px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all"
        />
      </div>

      <div class="flex flex-col gap-1.5 flex-1 w-full">
        <label class="text-[11px] font-bold uppercase tracking-wider text-gray-400 ml-1"
          >Badge Type</label
        >
        <div class="relative">
          <select
            v-model="type"
            class="w-full h-10.5 px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all appearance-none cursor-pointer"
          >
            <option v-for="t in BADGE_TYPES" :key="t" :value="t" class="dark:bg-gray-900">
              {{ formatLabel(t) }}
            </option>
          </select>
          <span
            class="absolute right-3 top-1/2 -translate-y-1/2 i-lucide-chevron-down w-4 h-4 text-gray-400 pointer-events-none"
          />
        </div>
      </div>

      <div class="flex flex-col gap-1.5 flex-2 w-full">
        <label class="text-[11px] font-bold uppercase tracking-wider text-gray-400 ml-1"
          >Preview & Action</label
        >
        <div
          class="flex items-center bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg h-10.5 overflow-hidden"
        >
          <div
            class="flex-1 flex items-center justify-center px-3 border-r border-gray-200 dark:border-white/10 h-full bg-gray-50/10 dark:bg-transparent"
          >
            <img
              v-if="isValid && isInputValid"
              :src="badgeUrl"
              class="h-5"
              alt="Badge Preview"
              @error="isValid = false"
            />
            <span v-else class="text-[10px] font-bold text-red-500 uppercase tracking-tighter">
              {{ !isInputValid ? 'Invalid Parameters' : 'Not Found' }}
            </span>
          </div>
          <button
            @click="copyToClipboard"
            :disabled="!isValid || !isInputValid || !pkg"
            class="px-6 h-full text-[11px] font-bold uppercase tracking-widest transition-all disabled:opacity-20 disabled:cursor-not-allowed min-w-24 hover:bg-gray-50 dark:hover:bg-white/5"
            :class="
              copied
                ? 'text-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/10'
                : 'text-gray-500 dark:text-gray-400'
            "
          >
            {{ copied ? 'Done!' : 'Copy' }}
          </button>
        </div>
      </div>
    </div>

    <div class="h-px bg-gray-200 dark:bg-white/5 w-full" />

    <div class="grid grid-cols-1 sm:grid-cols-4 gap-6">
      <div class="flex flex-col gap-1.5">
        <label class="text-[10px] font-bold uppercase text-gray-400 ml-1">Label Text</label>
        <div class="relative group">
          <input
            v-model="labelText"
            :disabled="usePkgName"
            type="text"
            placeholder="Custom Label"
            class="w-full px-3 py-2 h-9 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-xs outline-none focus:border-emerald-500 disabled:cursor-not-allowed transition-all"
            :class="{ 'opacity-50 grayscale pl-3': usePkgName }"
          />

          <transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
          >
            <div
              v-if="usePkgName"
              class="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
            >
              <span
                class="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 text-[9px] font-bold uppercase tracking-tighter border border-emerald-500/20"
              >
                Auto
              </span>
            </div>
          </transition>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-[10px] font-bold uppercase text-gray-400 ml-1">Badge Value</label>
        <input
          v-model="badgeValue"
          type="text"
          placeholder="Override Value"
          class="px-3 py-2 h-9 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-xs outline-none focus:border-emerald-500 transition-all"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-[10px] font-bold uppercase text-gray-400 ml-1">Label Color</label>
        <div
          class="flex items-center px-3 rounded-lg border bg-white dark:bg-black/20 transition-all"
          :class="
            isLabelHexValid
              ? 'border-gray-200 dark:border-white/10 focus-within:border-emerald-500'
              : 'border-red-500 ring-1 ring-red-500/20'
          "
        >
          <span class="text-gray-400 text-xs font-mono mr-1">#</span>
          <input
            v-model="labelColor"
            type="text"
            placeholder="0a0a0a"
            class="w-full py-2 bg-transparent text-xs outline-none"
          />
          <span
            v-if="!isLabelHexValid"
            class="i-lucide-alert-circle w-3.5 h-3.5 text-red-500 ml-1"
          />
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-[10px] font-bold uppercase text-gray-400 ml-1">Badge Color</label>
        <div
          class="flex items-center px-3 rounded-lg border bg-white dark:bg-black/20 transition-all"
          :class="
            isBadgeHexValid
              ? 'border-gray-200 dark:border-white/10 focus-within:border-emerald-500'
              : 'border-red-500 ring-1 ring-red-500/20'
          "
        >
          <span class="text-gray-400 text-xs font-mono mr-1">#</span>
          <input
            v-model="badgeColor"
            type="text"
            placeholder="ff69b4"
            class="w-full py-2 bg-transparent text-xs outline-none"
          />
          <span
            v-if="!isBadgeHexValid"
            class="i-lucide-alert-circle w-3.5 h-3.5 text-red-500 ml-1"
          />
        </div>
      </div>
    </div>

    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-gray-200/50 dark:border-white/5"
    >
      <label class="relative inline-flex items-center cursor-pointer group">
        <input v-model="usePkgName" type="checkbox" class="sr-only peer" />
        <div
          class="w-9 h-5 bg-gray-200 peer-focus:outline-none dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 rounded-full"
        ></div>
        <span
          class="ml-3 text-[10px] font-bold uppercase text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors"
          >Use package name as label</span
        >
      </label>

      <div class="flex items-center gap-3">
        <label class="text-[10px] font-bold uppercase text-gray-400 whitespace-nowrap"
          >Badge Style</label
        >
        <select
          v-model="badgeStyle"
          class="min-w-30 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-xs outline-none cursor-pointer hover:border-emerald-500 transition-colors"
        >
          <option v-for="s in styles" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>
    </div>
  </div>
</template>
