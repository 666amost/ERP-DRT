<script setup lang="ts">
import { Icon } from '@iconify/vue';

interface Props { title: string; value: number | string; delta?: string; icon: string }

const p = defineProps<Props>();
</script>

<template>
  <div class="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-4">
    <div class="h-9 w-9 rounded-lg grid place-items-center" :class="'bg-blue-50 text-blue-600'">
      <Icon :icon="p.icon" class="text-[18px]" />
    </div>
    <div class="flex-1">
      <div class="text-sm text-gray-500">{{ p.title }}</div>
      <div class="text-2xl font-semibold mt-1">{{ p.value }}</div>
      <div v-if="p.delta" class="text-xs text-emerald-600 mt-1">{{ p.delta }}</div>
    </div>
  </div>
</template>
