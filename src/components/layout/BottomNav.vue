<template>
  <nav class="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-800/95 border-t border-gray-200 dark:border-gray-700 lg:hidden z-50 backdrop-blur-md">
    <div class="max-w-4xl mx-auto flex justify-between items-center px-4 py-2">
      <button @click="$router.push({ name: 'dashboard' })" class="flex flex-col items-center text-xs text-gray-700 dark:text-gray-300 transition-all duration-200 hover:scale-110 active:scale-95" aria-label="Dasbor">
        <Icon icon="mdi:view-dashboard-outline" class="text-[20px]" />
        <span>Dasbor</span>
      </button>
      <button @click="$router.push({ name: 'barang-keluar' })" class="flex flex-col items-center text-xs text-gray-700 dark:text-gray-300 transition-all duration-200 hover:scale-110 active:scale-95" aria-label="Barang Keluar">
        <Icon icon="mdi:archive-arrow-down-outline" class="text-[20px]" />
        <span>Keluar</span>
      </button>
      <button @click="$router.push({ name: 'pelacakan' })" class="flex flex-col items-center text-xs text-gray-700 dark:text-gray-300 transition-all duration-200 hover:scale-110 active:scale-95" aria-label="Pelacakan">
        <Icon icon="mdi:truck-outline" class="text-[20px]" />
        <span>Track</span>
      </button>
      <button @click="$router.push({ name: 'invoice' })" class="flex flex-col items-center text-xs text-gray-700 dark:text-gray-300 transition-all duration-200 hover:scale-110 active:scale-95" aria-label="Invoice">
        <Icon icon="mdi:receipt-text-outline" class="text-[20px]" />
        <span>Invoice</span>
      </button>
      <button @click="$router.push({ name: 'pod-upload', params: { token: 'manual' } })" class="flex flex-col items-center text-xs text-gray-700 dark:text-gray-300 transition-all duration-200 hover:scale-110 active:scale-95" aria-label="POD">
        <Icon icon="mdi:camera-outline" class="text-[20px]" />
        <span>POD</span>
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
