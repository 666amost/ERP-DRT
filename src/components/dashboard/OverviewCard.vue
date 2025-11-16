<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { ref, onMounted, watch } from 'vue';
import { CountUp } from 'countup.js';

interface Props { title: string; value: number | string; delta?: string; icon: string }
const p = defineProps<Props>();
const valueRef = ref<HTMLElement | null>(null);
let countUp: CountUp | null = null;

onMounted(() => {
  if (valueRef.value) {
    if (typeof p.value === 'number') {
      countUp = new CountUp((valueRef.value as HTMLElement), p.value as number);
      if (!countUp.error) countUp.start();
    } else {
      valueRef.value.textContent = String(p.value);
    }
  }
});

watch(() => p.value, (nv) => {
  if (!valueRef.value) return;
  if (typeof nv === 'number') {
    if (!countUp) countUp = new CountUp(valueRef.value as HTMLElement, nv);
    countUp.update ? countUp.update(nv) : countUp.start();
  } else {
    if (countUp) countUp.pauseResume();
    valueRef.value.textContent = String(nv);
  }
});
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-start gap-4 card">
    <div class="h-9 w-9 rounded-lg grid place-items-center bg-primary-light text-primary-dark dark:bg-primary-dark dark:text-primary-light">
      <Icon
        :icon="p.icon"
        class="text-[18px]"
      />
    </div>
    <div class="flex-1">
      <div class="text-sm text-gray-500 dark:text-gray-300">
        {{ p.title }}
      </div>
      <div class="text-2xl font-semibold mt-1 text-gray-900 dark:text-gray-100" ref="valueRef">
        <template v-if="typeof p.value !== 'number'">{{ p.value }}</template>
      </div>
      <div
        v-if="p.delta"
        class="text-xs text-emerald-600 dark:text-emerald-400 mt-1"
      >
        {{ p.delta }}
      </div>
    </div>
  </div>
</template>
