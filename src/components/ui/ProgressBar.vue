<script setup lang="ts">
interface Props { value: number }
const p = defineProps<Props>();
const width = () => `${Math.min(100, Math.max(0, Math.round(p.value)))}%`;
</script>

<template>
  <div class="h-2 bg-gray-100 rounded-full">
    <div
      class="h-2 bg-primary rounded-full"
      :style="{ width: width() }"
    />
  </div>
</template>