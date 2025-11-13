<script setup lang="ts">
import { Icon } from '@iconify/vue';

defineEmits<{
  toggleSidebar: [];
}>();
</script>

<template>
  <header class="h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-6">
    <button
      class="lg:hidden h-10 w-10 grid place-items-center rounded-lg hover:bg-gray-100 mr-2"
      @click="$emit('toggleSidebar')"
    >
      <Icon
        icon="mdi:menu"
        class="text-[24px]"
      />
    </button>
    <div class="flex-1 flex items-center gap-3">
      <div class="relative flex-1 max-w-xl">
        <input
          type="text"
          placeholder="Cari invoice, surat jalan, tracking..."
          class="w-full h-10 pl-10 pr-3 rounded-lg bg-gray-50 border border-gray-200 outline-none focus:ring-2 focus:ring-blue-200 text-sm"
        >
        <Icon
          icon="mdi:magnify"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
        />
      </div>
    </div>
    <button class="h-10 w-10 grid place-items-center rounded-lg hover:bg-gray-100">
      <Icon
        icon="mdi:bell-outline"
        class="text-[20px]"
      />
    </button>
  </header>
</template>
