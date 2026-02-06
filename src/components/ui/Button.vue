<script setup lang="ts">
interface Props {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  block?: boolean;
}
const p = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  disabled: false,
  block: false
});

const classes: Record<string, string> = {
  default: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600',
  primary: 'bg-primary text-white hover:bg-primary-dark dark:bg-gray-700 dark:hover:bg-gray-600',
  secondary: 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500',
  success: 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600',
  warning: 'bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500',
  info: 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600',
  danger: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600',
  ghost: 'bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-none'
};

const sizes: Record<string, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-base'
};
</script>

<template>
  <button
    :type="p.type"
    :disabled="p.disabled"
    class="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-md active:scale-95"
    :class="[classes[p.variant], sizes[p.size], p.block ? 'w-full min-w-0' : '']"
  >
    <slot />
  </button>
</template>
