<template>
  <nav class="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-800/95 border-t border-gray-200 dark:border-gray-700 lg:hidden z-50 backdrop-blur-md">
    <div class="max-w-4xl mx-auto flex justify-between items-center px-4 py-2">
      <button
        class="flex flex-col items-center text-xs text-gray-700 dark:text-gray-300 transition-all duration-200 hover:scale-110 active:scale-95"
        aria-label="Dasbor"
        @click="$router.push({ name: 'dashboard' })"
      >
        <Icon
          icon="mdi:view-dashboard-outline"
          class="text-[20px]"
        />
        <span>Dasbor</span>
      </button>
      <button
        class="flex flex-col items-center text-xs text-gray-700 dark:text-gray-300 transition-all duration-200 hover:scale-110 active:scale-95"
        aria-label="Barang Keluar"
        @click="$router.push({ name: 'barang-keluar' })"
      >
        <Icon
          icon="mdi:archive-arrow-down-outline"
          class="text-[20px]"
        />
        <span>Keluar</span>
      </button>
      <button
        class="flex flex-col items-center text-xs text-gray-700 dark:text-gray-300 transition-all duration-200 hover:scale-110 active:scale-95"
        aria-label="Pelacakan"
        @click="$router.push({ name: 'pelacakan' })"
      >
        <Icon
          icon="mdi:truck-outline"
          class="text-[20px]"
        />
        <span>Track</span>
      </button>
      <button
        class="flex flex-col items-center text-xs text-gray-700 dark:text-gray-300 transition-all duration-200 hover:scale-110 active:scale-95"
        aria-label="Invoice"
        @click="$router.push({ name: 'invoice' })"
      >
        <Icon
          icon="mdi:receipt-text-outline"
          class="text-[20px]"
        />
        <span>Invoice</span>
      </button>
      <button
        class="flex flex-col items-center text-xs text-gray-700 dark:text-gray-300 transition-all duration-200 hover:scale-110 active:scale-95"
        aria-label="Surat Jalan"
        @click="$router.push({ name: 'surat-jalan' })"
      >
        <Icon
          icon="mdi:file-document-outline"
          class="text-[20px]"
        />
        <span>Surat Jalan</span>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
</script>

<style scoped>
/* Backdrop filter applied via Tailwind classes */
</style>
