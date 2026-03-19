<script setup>
const pkg = useState('badge-pkg', () => 'nuxt')
const type = useState('badge-type', () => 'version')
const isValid = ref(true)
const copied = ref(false)

const types = [
  'version',
  'license',
  'size',
  'downloads',
  'downloads-day',
  'downloads-week',
  'downloads-month',
  'downloads-year',
  'vulnerabilities',
  'dependencies',
  'created',
  'updated',
  'engines',
  'types',
  'maintainers',
  'deprecated',
  'quality',
  'popularity',
  'maintenance',
  'score',
  'name'
]

watch(pkg, () => {
  isValid.value = true
})

const copyToClipboard = async () => {
  const markdown = `[![Open on npmx.dev](https://npmx.dev/api/registry/badge/${type.value}/${pkg.value})](https://npmx.dev/package/${pkg.value})`
  await navigator.clipboard.writeText(markdown)

  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>

<template>
  <div class="my-8 p-5 rounded-xl border border-gray-200/60 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] flex flex-col sm:flex-row items-end gap-4">

    <div class="flex flex-col gap-1.5 flex-1 w-full">
      <label class="text-[11px] font-bold uppercase tracking-wider text-gray-400 ml-1">Package Name</label>
      <input
        v-model="pkg"
        type="text"
        spellcheck="false"
        class="w-full h-[42px] px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all"
        :class="{ 'border-red-500/50 focus:ring-red-500/10 focus:border-red-500': !isValid }"
        placeholder="e.g. nuxt"
      />
    </div>

    <div class="flex flex-col gap-1.5 flex-1 w-full">
      <label class="text-[11px] font-bold uppercase tracking-wider text-gray-400 ml-1">Badge Type</label>
      <div class="relative">
        <select
          v-model="type"
          class="w-full h-[42px] px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all appearance-none cursor-pointer"
        >
          <option v-for="t in types" :key="t" :value="t" class="dark:bg-gray-900">{{ t }}</option>
        </select>
        <span class="absolute right-3 top-1/2 -translate-y-1/2 i-lucide-chevron-down w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    </div>

    <div class="flex flex-col gap-1.5 flex-2 w-full">
      <label class="text-[11px] font-bold uppercase tracking-wider text-gray-400 ml-1">Preview & Action</label>
      <div class="flex items-center bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg h-[42px] overflow-hidden">

        <div class="flex-1 flex items-center justify-center px-3 border-r border-gray-200 dark:border-white/10 h-full bg-gray-50/50 dark:bg-transparent">
          <img
            v-if="isValid"
            :src="`https://npmx.dev/api/registry/badge/${type}/${pkg}`"
            class="h-[20px]"
            alt="Badge Preview"
            @error="isValid = false"
          />
          <span v-else class="text-[10px] font-bold text-red-500 uppercase tracking-tighter">Invalid</span>
        </div>

        <button
          @click="copyToClipboard"
          :disabled="!isValid"
          class="px-4 h-full text-[11px] font-bold uppercase tracking-widest transition-all disabled:opacity-20 disabled:cursor-not-allowed min-w-[85px] hover:bg-gray-50 dark:hover:bg-white/5"
          :class="copied ? 'text-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/10' : 'text-gray-500 dark:text-gray-400'"
        >
          {{ copied ? 'Done!' : 'Copy' }}
        </button>
      </div>
    </div>

  </div>
</template>
