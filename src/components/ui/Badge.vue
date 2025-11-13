<script setup lang="ts">
interface Props { variant?: 'default' | 'success' | 'warning' | 'info' }
const p = withDefaults(defineProps<Props>(), { variant: 'default' });
const classes: Record<string, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-blue-100 text-blue-700'
};
</script>

<template>
  <span class="text-xs px-2.5 py-1 rounded-full font-medium" :class="classes[p.variant]">
    <slot />
  </span>
</template>