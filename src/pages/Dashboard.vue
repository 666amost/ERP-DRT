<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import OverviewCard from '../components/dashboard/OverviewCard.vue';
import ProgressBar from '../components/ui/ProgressBar.vue';
import Badge from '../components/ui/Badge.vue';
import Button from '../components/ui/Button.vue';
import { defineAsyncComponent } from 'vue';
const DashboardChart = defineAsyncComponent(() => import('../components/dashboard/DashboardChart.vue'));
import InvoiceTable from '../components/InvoiceTable.vue';
import http from '../lib/http';
import { useFormatters } from '../composables/useFormatters';
import type { EChartsCoreOption } from 'echarts/core';

// Destructuring not used in this page; keep useFormatters available if needed later
useFormatters();

type Stats = {
  outgoingToday: number;
  activeShipments: number;
  pendingInvoices: number;
  deliveryNotes: number;
};

type Shipment = {
  id: number;
  public_code: string;
  origin: string;
  destination: string;
  status: string;
  carrier_name: string | null;
  driver_name: string | null;
};


const stats = ref<Stats>({ outgoingToday: 0, activeShipments: 0, pendingInvoices: 0, deliveryNotes: 0 });
const tracking = ref<Shipment[]>([]);
const trend = ref<{ day: string; count: number }[]>([]);
const loading = ref(true);
const router = useRouter();

const lineOption = computed<EChartsCoreOption>(() => {
  const days = trend.value.length > 0 ? trend.value.map(t => new Date(t.day).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })) : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const base = trend.value.length > 0 ? trend.value.map(t => t.count) : [20, 30, 28, 40, 38, 50, stats.value.outgoingToday || 25];
  return {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: days },
    yAxis: { type: 'value' },
    series: [
      { name: 'Outgoing', type: 'line', smooth: true, data: base, areaStyle: {} }
    ],
  } as EChartsCoreOption;
});

function viewAllInvoices() {
  router.push({ name: 'invoice' });
}

function addInvoice() {
  router.push({ name: 'invoice', query: { create: '1' } });
}

async function loadData() {
  try {
    const [s, t] = await Promise.all([
      http.get('/dashboard?endpoint=stats'),
      http.get('/dashboard?endpoint=tracking')
    ]);
    stats.value = s.data;
    const trackingData = t.data;
    tracking.value = trackingData.items || [];
    // invoices will be handled by the InvoiceTable component
    // fetch trend data for chart
    try {
      const trendRes = await http.get('/dashboard?endpoint=trend');
      trend.value = trendRes.data.items || [];
    } catch (e) {
      console.error('Failed to load trend data:', e);
    }
  } catch (e) {
    console.error('Failed to load dashboard:', e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div
    v-if="loading"
    class="flex items-center justify-center h-64 pb-20 lg:pb-0"
  >
    <div class="text-gray-500">
      Loading...
    </div>
  </div>
  <div
    v-else
    class="space-y-6 pb-20 lg:pb-0"
  >
    <div class="text-xl font-semibold">
      Dashboard
    </div>
    <div class="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
      <OverviewCard
        title="Barang Keluar Hari Ini"
        :value="stats.outgoingToday"
        delta="+12.5% vs bulan lalu"
        icon="mdi:clipboard-text-outline"
      />
      <OverviewCard
        title="Pengiriman Aktif"
        :value="stats.activeShipments"
        delta="+8.2% vs bulan lalu"
        icon="mdi:truck-outline"
      />
      <OverviewCard
        title="Invoice Pending"
        :value="stats.pendingInvoices"
        delta="-3.1% vs bulan lalu"
        icon="mdi:receipt-text-outline"
      />
      <OverviewCard
        title="Surat Jalan"
        :value="stats.deliveryNotes"
        delta="+15.8% vs bulan lalu"
        icon="mdi:file-document-outline"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 card">
        <div class="font-medium mb-3 dark:text-gray-100">
          Invoice Terbaru
        </div>
        <div class="grid gap-4">
          <DashboardChart :option="lineOption" />
          <InvoiceTable />
        </div>
        <div class="mt-4 flex gap-2">
          <Button variant="primary" @click="addInvoice">
            Tambah Invoice
          </Button>
          <Button variant="default" @click="viewAllInvoices">
            Lihat Semua
          </Button>
        </div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 card">
        <div class="font-medium mb-3 dark:text-gray-100">
          Tracking Pengiriman Terkini
        </div>
        <div class="tracking-panel smooth-scroll overflow-auto max-h-[50vh] pr-2">
          <div
            v-if="tracking.length === 0"
            class="text-sm text-gray-500 dark:text-gray-400"
          >
            Belum ada pengiriman aktif
          </div>
          <div
            v-else
            class="space-y-4"
          >
            <div
              v-for="item in tracking"
              :key="item.id"
            >
              <div class="text-sm font-medium dark:text-gray-100">
                {{ item.public_code }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                {{ item.driver_name || 'Driver' }} • {{ item.origin }} - {{ item.destination }}
              </div>
              <div class="mt-2">
                <ProgressBar :value="66" />
              </div>
              <div class="mt-2">
                <Badge variant="info">
                  Dalam Perjalanan
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 card">
        <div class="font-medium mb-3 dark:text-gray-100">
          POD (Proof of Delivery)
        </div>
        <div class="space-y-2">
          <Button
            variant="primary"
            @click="$router.push({ name: 'pod-upload', params: { token: 'manual' } })"
          >
            Upload POD
          </Button>
          <Button
            variant="default"
            @click="$router.push({ name: 'admin-pod' })"
          >
            Daftar POD Admin
          </Button>
        </div>
        <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Upload foto POD, lihat status, dan kelola dokumen pengiriman.
        </div>
      </div>
    </div>
  </div>
</template>
