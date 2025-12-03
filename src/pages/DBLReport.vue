<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import Button from '../components/ui/Button.vue';
import Badge from '../components/ui/Badge.vue';
import { useFormatters } from '../composables/useFormatters';
import { Icon } from '@iconify/vue';
import { exportToExcel } from '../lib/excelExport';
import { getCompany, type CompanyProfile } from '../lib/company';

const LOGO_URL = '/brand/logo.png';

const { formatDate, formatRupiah, toWIBDateString } = useFormatters();

type MeUser = { id: number; email: string; name: string | null; role: string };

type DBLReportItem = {
  id: number;
  dbl_number: string | null;
  vehicle_plate: string | null;
  driver_name: string | null;
  destination: string | null;
  status: string;
  total_shipments: number;
  total_colli: number;
  total_weight: number;
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
const company = ref<CompanyProfile | null>(null);
const currentUser = ref<MeUser | null>(null);

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
const totalWeight = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.total_weight || 0), 0));
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
  const exportData = filteredItems.value.map((item, idx) => ({
    no: idx + 1,
    tanggal: formatDate(item.departure_date || item.created_at),
    dbl: item.dbl_number || '-',
    plat: item.vehicle_plate || '-',
    driver: item.driver_name || '-',
    tujuan: item.destination || '-',
    spb: item.total_shipments,
    colli: item.total_colli,
    kg: item.total_weight || 0,
    nominal: item.total_nominal,
    status: item.status
  }));

  exportToExcel({
    filename: `dbl_report_${reportType.value}_${dateFrom.value || 'all'}`,
    sheetName: 'DBL Report',
    title: 'LAPORAN DBL (DAFTAR BONGKAR LOADING)',
    subtitle: dateFrom.value && dateTo.value ? `Periode: ${formatDate(dateFrom.value)} - ${formatDate(dateTo.value)}` : 'Semua Periode',
    columns: [
      { header: 'No', key: 'no', width: 5, type: 'number', align: 'center' },
      { header: 'Tanggal', key: 'tanggal', width: 12, type: 'text', align: 'center' },
      { header: 'No. DBL', key: 'dbl', width: 14, type: 'text' },
      { header: 'Plat', key: 'plat', width: 12, type: 'text' },
      { header: 'Driver', key: 'driver', width: 15, type: 'text' },
      { header: 'Tujuan', key: 'tujuan', width: 15, type: 'text' },
      { header: 'SPB', key: 'spb', width: 8, type: 'number', align: 'center' },
      { header: 'Colli', key: 'colli', width: 8, type: 'number', align: 'center' },
      { header: 'Kg', key: 'kg', width: 10, type: 'number', align: 'right' },
      { header: 'Nominal', key: 'nominal', width: 15, type: 'currency', align: 'right' },
      { header: 'Status', key: 'status', width: 12, type: 'text', align: 'center' }
    ],
    data: exportData,
    totals: {
      spb: totalShipments.value,
      colli: totalColli.value,
      kg: totalWeight.value,
      nominal: totalNominal.value
    }
  });
}

function printReport() {
  window.print();
}

function formatDateTime(): string {
  return new Date().toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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

onMounted(async () => {
  setToday();
  loadReport();
  company.value = await getCompany();
  try {
    const res = await fetch('/api/auth?endpoint=me', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      currentUser.value = data.user || data;
    }
  } catch { /* ignore */ }
});
</script>

<template>
  <div class="space-y-4 pb-24 lg:pb-0">
    <div class="flex items-center justify-between flex-wrap gap-3 print:hidden">
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

    <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 print:hidden">
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <div class="text-xs text-gray-500 dark:text-gray-400">Total DBL</div>
        <div class="text-xl font-bold text-blue-600">{{ totalDBL }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <div class="text-xs text-gray-500 dark:text-gray-400">Total SPB</div>
        <div class="text-xl font-bold text-green-600">{{ totalShipments }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <div class="text-xs text-gray-500 dark:text-gray-400">Total Colli</div>
        <div class="text-xl font-bold text-orange-500">{{ totalColli }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <div class="text-xs text-gray-500 dark:text-gray-400">Total Kg</div>
        <div class="text-xl font-bold text-amber-600">{{ totalWeight.toFixed(1) }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 col-span-2 sm:col-span-1">
        <div class="text-xs text-gray-500 dark:text-gray-400">Total Nominal</div>
        <div class="text-xl font-bold text-purple-600">{{ formatRupiah(totalNominal) }}</div>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 print:hidden">
      <div v-if="loading" class="flex items-center justify-center h-32">
        <div class="text-gray-500">Loading...</div>
      </div>

      <div v-else-if="filteredItems.length === 0" class="text-center py-8 text-gray-500">
        Tidak ada data DBL untuk periode ini
      </div>

      <div v-else>
        <!-- Desktop table -->
        <div class="hidden lg:block overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              <tr>
                <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">No</th>
                <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Tanggal</th>
                <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">No. DBL</th>
                <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Plat</th>
                <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Driver</th>
                <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Tujuan</th>
                <th class="px-2 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300">SPB</th>
                <th class="px-2 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300">Colli</th>
                <th class="px-2 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Kg</th>
                <th class="px-2 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Nominal</th>
                <th class="px-2 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="(item, idx) in filteredItems" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ idx + 1 }}</td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ formatDate(item.departure_date || item.created_at) }}</td>
                <td class="px-2 py-2 font-medium text-gray-900 dark:text-gray-100">{{ item.dbl_number || '-' }}</td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ item.vehicle_plate || '-' }}</td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ item.driver_name || '-' }}</td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ item.destination || '-' }}</td>
                <td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{{ item.total_shipments }}</td>
                <td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{{ item.total_colli }}</td>
                <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">{{ (item.total_weight || 0).toFixed(1) }}</td>
                <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">{{ formatRupiah(item.total_nominal) }}</td>
                <td class="px-2 py-2 text-center">
                  <Badge :variant="getStatusVariant(item.status)">{{ item.status }}</Badge>
                </td>
              </tr>
            </tbody>
            <tfoot class="bg-gray-100 dark:bg-gray-700 font-semibold">
              <tr>
                <td colspan="6" class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">Total:</td>
                <td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{{ totalShipments }}</td>
                <td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{{ totalColli }}</td>
                <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">{{ totalWeight.toFixed(1) }}</td>
                <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">{{ formatRupiah(totalNominal) }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Mobile cards -->
        <div class="lg:hidden space-y-3">
          <div v-for="item in filteredItems" :key="item.id" class="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
            <div class="flex justify-between items-start gap-2">
              <div class="min-w-0 flex-1">
                <div class="font-medium text-sm text-gray-900 dark:text-gray-100">{{ item.dbl_number || '-' }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ formatDate(item.departure_date || item.created_at) }}</div>
              </div>
              <Badge :variant="getStatusVariant(item.status)">{{ item.status }}</Badge>
            </div>
            <div class="mt-2 text-xs text-gray-600 dark:text-gray-400">
              <div class="font-medium">{{ item.destination || '-' }}</div>
              <div class="flex flex-wrap gap-2 mt-1">
                <span class="text-gray-500">{{ item.vehicle_plate || '-' }}</span>
                <span class="text-gray-500">{{ item.driver_name || '-' }}</span>
              </div>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <span class="px-2 py-0.5 rounded-full bg-gray-900 dark:bg-gray-600 text-white text-xs">{{ item.total_shipments }} SPB</span>
              <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs">{{ item.total_colli }} colli</span>
              <span class="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 text-xs">{{ (item.total_weight || 0).toFixed(1) }} kg</span>
              <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs">{{ formatRupiah(item.total_nominal) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Print View -->
    <div class="hidden print:block">
      <div class="print-header">
        <div class="print-brand">
          <img :src="LOGO_URL" alt="Logo" class="print-logo" />
          <div class="print-brand-info">
            <div class="print-company">{{ company?.name || 'SUMBER TRANS EXPRESS' }}</div>
            <div class="print-address">{{ company?.address || '' }}</div>
            <div class="print-contact">
              <span v-if="company?.phone">Telp: {{ company.phone }}</span>
              <span v-if="company?.email"> | Email: {{ company.email }}</span>
            </div>
          </div>
        </div>
        <div class="print-title">LAPORAN DBL (DAFTAR BONGKAR LOADING)</div>
        <div class="print-subtitle">{{ dateFrom && dateTo ? `Periode: ${formatDate(dateFrom)} - ${formatDate(dateTo)}` : 'Semua Periode' }}</div>
      </div>
      <table class="print-table">
        <thead>
          <tr>
            <th class="text-center" style="width: 4%">No</th>
            <th class="text-center" style="width: 10%">Tanggal</th>
            <th style="width: 12%">No. DBL</th>
            <th style="width: 10%">Plat</th>
            <th style="width: 12%">Driver</th>
            <th style="width: 12%">Tujuan</th>
            <th class="text-center" style="width: 6%">SPB</th>
            <th class="text-center" style="width: 6%">Colli</th>
            <th class="text-right" style="width: 8%">Kg</th>
            <th class="text-right" style="width: 12%">Nominal</th>
            <th class="text-center" style="width: 8%">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in filteredItems" :key="item.id">
            <td class="text-center">{{ idx + 1 }}</td>
            <td class="text-center">{{ formatDate(item.departure_date || item.created_at) }}</td>
            <td>{{ item.dbl_number || '-' }}</td>
            <td>{{ item.vehicle_plate || '-' }}</td>
            <td>{{ item.driver_name || '-' }}</td>
            <td>{{ item.destination || '-' }}</td>
            <td class="text-center">{{ item.total_shipments }}</td>
            <td class="text-center">{{ item.total_colli }}</td>
            <td class="text-right">{{ (item.total_weight || 0).toFixed(1) }}</td>
            <td class="text-right">{{ formatRupiah(item.total_nominal) }}</td>
            <td class="text-center">{{ item.status }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="6" class="text-right">Total:</td>
            <td class="text-center">{{ totalShipments }}</td>
            <td class="text-center">{{ totalColli }}</td>
            <td class="text-right">{{ totalWeight.toFixed(1) }}</td>
            <td class="text-right">{{ formatRupiah(totalNominal) }}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <div class="print-footer">
        <div class="print-date">Dicetak: {{ formatDateTime(new Date()) }} | Oleh: {{ currentUser?.name || currentUser?.email || '-' }}</div>
        <div class="print-summary">Total DBL: {{ totalDBL }} | Total SPB: {{ totalShipments }} | Total Colli: {{ totalColli }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media print {
  @page {
    size: A4 landscape;
    margin: 10mm;
  }

  .print\\:hidden {
    display: none !important;
  }

  .print\\:block {
    display: block !important;
  }

  .print-header {
    text-align: center;
    margin-bottom: 20px;
    border-bottom: 2px solid #1e3a5f;
    padding-bottom: 15px;
  }

  .print-company {
    font-size: 18px;
    font-weight: bold;
    color: #1e3a5f;
    letter-spacing: 1px;
  }

  .print-brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
    margin-bottom: 10px;
  }

  .print-logo {
    width: 60px;
    height: 60px;
    object-fit: contain;
  }

  .print-brand-info {
    text-align: left;
  }

  .print-address {
    font-size: 11px;
    color: #333;
    margin-top: 2px;
  }

  .print-contact {
    font-size: 10px;
    color: #666;
    margin-top: 2px;
  }

  .print-title {
    font-size: 16px;
    font-weight: bold;
    color: #333;
    margin-top: 8px;
  }

  .print-subtitle {
    font-size: 12px;
    color: #666;
    margin-top: 4px;
  }

  .print-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
  }

  .print-table th {
    background-color: #1e3a5f !important;
    color: white !important;
    padding: 8px 4px;
    border: 1px solid #1e3a5f;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 8px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .print-table td {
    padding: 5px 4px;
    border: 1px solid #ddd;
    font-size: 9px;
  }

  .print-table tbody tr:nth-child(even) {
    background-color: #f9f9f9 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .print-table tfoot .total-row {
    background-color: #e8f4fd !important;
    font-weight: bold;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .print-table tfoot .total-row td {
    border-top: 2px solid #1e3a5f;
    padding: 8px 4px;
  }

  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .text-left { text-align: left; }

  .print-footer {
    margin-top: 20px;
    padding-top: 10px;
    border-top: 1px solid #ddd;
    font-size: 10px;
    color: #666;
    display: flex;
    justify-content: space-between;
  }

  .print-date {
    font-style: italic;
  }

  .print-summary {
    font-weight: 500;
  }
}
</style>
