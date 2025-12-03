<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import Button from '../components/ui/Button.vue';
import Badge from '../components/ui/Badge.vue';
import { useFormatters } from '../composables/useFormatters';
import { Icon } from '@iconify/vue';

const { formatDate, formatRupiah, toWIBDateString } = useFormatters();

type DBLReportItem = {
  id: number;
  dbl_number: string | null;
  vehicle_plate: string | null;
  driver_name: string | null;
  destination: string | null;
  status: string;
  total_shipments: number;
  total_colli: number;
  total_nominal: number;
  created_at: string;
  departure_date: string | null;
};

const items = ref<DBLReportItem[]>([]);
const loading = ref(true);
const dateFrom = ref('');
const dateTo = ref('');
const selectedStatus = ref('');
const reportType = ref<'daily' | 'monthly'>('daily');

const statusOptions = [
  { value: '', label: 'Semua Status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'LOADING', label: 'Loading' },
  { value: 'DEPARTED', label: 'Departed' },
  { value: 'ARRIVED', label: 'Arrived' }
];

const filteredItems = computed(() => {
  let result = items.value;
  if (dateFrom.value) {
    result = result.filter(i => {
      const itemDate = new Date(i.departure_date || i.created_at);
      return itemDate >= new Date(dateFrom.value);
    });
  }
  if (dateTo.value) {
    result = result.filter(i => {
      const itemDate = new Date(i.departure_date || i.created_at);
      return itemDate <= new Date(dateTo.value + 'T23:59:59');
    });
  }
  if (selectedStatus.value) {
    result = result.filter(i => i.status === selectedStatus.value);
  }
  return result;
});

const totalDBL = computed(() => filteredItems.value.length);
const totalShipments = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.total_shipments || 0), 0));
const totalColli = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.total_colli || 0), 0));
const totalNominal = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.total_nominal || 0), 0));

async function loadReport() {
  loading.value = true;
  try {
    const res = await fetch('/api/dbl?endpoint=report');
    if (res.ok) {
      const data = await res.json();
      items.value = data.items || [];
    }
  } catch (e) {
    console.error('Failed to load DBL report:', e);
  } finally {
    loading.value = false;
  }
}

function setToday() {
  const today = toWIBDateString();
  dateFrom.value = today;
  dateTo.value = today;
  reportType.value = 'daily';
}

function setThisMonth() {
  const now = new Date();
  const firstDay = toWIBDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const lastDay = toWIBDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  dateFrom.value = firstDay;
  dateTo.value = lastDay;
  reportType.value = 'monthly';
}

function resetFilters() {
  dateFrom.value = '';
  dateTo.value = '';
  selectedStatus.value = '';
}

function exportExcel() {
  const headers = ['No', 'Tanggal', 'No. DBL', 'Plat', 'Driver', 'Tujuan', 'SPB', 'Colli', 'Nominal', 'Status'];
  const rows = filteredItems.value.map((item, idx) => [
    idx + 1,
    formatDate(item.departure_date || item.created_at),
    item.dbl_number || '-',
    item.vehicle_plate || '-',
    item.driver_name || '-',
    item.destination || '-',
    item.total_shipments,
    item.total_colli,
    item.total_nominal,
    item.status
  ]);

  let csv = headers.join(',') + '\n';
  rows.forEach(row => {
    csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `dbl_report_${reportType.value}_${dateFrom.value || 'all'}.csv`;
  link.click();
}

function printReport() {
  window.print();
}

function getStatusVariant(status: string): 'default' | 'info' | 'warning' | 'success' {
  const variants: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
    DRAFT: 'default',
    LOADING: 'warning',
    DEPARTED: 'info',
    ARRIVED: 'success'
  };
  return variants[status] || 'default';
}

watch([dateFrom, dateTo], () => {
  if (dateFrom.value || dateTo.value) {
    loadReport();
  }
});

onMounted(() => {
  setToday();
  loadReport();
});
</script>

<template>
  <div class="space-y-4 pb-24 lg:pb-0">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="text-xl font-semibold dark:text-gray-100">DBL Report</div>
      <div class="flex gap-2">
        <Button variant="default" class="text-sm" @click="printReport">
          <Icon icon="mdi:printer" class="mr-1" /> Print
        </Button>
        <Button variant="primary" class="text-sm" @click="exportExcel">
          <Icon icon="mdi:download" class="mr-1" /> Export
        </Button>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4 print:hidden">
      <div class="flex gap-2 mb-4">
        <Button 
          :variant="reportType === 'daily' ? 'primary' : 'default'" 
          @click="setToday"
        >
          Daily
        </Button>
        <Button 
          :variant="reportType === 'monthly' ? 'primary' : 'default'" 
          @click="setThisMonth"
        >
          Monthly
        </Button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Dari Tanggal</label>
          <input v-model="dateFrom" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Sampai Tanggal</label>
          <input v-model="dateTo" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Status</label>
          <select v-model="selectedStatus" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
            <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>
      <div class="flex gap-2">
        <Button variant="default" @click="resetFilters">Reset</Button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div class="text-sm text-gray-500">Total DBL</div>
        <div class="text-2xl font-bold text-blue-600">{{ totalDBL }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div class="text-sm text-gray-500">Total SPB</div>
        <div class="text-2xl font-bold text-green-600">{{ totalShipments }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div class="text-sm text-gray-500">Total Colli</div>
        <div class="text-2xl font-bold text-orange-500">{{ totalColli }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div class="text-sm text-gray-500">Total Nominal</div>
        <div class="text-2xl font-bold text-purple-600">{{ formatRupiah(totalNominal) }}</div>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div v-if="loading" class="flex items-center justify-center h-32">
        <div class="text-gray-500">Loading...</div>
      </div>

      <div v-else-if="filteredItems.length === 0" class="text-center py-8 text-gray-500">
        Tidak ada data DBL untuk periode ini
      </div>

      <div v-else>
        <!-- Desktop table -->
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700 border-b">
              <tr>
                <th class="px-2 py-2 text-left">No</th>
                <th class="px-2 py-2 text-left">Tanggal</th>
                <th class="px-2 py-2 text-left">No. DBL</th>
                <th class="px-2 py-2 text-left">Plat</th>
                <th class="px-2 py-2 text-left">Driver</th>
                <th class="px-2 py-2 text-left">Tujuan</th>
                <th class="px-2 py-2 text-center">SPB</th>
                <th class="px-2 py-2 text-center">Colli</th>
                <th class="px-2 py-2 text-right">Nominal</th>
                <th class="px-2 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="(item, idx) in filteredItems" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td class="px-2 py-2">{{ idx + 1 }}</td>
                <td class="px-2 py-2">{{ formatDate(item.departure_date || item.created_at) }}</td>
                <td class="px-2 py-2 font-medium">{{ item.dbl_number || '-' }}</td>
                <td class="px-2 py-2">{{ item.vehicle_plate || '-' }}</td>
                <td class="px-2 py-2">{{ item.driver_name || '-' }}</td>
                <td class="px-2 py-2">{{ item.destination || '-' }}</td>
                <td class="px-2 py-2 text-center">{{ item.total_shipments }}</td>
                <td class="px-2 py-2 text-center">{{ item.total_colli }}</td>
                <td class="px-2 py-2 text-right">{{ formatRupiah(item.total_nominal) }}</td>
                <td class="px-2 py-2 text-center">
                  <Badge :variant="getStatusVariant(item.status)">{{ item.status }}</Badge>
                </td>
              </tr>
            </tbody>
            <tfoot class="bg-gray-100 dark:bg-gray-700 font-semibold">
              <tr>
                <td colspan="6" class="px-2 py-2 text-right">Total:</td>
                <td class="px-2 py-2 text-center">{{ totalShipments }}</td>
                <td class="px-2 py-2 text-center">{{ totalColli }}</td>
                <td class="px-2 py-2 text-right">{{ formatRupiah(totalNominal) }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Mobile cards -->
        <div class="md:hidden space-y-3">
          <div v-for="item in filteredItems" :key="item.id" class="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div class="flex justify-between items-start">
              <div class="font-medium dark:text-gray-200">{{ item.dbl_number || '-' }}</div>
              <Badge :variant="getStatusVariant(item.status)">{{ item.status }}</Badge>
            </div>
            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ formatDate(item.departure_date || item.created_at) }}</div>
            <div class="mt-2 text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <div class="font-medium">{{ item.destination || '-' }}</div>
              <div class="flex flex-wrap gap-2">
                <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">{{ item.vehicle_plate || '-' }}</span>
                <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">{{ item.driver_name || '-' }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-full bg-black text-white">{{ item.total_shipments }} SPB</span>
                <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">{{ item.total_colli }} colli</span>
                <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">{{ formatRupiah(item.total_nominal) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media print {
  .print\\:hidden {
    display: none !important;
  }
}
</style>
