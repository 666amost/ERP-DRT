<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import type { ECharts, EChartsCoreOption } from 'echarts/core';

type Props = { option: EChartsCoreOption };
const props = defineProps<Props>();
const chartDom = ref<HTMLDivElement | null>(null);
let chart: ECharts | null = null;

onMounted(async () => {
  if (chartDom.value) {
    // Dynamic import of echarts to avoid bundling in initial chunks
    const echarts = await import('echarts/core');
    const { LineChart, BarChart, PieChart, RadarChart } = await import('echarts/charts');
    const { GridComponent, TooltipComponent, LegendComponent, TitleComponent } = await import('echarts/components');
    const { CanvasRenderer } = await import('echarts/renderers');
    echarts.use([LineChart, BarChart, PieChart, RadarChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);
    chart = echarts.init(chartDom.value as HTMLDivElement);
    if (props.option) chart.setOption(props.option);
    window.addEventListener('resize', handleResize);
  }
});

watch(() => props.option, (opt) => {
  if (chart && opt) chart.setOption(opt);
}, { deep: true });

onBeforeUnmount(() => {
  if (chart) chart.dispose();
  window.removeEventListener('resize', handleResize);
});

function handleResize() {
  if (chart) chart.resize();
}
</script>

<template>
  <div
    ref="chartDom"
    class="w-full h-64"
  />
</template>
