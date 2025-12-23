<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import Button from '../components/ui/Button.vue';
import { useFormatters } from '../composables/useFormatters';
import { useAuth } from '../composables/useAuth';
import { Icon } from '@iconify/vue';
import { exportToExcel } from '../lib/excelExport';
import { getCompany, type CompanyProfile, LOGO_URL } from '../lib/company';

type MeUser = { id: number; email: string; name?: string; role?: string };

const { formatRupiah, toWIBDateString } = useFormatters();
const { fetchUser } = useAuth();

const company = ref<CompanyProfile | null>(null);
const currentUser = ref<MeUser | null>(null);

type SalesItem = {
  customer_id: number;
  customer_name: string;
  total_shipments: number;
  total_colli: number;
  total_weight: number;
  total_nominal: number;
  total_paid: number;
  total_outstanding: number;
  destination?: string;
};

const items = ref<SalesItem[]>([]);
const loading = ref(true);
const dateFrom = ref('');
const dateTo = ref('');
const searchQuery = ref('');
const selectedRegion = ref('');

const regionOptions = [
  { value: '', label: 'Semua Wilayah' },
  { value: 'BALI', label: 'Bali' },
  { value: 'KALIMANTAN', label: 'Kalimantan' },
  { value: 'SUMATERA', label: 'Sumatera' },
  { value: 'SULAWESI', label: 'Sulawesi' },
  { value: 'PAPUA', label: 'Papua' },
  { value: 'JATENG', label: 'Jawa Tengah' },
  { value: 'JATIM', label: 'Jawa Timur' },
  { value: 'SUMBAWA', label: 'Sumbawa' },
  { value: 'LOMBOK', label: 'Lombok' },
  { value: 'NTT', label: 'NTT' },
  { value: 'MALUKU', label: 'Maluku' }
];

function getRegionFromDestination(destination: string): string {
  if (!destination) return '';
  const d = destination.toUpperCase();
  const baliCities = ['DENPASAR', 'BADUNG', 'GIANYAR', 'TABANAN', 'BULELENG', 'KARANGASEM', 'KLUNGKUNG', 'BANGLI', 'JEMBRANA', 'SINGARAJA', 'UBUD', 'KUTA', 'SANUR', 'NUSA DUA', 'SEMINYAK', 'BALI'];
  const kalimantanCities = ['BALIKPAPAN', 'SAMARINDA', 'BANJARMASIN', 'PONTIANAK', 'PALANGKARAYA', 'TARAKAN', 'BONTANG', 'TENGGARONG', 'KUTAI', 'BERAU', 'KALIMANTAN'];
  const sumateraCities = ['MEDAN', 'PALEMBANG', 'PEKANBARU', 'PADANG', 'LAMPUNG', 'JAMBI', 'BENGKULU', 'BANDA ACEH', 'BATAM', 'BINTAN', 'TANJUNG PINANG', 'SUMATERA', 'SUMATRA'];
  const sulawesiCities = ['MAKASSAR', 'MANADO', 'KENDARI', 'PALU', 'GORONTALO', 'MAMUJU', 'BONE', 'PARE-PARE', 'PAREPARE', 'BULUKUMBA', 'SULAWESI'];
  const papuaCities = ['JAYAPURA', 'SORONG', 'MERAUKE', 'TIMIKA', 'BIAK', 'NABIRE', 'MANOKWARI', 'WAMENA', 'PAPUA'];
  const jatengCities = ['SEMARANG', 'SOLO', 'SURAKARTA', 'MAGELANG', 'PEKALONGAN', 'TEGAL', 'PURWOKERTO', 'CILACAP', 'KUDUS', 'JEPARA', 'DEMAK', 'KLATEN', 'BOYOLALI', 'SALATIGA', 'JAWA TENGAH'];
  const jatimCities = ['SURABAYA', 'MALANG', 'SIDOARJO', 'GRESIK', 'KEDIRI', 'MOJOKERTO', 'PASURUAN', 'PROBOLINGGO', 'LUMAJANG', 'JEMBER', 'BANYUWANGI', 'SITUBONDO', 'BONDOWOSO', 'BLITAR', 'TULUNGAGUNG', 'TRENGGALEK', 'NGANJUK', 'MADIUN', 'PONOROGO', 'PACITAN', 'LAMONGAN', 'TUBAN', 'BOJONEGORO', 'NGAWI', 'MAGETAN', 'JAWA TIMUR'];
  const sumbawaCities = ['SUMBAWA', 'BIMA', 'DOMPU', 'SUMBAWA BESAR'];
  const lombokCities = ['MATARAM', 'LOMBOK', 'PRAYA', 'SELONG', 'SENGGIGI', 'GILI'];
  const nttCities = ['KUPANG', 'LABUAN BAJO', 'ENDE', 'MAUMERE', 'RUTENG', 'BAJAWA', 'WAINGAPU', 'WAIKABUBAK', 'ATAMBUA', 'KEFAMENANU', 'FLORES', 'SUMBA', 'TIMOR', 'ALOR', 'LEMBATA', 'SIKKA', 'MANGGARAI', 'NAGEKEO', 'NGADA', 'ROTE', 'SABU', 'NTT'];
  const malukuCities = ['AMBON', 'TERNATE', 'TIDORE', 'TUAL', 'HALMAHERA', 'MALUKU'];

  if (baliCities.some(c => d.includes(c))) return 'BALI';
  if (kalimantanCities.some(c => d.includes(c))) return 'KALIMANTAN';
  if (sumateraCities.some(c => d.includes(c))) return 'SUMATERA';
  if (sulawesiCities.some(c => d.includes(c))) return 'SULAWESI';
  if (papuaCities.some(c => d.includes(c))) return 'PAPUA';
  if (jatengCities.some(c => d.includes(c))) return 'JATENG';
  if (jatimCities.some(c => d.includes(c))) return 'JATIM';
  if (sumbawaCities.some(c => d.includes(c))) return 'SUMBAWA';
  if (lombokCities.some(c => d.includes(c))) return 'LOMBOK';
  if (nttCities.some(c => d.includes(c))) return 'NTT';
  if (malukuCities.some(c => d.includes(c))) return 'MALUKU';
  return '';
}

function normalizeSearch(input: string): string {
  return String(input || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const filteredItems = computed(() => {
  let result = items.value;
  const q = normalizeSearch(searchQuery.value);
  if (q) {
    result = result.filter(i => normalizeSearch(i.customer_name || '').includes(q));
  }
  if (selectedRegion.value) {
    result = result.filter(i => getRegionFromDestination(i.destination || '') === selectedRegion.value);
  }
  return result;
});

const totalShipments = computed(() => filteredItems.value.reduce((sum, i) => sum + (Number(i.total_shipments) || 0), 0));
const totalColli = computed(() => filteredItems.value.reduce((sum, i) => sum + (Number(i.total_colli) || 0), 0));
const totalWeight = computed(() => filteredItems.value.reduce((sum, i) => sum + (Number(i.total_weight) || 0), 0));
const totalNominal = computed(() => filteredItems.value.reduce((sum, i) => sum + (Number(i.total_nominal) || 0), 0));
const totalPaid = computed(() => filteredItems.value.reduce((sum, i) => sum + (Number(i.total_paid) || 0), 0));
const totalOutstanding = computed(() => filteredItems.value.reduce((sum, i) => sum + (Number(i.total_outstanding) || 0), 0));

function formatDateTime(date: Date): string {
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) +
    ' ' + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

async function loadReport() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ endpoint: 'sales-report' });
    if (dateFrom.value) params.set('from', dateFrom.value);
    if (dateTo.value) params.set('to', dateTo.value);
    const res = await fetch(`/api/invoices?${params}`);
    if (res.ok) {
      const data = await res.json();
      items.value = data.items || [];
    }
  } catch (e) {
    console.error('Failed to load sales report:', e);
  } finally {
    loading.value = false;
  }
}

function setThisMonth() {
  const now = new Date();
  const firstDay = toWIBDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const lastDay = toWIBDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  dateFrom.value = firstDay;
  dateTo.value = lastDay;
  loadReport();
}

function setLastMonth() {
  const now = new Date();
  const firstDay = toWIBDateString(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const lastDay = toWIBDateString(new Date(now.getFullYear(), now.getMonth(), 0));
  dateFrom.value = firstDay;
  dateTo.value = lastDay;
  loadReport();
}

function resetFilters() {
  dateFrom.value = '';
  dateTo.value = '';
  searchQuery.value = '';
  selectedRegion.value = '';
  loadReport();
}

function exportExcel() {
  const exportData = filteredItems.value.map((item, idx) => ({
    no: idx + 1,
    customer: item.customer_name || '-',
    spb: item.total_shipments,
    colli: item.total_colli,
    berat: item.total_weight || 0,
    total: item.total_nominal,
    lunas: item.total_paid,
    outstanding: item.total_outstanding
  }));

  exportToExcel({
    filename: buildFilename('sales'),
    sheetName: 'Sales Report',
    title: 'LAPORAN PENJUALAN',
    subtitle: dateFrom.value && dateTo.value ? `Periode: ${dateFrom.value} - ${dateTo.value}` : 'Semua Periode',
    columns: [
      { header: 'No', key: 'no', width: 5, type: 'number', align: 'center' },
      { header: 'Customer', key: 'customer', width: 25, type: 'text' },
      { header: 'SPB', key: 'spb', width: 8, type: 'number', align: 'center' },
      { header: 'Colli', key: 'colli', width: 8, type: 'number', align: 'center' },
      { header: 'Berat', key: 'berat', width: 10, type: 'number', align: 'right' },
      { header: 'Total', key: 'total', width: 15, type: 'currency', align: 'right' },
      { header: 'Lunas', key: 'lunas', width: 15, type: 'currency', align: 'right' },
      { header: 'Outstanding', key: 'outstanding', width: 15, type: 'currency', align: 'right' }
    ],
    data: exportData,
    totals: {
      spb: totalShipments.value,
      colli: totalColli.value,
      berat: totalWeight.value,
      total: totalNominal.value,
      lunas: totalPaid.value,
      outstanding: totalOutstanding.value
    }
  });
}

function printReport() {
  const prev = document.title;
  document.title = buildFilename('sales');
  try {
    window.print();
  } finally {
    document.title = prev;
  }
}

function makeSlug(input = ''): string {
  return (input || '').toString().trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
}

function buildFilename(prefix = 'sales'): string {
  const regionPart = selectedRegion.value ? makeSlug(regionOptions.find(r => r.value === selectedRegion.value)?.label || selectedRegion.value) : 'all';
  const searchPart = searchQuery.value ? makeSlug(searchQuery.value) : '';
  const datePart = `${dateFrom.value || 'all'}_${dateTo.value || 'all'}`;
  const parts = [prefix, regionPart, searchPart, datePart].filter(Boolean);
  return parts.join('-');
}

watch([dateFrom, dateTo], () => {
  if (dateFrom.value || dateTo.value) {
    loadReport();
  }
});

onMounted(async () => {
  setThisMonth();
  fetchUser();
  try {
    company.value = await getCompany();
  } catch (e) {
    console.error('Failed to load company:', e);
  }
  try {
    const meRes = await fetch('/api/auth?endpoint=me', { credentials: 'include' });
    if (meRes.ok) {
      const data = await meRes.json();
      currentUser.value = data.user || data;
    }
  } catch (e) {
    console.error('Failed to load user:', e);
  }
});
</script>

<template>
  <div class="space-y-4 pb-20 lg:pb-0">
    <div class="flex items-center justify-between flex-wrap gap-3 print:hidden">
      <div class="text-xl font-semibold dark:text-gray-100">Sales Report</div>
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
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Cari Customer</label>
          <input
            v-model="searchQuery"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Nama customer..."
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Dari Tanggal</label>
          <input v-model="dateFrom" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Sampai Tanggal</label>
          <input v-model="dateTo" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Wilayah</label>
          <select v-model="selectedRegion" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
            <option v-for="opt in regionOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="default" @click="setThisMonth">Bulan Ini</Button>
        <Button variant="default" @click="setLastMonth">Bulan Lalu</Button>
        <Button variant="primary" @click="loadReport">Terapkan</Button>
        <Button variant="default" @click="resetFilters">Reset</Button>
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:hidden">
      <div class="min-w-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <div class="text-xs text-gray-500 dark:text-gray-400">Customer</div>
        <div class="font-bold text-blue-600 whitespace-nowrap leading-tight tracking-tight text-[clamp(0.9rem,1.6vw,1.25rem)]">
          {{ filteredItems.length }}
        </div>
      </div>
      <div class="min-w-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <div class="text-xs text-gray-500 dark:text-gray-400">Total SPB</div>
        <div class="font-bold text-green-600 whitespace-nowrap leading-tight tracking-tight text-[clamp(0.9rem,1.6vw,1.25rem)]">
          {{ totalShipments }}
        </div>
      </div>
      <div class="min-w-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <div class="text-xs text-gray-500 dark:text-gray-400">Total Colli</div>
        <div class="font-bold text-orange-500 whitespace-nowrap leading-tight tracking-tight text-[clamp(0.9rem,1.6vw,1.25rem)]">
          {{ totalColli }}
        </div>
      </div>
      <div class="min-w-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <div class="text-xs text-gray-500 dark:text-gray-400">Total Berat</div>
        <div class="font-bold text-amber-600 whitespace-nowrap leading-tight tracking-tight text-[clamp(0.9rem,1.6vw,1.25rem)]">
          {{ totalWeight.toFixed(1) }}
        </div>
      </div>
      <div class="min-w-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <div class="text-xs text-gray-500 dark:text-gray-400">Total Sales</div>
        <div class="font-bold text-purple-600 whitespace-nowrap leading-tight tracking-tight text-[clamp(0.85rem,1.4vw,1.25rem)]">
          {{ formatRupiah(totalNominal) }}
        </div>
      </div>
      <div class="min-w-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <div class="text-xs text-gray-500 dark:text-gray-400">Outstanding</div>
        <div class="font-bold text-red-600 whitespace-nowrap leading-tight tracking-tight text-[clamp(0.85rem,1.4vw,1.25rem)]">
          {{ formatRupiah(totalOutstanding) }}
        </div>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 print:hidden">
      <div v-if="loading" class="flex items-center justify-center h-32">
        <div class="text-gray-500">Loading...</div>
      </div>

      <div v-else-if="filteredItems.length === 0" class="text-center py-8 text-gray-500">
        Tidak ada data untuk periode ini
      </div>

      <!-- Desktop table -->
      <div v-else-if="true" class="hidden lg:block overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
            <tr>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">No</th>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Customer</th>
              <th class="px-2 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300">SPB</th>
              <th class="px-2 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300">Colli</th>
              <th class="px-2 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Berat</th>
              <th class="px-2 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Total</th>
              <th class="px-2 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Lunas</th>
              <th class="px-2 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Outstanding</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-for="(item, idx) in filteredItems" :key="item.customer_id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ idx + 1 }}</td>
              <td class="px-2 py-2 font-medium text-gray-900 dark:text-gray-100">{{ item.customer_name || '-' }}</td>
              <td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{{ item.total_shipments }}</td>
              <td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{{ item.total_colli }}</td>
              <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">{{ (item.total_weight || 0).toFixed(1) }}</td>
              <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">{{ formatRupiah(item.total_nominal) }}</td>
              <td class="px-2 py-2 text-right text-green-600">{{ formatRupiah(item.total_paid) }}</td>
              <td class="px-2 py-2 text-right text-red-600">{{ formatRupiah(item.total_outstanding) }}</td>
            </tr>
          </tbody>
          <tfoot class="bg-gray-100 dark:bg-gray-700 font-semibold">
            <tr>
              <td colspan="2" class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">Total:</td>
              <td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{{ totalShipments }}</td>
              <td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{{ totalColli }}</td>
              <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">{{ totalWeight.toFixed(1) }}</td>
              <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">{{ formatRupiah(totalNominal) }}</td>
              <td class="px-2 py-2 text-right text-green-600">{{ formatRupiah(totalPaid) }}</td>
              <td class="px-2 py-2 text-right text-red-600">{{ formatRupiah(totalOutstanding) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Mobile cards -->
      <div v-else class="lg:hidden space-y-3">
        <div v-for="(item, idx) in filteredItems" :key="item.customer_id" class="border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-white dark:bg-gray-800">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <div class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ item.customer_name || '-' }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">No: {{ idx + 1 }}</div>
            </div>
          </div>
          <div class="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div class="flex items-center gap-1"><span class="text-gray-500">SPB</span><span class="font-medium text-gray-700 dark:text-gray-300">{{ item.total_shipments }}</span></div>
            <div class="flex items-center gap-1"><span class="text-gray-500">Colli</span><span class="font-medium text-gray-700 dark:text-gray-300">{{ item.total_colli }}</span></div>
            <div class="flex items-center gap-1"><span class="text-gray-500">Berat</span><span class="font-medium text-gray-700 dark:text-gray-300">{{ (item.total_weight || 0).toFixed(1) }}</span></div>
            <div class="flex items-center gap-1"><span class="text-gray-500">Total</span><span class="font-semibold text-gray-700 dark:text-gray-300">{{ formatRupiah(item.total_nominal) }}</span></div>
            <div class="flex items-center gap-1"><span class="text-gray-500">Lunas</span><span class="font-semibold text-green-600">{{ formatRupiah(item.total_paid) }}</span></div>
            <div class="flex items-center gap-1"><span class="text-gray-500">Outstanding</span><span class="font-semibold text-red-600">{{ formatRupiah(item.total_outstanding) }}</span></div>
          </div>
        </div>
        <div class="border-t border-gray-200 dark:border-gray-700 pt-3 text-sm font-semibold flex justify-between">
          <span class="text-gray-700 dark:text-gray-300">Total</span>
          <span class="text-gray-700 dark:text-gray-300">{{ formatRupiah(totalNominal) }}</span>
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
        <div class="print-title">LAPORAN PENJUALAN</div>
        <div class="print-subtitle">{{ dateFrom && dateTo ? `Periode: ${dateFrom} - ${dateTo}` : 'Semua Periode' }}{{ selectedRegion ? ` | Wilayah: ${regionOptions.find(r => r.value === selectedRegion)?.label || selectedRegion}` : '' }}</div>
      </div>
      <table class="print-table">
        <thead>
          <tr>
            <th class="text-center" style="width: 5%">No</th>
            <th style="width: 22%">Customer</th>
            <th class="text-center" style="width: 8%">SPB</th>
            <th class="text-center" style="width: 8%">Colli</th>
            <th class="text-right" style="width: 10%">Berat</th>
            <th class="text-right" style="width: 15%">Total</th>
            <th class="text-right" style="width: 15%">Lunas</th>
            <th class="text-right" style="width: 15%">Outstanding</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in filteredItems" :key="item.customer_id">
            <td class="text-center">{{ idx + 1 }}</td>
            <td>{{ item.customer_name || '-' }}</td>
            <td class="text-center">{{ item.total_shipments }}</td>
            <td class="text-center">{{ item.total_colli }}</td>
            <td class="text-right">{{ (item.total_weight || 0).toFixed(1) }}</td>
            <td class="text-right">{{ formatRupiah(item.total_nominal) }}</td>
            <td class="text-right text-green">{{ formatRupiah(item.total_paid) }}</td>
            <td class="text-right text-red">{{ formatRupiah(item.total_outstanding) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="2" class="text-right">Total:</td>
            <td class="text-center">{{ totalShipments }}</td>
            <td class="text-center">{{ totalColli }}</td>
            <td class="text-right">{{ totalWeight.toFixed(1) }}</td>
            <td class="text-right">{{ formatRupiah(totalNominal) }}</td>
            <td class="text-right text-green">{{ formatRupiah(totalPaid) }}</td>
            <td class="text-right text-red">{{ formatRupiah(totalOutstanding) }}</td>
          </tr>
        </tfoot>
      </table>
      <div class="print-footer">
        <div class="print-date">Dicetak: {{ formatDateTime(new Date()) }} | Oleh: {{ currentUser?.name || currentUser?.email || '-' }}</div>
        <div class="print-summary">Total Customer: {{ filteredItems.length }} | Total SPB: {{ totalShipments }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media print {
  @page {
    size: A4 portrait;
    margin: 15mm;
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

  .print-company {
    font-size: 18px;
    font-weight: bold;
    color: #1e3a5f;
    letter-spacing: 1px;
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
    font-size: 10px;
  }

  .print-table th {
    background-color: #1e3a5f !important;
    color: white !important;
    padding: 8px 6px;
    border: 1px solid #1e3a5f;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 9px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .print-table td {
    padding: 6px;
    border: 1px solid #ddd;
    font-size: 10px;
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
    padding: 8px 6px;
  }

  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .text-left { text-align: left; }
  .text-green { color: #16a34a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .text-red { color: #dc2626 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

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
