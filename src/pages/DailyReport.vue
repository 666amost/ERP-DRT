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
  berat: number;
  satuan: string | null;
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
const selectedRegion = ref('');
const company = ref<CompanyProfile | null>(null);
const currentUser = ref<MeUser | null>(null);

const statusOptions = [
  { value: '', label: 'Semua Status' },
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
  { value: 'TJ', label: 'Tagihan Jakarta' },
  { value: 'LPT', label: 'Lunas PT' },
  { value: 'LJ', label: 'Lunas Jakarta' },
  { value: 'LB', label: 'Lunas Bali' }
];

const regionOptions = [
  { value: '', label: 'Semua Wilayah' },
  { value: 'BALI', label: 'Bali' },
  { value: 'KALIMANTAN', label: 'Kalimantan' },
  { value: 'SUMATERA', label: 'Sumatera' },
  { value: 'SULAWESI', label: 'Sulawesi' },
  { value: 'PAPUA', label: 'Papua' },
  { value: 'JAWA_TENGAH', label: 'Jawa Tengah' },
  { value: 'JAWA_TIMUR', label: 'Jawa Timur' },
  { value: 'SUMBAWA', label: 'Sumbawa' },
  { value: 'LOMBOK', label: 'Lombok' },
  { value: 'NTT', label: 'NTT' },
  { value: 'MALUKU', label: 'Maluku' }
];

function getRegionFromDestination(destination: string): string {
  const dest = (destination || '').toUpperCase();
  if (dest.includes('BALI') || dest.includes('DENPASAR') || dest.includes('SINGARAJA') || dest.includes('GIANYAR') || dest.includes('TABANAN') || dest.includes('KLUNGKUNG') || dest.includes('KARANGASEM') || dest.includes('BULELENG') || dest.includes('BADUNG') || dest.includes('JEMBRANA') || dest.includes('BANGLI')) return 'BALI';
  if (dest.includes('KALIMANTAN') || dest.includes('BANJARMASIN') || dest.includes('PONTIANAK') || dest.includes('BALIKPAPAN') || dest.includes('SAMARINDA') || dest.includes('PALANGKARAYA') || dest.includes('TARAKAN') || dest.includes('BONTANG') || dest.includes('KALTIM') || dest.includes('KALSEL') || dest.includes('KALBAR') || dest.includes('KALTENG') || dest.includes('KALTARA')) return 'KALIMANTAN';
  if (dest.includes('SUMATERA') || dest.includes('SUMATRA') || dest.includes('MEDAN') || dest.includes('PALEMBANG') || dest.includes('PADANG') || dest.includes('PEKANBARU') || dest.includes('LAMPUNG') || dest.includes('JAMBI') || dest.includes('BENGKULU') || dest.includes('ACEH') || dest.includes('BANGKA') || dest.includes('BELITUNG') || dest.includes('RIAU') || dest.includes('SIBOLGA')) return 'SUMATERA';
  if (dest.includes('SULAWESI') || dest.includes('MAKASSAR') || dest.includes('MANADO') || dest.includes('PALU') || dest.includes('KENDARI') || dest.includes('GORONTALO') || dest.includes('MAMUJU')) return 'SULAWESI';
  if (dest.includes('PAPUA') || dest.includes('JAYAPURA') || dest.includes('SORONG') || dest.includes('MERAUKE') || dest.includes('TIMIKA') || dest.includes('MANOKWARI') || dest.includes('BIAK')) return 'PAPUA';
  if (dest.includes('SEMARANG') || dest.includes('SOLO') || dest.includes('SURAKARTA') || dest.includes('KUDUS') || dest.includes('PEKALONGAN') || dest.includes('TEGAL') || dest.includes('MAGELANG') || dest.includes('PURWOKERTO') || dest.includes('CILACAP') || dest.includes('SALATIGA')) return 'JAWA_TENGAH';
  if (dest.includes('SURABAYA') || dest.includes('MALANG') || dest.includes('SIDOARJO') || dest.includes('JEMBER') || dest.includes('KEDIRI') || dest.includes('BLITAR') || dest.includes('PASURUAN') || dest.includes('MADIUN') || dest.includes('MOJOKERTO') || dest.includes('PROBOLINGGO') || dest.includes('BANYUWANGI') || dest.includes('GRESIK') || dest.includes('TUBAN') || dest.includes('LAMONGAN')) return 'JAWA_TIMUR';
  if (dest.includes('SUMBAWA') || dest.includes('BIMA') || dest.includes('DOMPU')) return 'SUMBAWA';
  if (dest.includes('LOMBOK') || dest.includes('MATARAM') || dest.includes('PRAYA')) return 'LOMBOK';
  if (dest.includes('KUPANG') || dest.includes('FLORES') || dest.includes('ENDE') || dest.includes('MAUMERE') || dest.includes('LABUAN BAJO') || dest.includes('RUTENG') || dest.includes('SUMBA') || dest.includes('WAINGAPU') || dest.includes('ATAMBUA') || dest.includes('ALOR') || dest.includes('LEMBATA') || dest.includes('ROTE')) return 'NTT';
  if (dest.includes('MALUKU') || dest.includes('AMBON') || dest.includes('TERNATE') || dest.includes('TUAL')) return 'MALUKU';
  return '';
}

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
  if (selectedRegion.value) {
    result = result.filter(i => getRegionFromDestination(i.destination) === selectedRegion.value);
  }
  return result;
});

const totalNominal = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.nominal || 0), 0));
const totalColli = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.total_colli || 0), 0));

const weightBySatuan = computed(() => {
  const result: Record<string, number> = {};
  filteredItems.value.forEach(i => {
    const unit = (i.satuan || 'KG').toUpperCase();
    result[unit] = (result[unit] || 0) + (i.berat || 0);
  });
  return result;
});

function formatWeight(item: ShipmentReport): string {
  const berat = item.berat || 0;
  const satuan = (item.satuan || 'KG').toUpperCase();
  return `${berat.toFixed(1)} ${satuan}`;
}

function formatTotalWeights(): string {
  const weights = weightBySatuan.value;
  const parts: string[] = [];
  Object.entries(weights).forEach(([unit, val]) => {
    if (val > 0) {
      parts.push(`${val.toFixed(1)} ${unit}`);
    }
  });
  return parts.length > 0 ? parts.join(' | ') : '0';
}

async function loadReport() {
  loading.value = true;
  try {
    const LIMIT = 1000;
    const MAX_PAGES = 50;

    const buildParams = (page: number): URLSearchParams => {
      const params = new URLSearchParams({ endpoint: 'list', limit: String(LIMIT), page: String(page) });
      if (dateFrom.value) params.set('start_date', dateFrom.value);
      if (dateTo.value) params.set('end_date', dateTo.value);
      if (selectedStatus.value) params.set('status', selectedStatus.value);
      if (selectedServiceType.value) params.set('service_type', selectedServiceType.value);
      if (selectedJenis.value) params.set('jenis', selectedJenis.value);
      return params;
    };

    const all: ShipmentReport[] = [];
    let page = 1;
    let total = 0;

    while (page <= MAX_PAGES) {
      const params = buildParams(page);
      const res = await fetch(`/api/shipments?${params.toString()}`);
      if (!res.ok) break;
      const data = await res.json();
      const batch = (data.items || []) as ShipmentReport[];
      const pagination = data.pagination as { total?: number } | undefined;
      total = Number(pagination?.total || total || 0);
      all.push(...batch);
      if (batch.length === 0) break;
      if (total && all.length >= total) break;
      page += 1;
    }

    items.value = all;
  } catch (e) {
    console.error('Failed to load report:', e);
  } finally {
    loading.value = false;
  }
}

function setToday() {
  const today = toWIBDateString();
  dateFrom.value = today;
  dateTo.value = today;
}

function setThisMonth() {
  const now = new Date();
  const firstDay = toWIBDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const lastDay = toWIBDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  dateFrom.value = firstDay;
  dateTo.value = lastDay;
}

function resetFilters() {
  dateFrom.value = '';
  dateTo.value = '';
  selectedStatus.value = '';
  selectedServiceType.value = '';
  selectedJenis.value = '';
  selectedRegion.value = '';
}

function exportExcel() {
  const exportData = filteredItems.value.map((item, idx) => ({
    no: idx + 1,
    tanggal: formatDate(item.created_at),
    kode: item.public_code || '-',
    spb: item.spb_number || '-',
    customer: item.customer_name || '-',
    rute: `${item.origin} → ${item.destination}`,
    colli: item.total_colli,
    berat: formatWeight(item),
    nominal: item.nominal,
    jenis: item.jenis || '-',
    status: item.status
  }));

  exportToExcel({
    filename: buildFilename('daily'),
    sheetName: 'Daily Report',
    title: 'LAPORAN HARIAN SPB',
    subtitle: dateFrom.value && dateTo.value ? `Periode: ${formatDate(dateFrom.value)} - ${formatDate(dateTo.value)}` : 'Semua Periode',
    columns: [
      { header: 'No', key: 'no', width: 5, type: 'number', align: 'center' },
      { header: 'Tanggal', key: 'tanggal', width: 12, type: 'text', align: 'center' },
      { header: 'Kode', key: 'kode', width: 18, type: 'text' },
      { header: 'SPB', key: 'spb', width: 10, type: 'text' },
      { header: 'Customer', key: 'customer', width: 18, type: 'text' },
      { header: 'Rute', key: 'rute', width: 25, type: 'text' },
      { header: 'Colli', key: 'colli', width: 8, type: 'number', align: 'center' },
      { header: 'Berat', key: 'berat', width: 12, type: 'text', align: 'right' },
      { header: 'Nominal', key: 'nominal', width: 15, type: 'currency', align: 'right' },
      { header: 'Jenis', key: 'jenis', width: 10, type: 'text', align: 'center' },
      { header: 'Status', key: 'status', width: 12, type: 'text', align: 'center' }
    ],
    data: exportData,
    totals: {
      colli: totalColli.value,
      berat: formatTotalWeights(),
      nominal: totalNominal.value
    }
  });
}

function printReport() {
  const prev = document.title;
  document.title = buildFilename('daily');
  try {
    window.print();
  } finally {
    document.title = prev;
  }
}

function makeSlug(input = ''): string {
  return (input || '').toString().trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
}

function buildFilename(prefix = 'daily'): string {
  const regionPart = selectedRegion.value ? makeSlug(regionOptions.find(r => r.value === selectedRegion.value)?.label || selectedRegion.value) : 'all';
  const jenisPart = selectedJenis.value ? makeSlug(selectedJenis.value) : '';
  const svcPart = selectedServiceType.value ? makeSlug(selectedServiceType.value) : '';
  const statusPart = selectedStatus.value ? makeSlug(selectedStatus.value) : '';
  const datePart = `${dateFrom.value || 'all'}_${dateTo.value || 'all'}`;
  const parts = [prefix, regionPart, jenisPart, svcPart, statusPart, datePart].filter(Boolean);
  return parts.join('-');
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

function formatDateTime(): string {
  return new Date().toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

watch([dateFrom, dateTo], () => {
  if (dateFrom.value || dateTo.value) loadReport();
});

let reloadTimer: ReturnType<typeof setTimeout> | null = null;
watch([selectedStatus, selectedServiceType, selectedJenis], () => {
  if (!dateFrom.value && !dateTo.value) return;
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    loadReport();
  }, 200);
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
  <div class="space-y-4 pb-20 lg:pb-0">
    <div class="flex items-center justify-between flex-wrap gap-3 print:hidden">
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
      <div class="grid grid-cols-2 md:grid-cols-6 gap-4">
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
        <div>
          <label class="block text-sm font-medium mb-1">Wilayah</label>
          <select v-model="selectedRegion" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
            <option v-for="opt in regionOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="default" @click="setToday">Hari Ini</Button>
        <Button variant="default" @click="setThisMonth">Bulan Ini</Button>
        <Button variant="default" @click="resetFilters">Reset</Button>
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <div class="text-xs text-gray-500 dark:text-gray-400">Total SPB</div>
        <div class="text-xl font-bold text-blue-600">{{ filteredItems.length }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <div class="text-xs text-gray-500 dark:text-gray-400">Total Colli</div>
        <div class="text-xl font-bold text-green-600">{{ totalColli }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <div class="text-xs text-gray-500 dark:text-gray-400">Total Berat</div>
        <div class="text-lg font-bold text-orange-500">{{ formatTotalWeights() }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <div class="text-xs text-gray-500 dark:text-gray-400">Total Nominal</div>
        <div class="text-xl font-bold text-purple-600">{{ formatRupiah(totalNominal) }}</div>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 print:hidden">
      <div v-if="loading" class="flex items-center justify-center h-32">
        <div class="text-gray-500">Loading...</div>
      </div>

      <div v-else-if="filteredItems.length === 0" class="text-center py-8 text-gray-500">
        Tidak ada data untuk periode ini
      </div>

      <div v-else>
        <!-- Desktop table -->
        <div class="hidden lg:block overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              <tr>
                <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">No</th>
                <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Tanggal</th>
                <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Kode</th>
                <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Customer</th>
                <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Rute</th>
                <th class="px-2 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300">Colli</th>
                <th class="px-2 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Berat</th>
                <th class="px-2 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Nominal</th>
                <th class="px-2 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300">Jenis</th>
                <th class="px-2 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="(item, idx) in filteredItems" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ idx + 1 }}</td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ formatDate(item.created_at) }}</td>
                <td class="px-2 py-2 font-medium text-gray-900 dark:text-gray-100">{{ item.public_code || '-' }}</td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ item.customer_name || '-' }}</td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ item.origin }} → {{ item.destination }}</td>
                <td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{{ item.total_colli }}</td>
                <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">{{ formatWeight(item) }}</td>
                <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">{{ formatRupiah(item.nominal) }}</td>
                <td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{{ item.jenis || '-' }}</td>
                <td class="px-2 py-2 text-center">
                  <Badge :variant="getStatusVariant(item.status)">{{ item.status }}</Badge>
                </td>
              </tr>
            </tbody>
            <tfoot class="bg-gray-100 dark:bg-gray-700 font-semibold">
              <tr>
                <td colspan="5" class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">Total:</td>
                <td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{{ totalColli }}</td>
                <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">{{ formatTotalWeights() }}</td>
                <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">{{ formatRupiah(totalNominal) }}</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Mobile cards -->
        <div class="lg:hidden space-y-3">
          <div v-for="item in filteredItems" :key="item.id" class="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
            <div class="flex justify-between items-start gap-2">
              <div class="min-w-0 flex-1">
                <div class="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{{ item.public_code || '-' }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ formatDate(item.created_at) }}</div>
              </div>
              <Badge :variant="getStatusVariant(item.status)">{{ item.status }}</Badge>
            </div>
            <div class="mt-2 text-xs text-gray-600 dark:text-gray-400">
              <div class="font-medium">{{ item.origin }} → {{ item.destination }}</div>
              <div>{{ item.customer_name || '-' }}</div>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <span class="px-2 py-0.5 rounded-full bg-gray-900 dark:bg-gray-600 text-white text-xs">{{ item.total_colli }} colli</span>
              <span class="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 text-xs">{{ formatWeight(item) }}</span>
              <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs">{{ formatRupiah(item.nominal) }}</span>
              <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs">{{ item.jenis || '-' }}</span>
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
        <div class="print-title">LAPORAN HARIAN SPB</div>
        <div class="print-subtitle">{{ dateFrom && dateTo ? `Periode: ${formatDate(dateFrom)} - ${formatDate(dateTo)}` : 'Semua Periode' }}{{ selectedRegion ? ` | Wilayah: ${regionOptions.find(r => r.value === selectedRegion)?.label || selectedRegion}` : '' }}</div>
      </div>
      <table class="print-table">
        <thead>
          <tr>
            <th class="text-center" style="width: 4%">No</th>
            <th class="text-center" style="width: 10%">Tanggal</th>
            <th style="width: 14%">Kode</th>
            <th style="width: 14%">Customer</th>
            <th style="width: 18%">Rute</th>
            <th class="text-center" style="width: 6%">Colli</th>
            <th class="text-right" style="width: 9%">Berat</th>
            <th class="text-right" style="width: 12%">Nominal</th>
            <th class="text-center" style="width: 7%">Jenis</th>
            <th class="text-center" style="width: 8%">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in filteredItems" :key="item.id">
            <td class="text-center">{{ idx + 1 }}</td>
            <td class="text-center">{{ formatDate(item.created_at) }}</td>
            <td>{{ item.public_code || '-' }}</td>
            <td>{{ item.customer_name || '-' }}</td>
            <td>{{ item.origin }} → {{ item.destination }}</td>
            <td class="text-center">{{ item.total_colli }}</td>
            <td class="text-right">{{ formatWeight(item) }}</td>
            <td class="text-right">{{ formatRupiah(item.nominal) }}</td>
            <td class="text-center">{{ item.jenis || '-' }}</td>
            <td class="text-center">{{ item.status }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="5" class="text-right">Total:</td>
            <td class="text-center">{{ totalColli }}</td>
            <td class="text-right">{{ formatTotalWeights() }}</td>
            <td class="text-right">{{ formatRupiah(totalNominal) }}</td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>
      <div class="print-footer">
        <div class="print-date">Dicetak: {{ formatDateTime() }} | Oleh: {{ currentUser?.name || currentUser?.email || '-' }}</div>
        <div class="print-summary">Total SPB: {{ filteredItems.length }} | Total Colli: {{ totalColli }} | Total Berat: {{ formatTotalWeights() }}</div>
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

  .print-brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
    margin-bottom: 12px;
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
    font-size: 20px;
    font-weight: bold;
    color: #1e3a5f;
    letter-spacing: 1px;
  }

  .print-address {
    font-size: 11px;
    color: #555;
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
    margin-top: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
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
