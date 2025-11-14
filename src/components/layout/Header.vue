<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { useTheme } from '../../composables/useTheme';

const { theme, toggle } = useTheme();

defineEmits<{
  toggleSidebar: [];
}>();
</script>

<template>
  <header class="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 lg:px-6">
    <button
      class="lg:hidden h-10 w-10 grid place-items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 mr-2"
      @click="$emit('toggleSidebar')"
    >
      <Icon
        icon="mdi:menu"
        class="text-[24px] dark:text-gray-200"
      />
    </button>
    <div class="flex-1 flex items-center gap-3">
      <div class="relative flex-1 max-w-xl">
        <input
          type="text"
          placeholder="Cari invoice, surat jalan, tracking..."
          class="w-full h-10 pl-10 pr-3 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500 text-sm dark:text-gray-100 dark:placeholder-gray-400"
        >
        <Icon
          icon="mdi:magnify"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
        />
      </div>
    </div>
    <button class="h-10 w-10 grid place-items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
      <Icon
        icon="mdi:bell-outline"
        class="text-[20px] dark:text-gray-200 transition-transform hover:scale-110"
      />
    </button>
    <button class="h-10 w-10 grid place-items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 ml-2" @click="toggle()" :title="theme.value === 'dark' ? 'Light mode' : 'Dark mode'">
      <Icon :icon="theme.value === 'dark' ? 'mdi:weather-sunny' : 'mdi:moon-waning-crescent'" class="text-[18px] dark:text-gray-200 transition-transform hover:scale-110" />
    </button>
  </header>
</template>
