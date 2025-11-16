<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as echarts from 'echarts/core';
import type { EChartsCoreOption } from 'echarts/core';
import { LineChart, BarChart, PieChart, RadarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([LineChart, BarChart, PieChart, RadarChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

type Props = { option: EChartsCoreOption };
const props = defineProps<Props>();
const chartDom = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

onMounted(() => {
  if (chartDom.value) {
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
