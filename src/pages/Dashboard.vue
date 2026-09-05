<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import OverviewCard from '../components/dashboard/OverviewCard.vue';
import Badge from '../components/ui/Badge.vue';
import Button from '../components/ui/Button.vue';
import { defineAsyncComponent } from 'vue';
const DashboardChart = defineAsyncComponent(() => import('../components/dashboard/DashboardChart.vue'));
import http from '../lib/http';
import { useAuth } from '../composables/useAuth';
import { useFormatters } from '../composables/useFormatters';
import { useTheme } from '../composables/useTheme';
import type { EChartsCoreOption } from 'echarts/core';

const { fetchUser, permissions, user } = useAuth();
const { formatRupiah } = useFormatters();
const router = useRouter();
const { theme } = useTheme();
const error = ref('');
const trendError = ref(false);

type Stats = {
  outgoingToday: number;
  activeShipments: number;
  pendingInvoices: number;
  deliveryNotes: number;
  totalInvoices: number;
  outstandingCount: number;
  outstandingAmount: number;
  pelunasanCount: number;
  pelunasanAmount: number;
};

type Shipment = {
  id: number;
  spb_number: string | null;
  public_code: string;
  origin: string;
  destination: string;
  status: string;
  carrier_name: string | null;
  driver_name: string | null;
};

type DBLItem = {
  id: number;
  dbl_number: string;
  driver_name: string | null;
  vehicle_number: string | null;
  origin: string | null;
  destination: string | null;
  status: string;
  created_at: string;
  shipment_count?: number;
};

type Invoice = {
  id: number;
  invoice_number: string;
  customer_name: string;
  amount: number;
  status: string;
  remaining_amount?: number;
};

const stats = ref<Stats>({ 
  outgoingToday: 0, 
  activeShipments: 0, 
  pendingInvoices: 0, 
  deliveryNotes: 0,
  totalInvoices: 0,
  outstandingCount: 0,
  outstandingAmount: 0,
  pelunasanCount: 0,
  pelunasanAmount: 0
});
const tracking = ref<Shipment[]>([]);
const dblList = ref<DBLItem[]>([]);
const recentInvoices = ref<Invoice[]>([]);
const trend = ref<{ day: string; count: number }[]>([]);
const loading = ref(true);

const shipmentChartOption = computed<EChartsCoreOption>(() => {
  const axisColor = theme.value === 'dark' ? '#cbd5e1' : '#596579';
  const gridColor = theme.value === 'dark' ? '#334155' : '#e5e7eb';
  const days = trend.value.length > 0 
    ? trend.value.map(t => new Date(t.day).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })) 
    : ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const data = trend.value.length > 0 
    ? trend.value.map(t => t.count) 
    : [0, 0, 0, 0, 0, 0, stats.value.outgoingToday || 0];
  return {
    tooltip: { trigger: 'axis', backgroundColor: theme.value === 'dark' ? '#1e293b' : '#fff', textStyle: { color: axisColor } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: days, axisLine: { lineStyle: { color: gridColor } }, axisLabel: { color: axisColor, fontSize: 13 } },
    yAxis: { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: gridColor } }, axisLabel: { color: axisColor, fontSize: 13 } },
    series: [{
      name: 'Pengiriman',
      type: 'line',
      smooth: true,
      data,
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(59, 130, 246, 0.3)' }, { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }] } },
      lineStyle: { color: '#3b82f6', width: 2 },
      itemStyle: { color: '#3b82f6' }
    }]
  } as EChartsCoreOption;
});

function getStatusColor(status: string): 'info' | 'success' | 'warning' | 'default' {
  const s = status?.toUpperCase() || '';
  if (s.includes('DELIVERED') || s.includes('COMPLETED')) return 'success';
  if (s.includes('TRANSIT') || s.includes('LOADING')) return 'info';
  if (s.includes('PENDING')) return 'warning';
  return 'default';
}

function statusLabel(status: string) {
  return ({ IN_TRANSIT: 'Dalam Perjalanan', LOADING: 'Sedang Dimuat', READY: 'Siap Berangkat', DELIVERED: 'Terkirim', COMPLETED: 'Selesai', PENDING: 'Menunggu' } as Record<string, string>)[status.toUpperCase()] || status;
}
async function loadData() {
  loading.value = true;
  error.value = '';
  trendError.value = false;
  try {
    const [statsResult, trackingResult, dblResult, invoiceResult, trendResult] = await Promise.all([
      http.get('/dashboard?endpoint=stats'),
      permissions.value.canViewPelacakan ? http.get('/dashboard?endpoint=tracking&limit=5') : Promise.resolve(null),
      permissions.value.canViewDBL ? http.get('/dbl?endpoint=list&limit=5') : Promise.resolve(null),
      permissions.value.canViewKeuangan ? http.get('/invoices?endpoint=list&limit=5') : Promise.resolve(null),
      permissions.value.canViewPelacakan ? http.get('/dashboard?endpoint=trend').catch(() => { trendError.value = true; return null; }) : Promise.resolve(null)
    ]);
    stats.value = statsResult.data;
    tracking.value = trackingResult?.data.items || [];
    dblList.value = (dblResult?.data.items || []).slice(0, 5);
    recentInvoices.value = (invoiceResult?.data.items || []).slice(0, 5);
    trend.value = trendResult?.data.items || [];
  } catch {
    error.value = 'Ringkasan belum berhasil dimuat. Silakan coba lagi.';
  } finally { loading.value = false; }
}

onMounted(async () => {
  await fetchUser();
  loadData();
});

function go(routeName: string) {
  router.push({ name: routeName });
}
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center h-64 pb-20 lg:pb-0">
    <div class="text-gray-500">Memuat ringkasan...</div>
  </div>
  
  <div v-else-if="error" role="alert" class="card p-6 space-y-4"><p>{{ error }}</p><Button @click="loadData">Coba lagi</Button></div>
  <div v-else class="space-y-6 pb-20 lg:pb-0">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold dark:text-white">Dasbor</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Selamat datang, {{ user?.name || 'User' }}
        </p>
      </div>
      <Badge :variant="user?.role === 'admin' ? 'success' : user?.role === 'accounting' ? 'info' : 'default'" class="capitalize">
        {{ user?.role || 'staff' }}
      </Badge>
    </div>

    <div class="flex flex-wrap gap-3" aria-label="Pintasan pekerjaan">
      <Button v-if="permissions.canCreateAWB" @click="router.push({ name: 'barang-keluar', query: { create: '1' } })">Buat SPB</Button>
      <Button v-if="permissions.canViewKeuangan" @click="router.push({ name: 'invoice', query: { create: '1' } })">Buat Invoice</Button>
      <Button v-if="permissions.canViewKeuangan" variant="default" @click="go('outstanding')">Cek Outstanding</Button>
      <Button v-if="permissions.canViewOperationalCost" variant="default" @click="go('operational-cost')">Biaya Operasional</Button>
    </div>
    <div class="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      <OverviewCard
        v-if="permissions.canViewSPB"
        title="SPB Dibuat Hari Ini"
        :value="stats.outgoingToday"
        icon="mdi:package-variant"
        role="button"
        tabindex="0"
        class="cursor-pointer hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
        @click="go('barang-keluar')"
        @keydown.enter="go('barang-keluar')"
        @keydown.space.prevent="go('barang-keluar')"
      />
      <OverviewCard
        v-if="permissions.canViewPelacakan"
        title="Pengiriman Aktif"
        :value="stats.activeShipments"
        icon="mdi:truck-delivery"
        role="button"
        tabindex="0"
        class="cursor-pointer hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
        @click="go('pelacakan')"
        @keydown.enter="go('pelacakan')"
        @keydown.space.prevent="go('pelacakan')"
      />
      <OverviewCard
        v-if="permissions.canViewKeuangan"
        title="Total Invoice"
        :value="stats.totalInvoices"
        icon="mdi:receipt-text-outline"
        role="button"
        tabindex="0"
        class="cursor-pointer hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
        @click="go('invoice')"
        @keydown.enter="go('invoice')"
        @keydown.space.prevent="go('invoice')"
      />
      <OverviewCard
        v-if="permissions.canViewKeuangan"
        title="Pengiriman Outstanding (90 Hari)"
        :value="stats.outstandingCount"
        icon="mdi:alert-circle-outline"
        role="button"
        tabindex="0"
        class="cursor-pointer hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
        @click="go('outstanding')"
        @keydown.enter="go('outstanding')"
        @keydown.space.prevent="go('outstanding')"
      />
      <OverviewCard
        v-if="permissions.canPelunasan"
        title="Transaksi Pelunasan"
        :value="stats.pelunasanCount"
        icon="mdi:cash-check"
        role="button"
        tabindex="0"
        class="cursor-pointer hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
        @click="go('pelunasan')"
        @keydown.enter="go('pelunasan')"
        @keydown.space.prevent="go('pelunasan')"
      />
      <OverviewCard
        v-if="permissions.canViewSuratJalan"
        title="Total Pengiriman"
        :value="stats.deliveryNotes"
        icon="mdi:file-document-outline"
        role="button"
        tabindex="0"
        class="cursor-pointer hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
        @click="go('surat-jalan')"
        @keydown.enter="go('surat-jalan')"
        @keydown.space.prevent="go('surat-jalan')"
      />
    </div>

    <div v-if="permissions.canViewKeuangan" class="grid gap-4 grid-cols-1 md:grid-cols-3">
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div class="text-sm text-gray-500 dark:text-gray-400">Outstanding - Pengiriman 90 Hari Terakhir</div>
        <div class="text-xl font-bold text-red-600">{{ formatRupiah(stats.outstandingAmount) }}</div>
        <div class="text-xs text-gray-400 mt-1">{{ stats.outstandingCount }} pengiriman dengan sisa tagihan</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div class="text-sm text-gray-500 dark:text-gray-400">Total Pelunasan - Seluruh Periode</div>
        <div class="text-xl font-bold text-green-600">{{ formatRupiah(stats.pelunasanAmount) }}</div>
        <div class="text-xs text-gray-400 mt-1">{{ stats.pelunasanCount }} transaksi</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div class="text-sm text-gray-500 dark:text-gray-400">Invoice Belum Lunas</div>
        <div class="text-xl font-bold text-orange-500">{{ stats.pendingInvoices }}</div>
        <div class="text-xs text-gray-400 mt-1">Belum lunas + cicilan - seluruh periode</div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div v-if="permissions.canViewPelacakan" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold dark:text-gray-100">Trend Pengiriman</h2>
          <span class="text-xs text-gray-500">7 hari terakhir</span>
        </div>
        <p v-if="trendError" class="py-8 text-sm" role="status">Grafik belum berhasil dimuat.</p>
        <p v-else-if="!trend.length" class="py-8 text-sm">Belum ada data pengiriman pada periode ini.</p>
        <DashboardChart v-else :option="shipmentChartOption" class="h-64" />
      </div>

      <div v-if="permissions.canViewPelacakan" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold dark:text-gray-100">Pengiriman Aktif</h2>
          <Button variant="ghost" size="sm" @click="$router.push({ name: 'pelacakan' })">
            Lihat Semua
          </Button>
        </div>
        <div v-if="tracking.length === 0" class="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
          Belum ada pengiriman aktif
        </div>
        <div v-else class="space-y-3">
          <div 
            v-for="item in tracking.slice(0, 5)" 
            :key="item.id" 
            class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
          >
            <div class="min-w-0 flex-1">
              <div class="text-sm font-semibold dark:text-gray-100 truncate">{{ item.spb_number || 'SPB belum tersedia' }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ item.public_code }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
                {{ item.origin }} → {{ item.destination }}
              </div>
            </div>
            <Badge :variant="getStatusColor(item.status)" class="text-xs ml-2 shrink-0">
              {{ statusLabel(item.status) }}
            </Badge>
          </div>
        </div>
      </div>

      <div v-if="permissions.canViewDBL" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold dark:text-gray-100">DBL Terbaru</h2>
          <Button variant="ghost" size="sm" @click="$router.push({ name: 'dbl' })">
            Lihat Semua
          </Button>
        </div>
        <div v-if="dblList.length === 0" class="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
          Belum ada DBL
        </div>
        <div v-else class="space-y-3">
          <div 
            v-for="item in dblList" 
            :key="item.id" 
            class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
          >
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium dark:text-gray-100 truncate">{{ item.dbl_number }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
                {{ item.driver_name || 'Driver' }} • {{ item.vehicle_number || '-' }}
              </div>
            </div>
            <Badge :variant="getStatusColor(item.status)" class="text-xs ml-2 shrink-0">
              {{ statusLabel(item.status) }}
            </Badge>
          </div>
        </div>
      </div>

      <div v-if="permissions.canViewKeuangan" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold dark:text-gray-100">Invoice Terbaru</h2>
          <Button variant="ghost" size="sm" @click="$router.push({ name: 'invoice' })">
            Lihat Semua
          </Button>
        </div>
        <div v-if="recentInvoices.length === 0" class="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
          Belum ada invoice
        </div>
        <div v-else class="space-y-3">
          <div 
            v-for="inv in recentInvoices" 
            :key="inv.id" 
            class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
          >
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium dark:text-gray-100 truncate"><button class="text-primary dark:text-blue-300 underline underline-offset-2 text-left" @click="router.push({ name: 'invoice', query: { q: inv.invoice_number } })">{{ inv.invoice_number }}</button></div>
              <div class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ inv.customer_name }}</div>
            </div>
            <div class="text-right ml-2 shrink-0">
              <div class="text-sm font-medium dark:text-gray-100">{{ formatRupiah(inv.amount) }}</div>
              <Badge :variant="inv.status === 'paid' ? 'success' : inv.status === 'partial' ? 'warning' : 'default'" class="text-xs">
                {{ inv.status === 'paid' ? 'Lunas' : inv.status === 'partial' ? 'Cicilan' : 'Belum Lunas' }}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
