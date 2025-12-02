<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Button from '../components/ui/Button.vue';
import Badge from '../components/ui/Badge.vue';
import { useFormatters } from '../composables/useFormatters';
import { Icon } from '@iconify/vue';

const { formatDate, formatRupiah } = useFormatters();

type ShipmentReport = {
  id: number;
  spb_number: string | null;
  public_code: string | null;
  customer_name: string | null;
  pengirim_name: string | null;
  penerima_name: string | null;
  origin: string;
  destination: string;
  total_colli: number;
  nominal: number;
  service_type: string | null;
  jenis: string | null;
  status: string;
  created_at: string;
};

const items = ref<ShipmentReport[]>([]);
const loading = ref(true);
const dateFrom = ref('');
const dateTo = ref('');
const selectedStatus = ref('');
const selectedServiceType = ref('');
const selectedJenis = ref('');

const statusOptions = [
  { value: '', label: 'Semua Status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'READY', label: 'Ready' },
  { value: 'LOADING', label: 'Loading' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'DELIVERED', label: 'Delivered' }
];

const serviceTypes = [
  { value: '', label: 'Semua Layanan' },
  { value: 'REG', label: 'REG' },
  { value: 'CARGO', label: 'CARGO' }
];

const jenisOptions = [
  { value: '', label: 'Semua Jenis' },
  { value: 'FRANCO', label: 'FRANCO' },
  { value: 'TJ', label: 'TJ' },
  { value: 'LPT', label: 'LPT' },
  { value: 'LJ', label: 'LJ' },
  { value: 'LB', label: 'LB' }
];

const filteredItems = computed(() => {
  let result = items.value;
  if (dateFrom.value) {
    result = result.filter(i => new Date(i.created_at) >= new Date(dateFrom.value));
  }
  if (dateTo.value) {
    result = result.filter(i => new Date(i.created_at) <= new Date(dateTo.value + 'T23:59:59'));
  }
  if (selectedStatus.value) {
    result = result.filter(i => i.status === selectedStatus.value);
  }
  if (selectedServiceType.value) {
    result = result.filter(i => i.service_type === selectedServiceType.value);
  }
  if (selectedJenis.value) {
    result = result.filter(i => i.jenis === selectedJenis.value);
  }
  return result;
});

const totalNominal = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.nominal || 0), 0));
const totalColli = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.total_colli || 0), 0));

async function loadReport() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ endpoint: 'list', limit: '1000' });
    const res = await fetch(`/api/shipments?${params}`);
    if (res.ok) {
      const data = await res.json();
      items.value = data.items || [];
    }
  } catch (e) {
    console.error('Failed to load report:', e);
  } finally {
    loading.value = false;
  }
}

function setToday() {
  const today = new Date().toISOString().slice(0, 10);
  dateFrom.value = today;
  dateTo.value = today;
}

function setThisMonth() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  dateFrom.value = firstDay;
  dateTo.value = lastDay;
}

function resetFilters() {
  dateFrom.value = '';
  dateTo.value = '';
  selectedStatus.value = '';
  selectedServiceType.value = '';
  selectedJenis.value = '';
}

function exportExcel() {
  const headers = ['No', 'Tanggal', 'Kode', 'SPB', 'Customer', 'Pengirim', 'Penerima', 'Rute', 'Colli', 'Nominal', 'Layanan', 'Jenis', 'Status'];
  const rows = filteredItems.value.map((item, idx) => [
    idx + 1,
    formatDate(item.created_at),
    item.public_code || '-',
    item.spb_number || '-',
    item.customer_name || '-',
    item.pengirim_name || '-',
    item.penerima_name || '-',
    `${item.origin} → ${item.destination}`,
    item.total_colli,
    item.nominal,
    item.service_type || '-',
    item.jenis || '-',
    item.status
  ]);

  let csv = headers.join(',') + '\n';
  rows.forEach(row => {
    csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `daily_report_${dateFrom.value || 'all'}_${dateTo.value || 'all'}.csv`;
  link.click();
}

function printReport() {
  window.print();
}

function getStatusVariant(status: string): 'default' | 'info' | 'warning' | 'success' {
  const variants: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
    DRAFT: 'default',
    READY: 'info',
    LOADING: 'warning',
    IN_TRANSIT: 'info',
    DELIVERED: 'success'
  };
  return variants[status] || 'default';
}

onMounted(() => {
  setToday();
  loadReport();
});
</script>

<template>
  <div class="space-y-4 pb-20 lg:pb-0">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="text-xl font-semibold dark:text-gray-100">Daily Report (SPB)</div>
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
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
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
        <div>
          <label class="block text-sm font-medium mb-1">Layanan</label>
          <select v-model="selectedServiceType" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
            <option v-for="opt in serviceTypes" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Jenis</label>
          <select v-model="selectedJenis" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
            <option v-for="opt in jenisOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="default" @click="setToday">Hari Ini</Button>
        <Button variant="default" @click="setThisMonth">Bulan Ini</Button>
        <Button variant="default" @click="resetFilters">Reset</Button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div class="text-sm text-gray-500">Total SPB</div>
        <div class="text-2xl font-bold text-blue-600">{{ filteredItems.length }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div class="text-sm text-gray-500">Total Colli</div>
        <div class="text-2xl font-bold text-green-600">{{ totalColli }}</div>
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
        Tidak ada data untuk periode ini
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-gray-700 border-b">
            <tr>
              <th class="px-2 py-2 text-left">No</th>
              <th class="px-2 py-2 text-left">Tanggal</th>
              <th class="px-2 py-2 text-left">Kode</th>
              <th class="px-2 py-2 text-left">Customer</th>
              <th class="px-2 py-2 text-left">Rute</th>
              <th class="px-2 py-2 text-center">Colli</th>
              <th class="px-2 py-2 text-right">Nominal</th>
              <th class="px-2 py-2 text-center">Jenis</th>
              <th class="px-2 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-for="(item, idx) in filteredItems" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="px-2 py-2">{{ idx + 1 }}</td>
              <td class="px-2 py-2">{{ formatDate(item.created_at) }}</td>
              <td class="px-2 py-2 font-medium">{{ item.public_code || '-' }}</td>
              <td class="px-2 py-2">{{ item.customer_name || '-' }}</td>
              <td class="px-2 py-2">{{ item.origin }} → {{ item.destination }}</td>
              <td class="px-2 py-2 text-center">{{ item.total_colli }}</td>
              <td class="px-2 py-2 text-right">{{ formatRupiah(item.nominal) }}</td>
              <td class="px-2 py-2 text-center">{{ item.jenis || '-' }}</td>
              <td class="px-2 py-2 text-center">
                <Badge :variant="getStatusVariant(item.status)">{{ item.status }}</Badge>
              </td>
            </tr>
          </tbody>
          <tfoot class="bg-gray-100 dark:bg-gray-700 font-semibold">
            <tr>
              <td colspan="5" class="px-2 py-2 text-right">Total:</td>
              <td class="px-2 py-2 text-center">{{ totalColli }}</td>
              <td class="px-2 py-2 text-right">{{ formatRupiah(totalNominal) }}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
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
