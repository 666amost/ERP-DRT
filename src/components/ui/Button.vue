<script setup lang="ts">
interface Props {
  variant?: 'default' | 'primary' | 'success' | 'warning';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}
const p = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  type: 'button',
  disabled: false
});
const classes: Record<string, string> = {
  default: 'bg-gray-800 text-white hover:bg-gray-700',
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  warning: 'bg-amber-500 text-white hover:bg-amber-600'
};
</script>

<template>
  <button
    :type="p.type"
    :disabled="p.disabled"
    class="inline-flex items-center justify-center h-10 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    :class="classes[p.variant]"
  >
    <slot />
  </button>
  
</template>