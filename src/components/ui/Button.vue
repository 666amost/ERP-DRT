<script setup lang="ts">
interface Props {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  loading?: boolean;
  block?: boolean;
}
const p = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  disabled: false,
  loading: false,
  block: false
});

const classes: Record<string, string> = {
  default: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600',
  primary: 'bg-primary text-white hover:bg-primary-dark dark:bg-blue-600 dark:hover:bg-blue-500',
  secondary: 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500',
  success: 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600',
  warning: 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-100 dark:hover:bg-amber-800',
  info: 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600',
  danger: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600',
  ghost: 'bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-none'
};

const sizes: Record<string, string> = {
  sm: 'min-h-9 px-3 py-1.5 text-sm',
  md: 'min-h-11 px-4 py-2 text-sm',
  lg: 'min-h-12 px-5 py-2 text-base'
};
</script>

<template>
  <button
    :type="p.type"
    :disabled="p.disabled || p.loading"
    :aria-busy="p.loading || undefined"
    class="action-button inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
    :class="[classes[p.variant], sizes[p.size], p.block ? 'w-full min-w-0' : '']"
  >
    <svg v-if="p.loading" class="button-spinner h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity="0.25" /><path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
    <slot />
  </button>
</template>
