<script setup lang="ts">
interface Props { variant?: 'default' | 'success' | 'warning' | 'info' }
const p = withDefaults(defineProps<Props>(), { variant: 'default' });
const classes: Record<string, string> = {
  default: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200',
  success: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
  warning: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
  info: 'bg-primary-light dark:bg-gray-700 text-primary-dark dark:text-gray-200'
};
</script>

<template>
  <span
    class="text-xs px-2.5 py-1 rounded-full font-medium transition-all duration-150"
    :class="classes[p.variant]"
  >
    <slot />
  </span>
</template>