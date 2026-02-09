<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Button from '../components/ui/Button.vue';
import Badge from '../components/ui/Badge.vue';
import DblSjChecklistDrawer from '../components/DblSjChecklistDrawer.vue';
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
  sj_returned_count: number;
  total_colli: number;
  total_weight: number;
  total_nominal: number;
  paid_cash_bali?: number;
  paid_cash_jakarta?: number;
  paid_tf_bali?: number;
  paid_tf_jakarta?: number;
  paid_cicilan?: number;
  created_at: string;
  departure_date: string | null;
};

const items = ref<DBLReportItem[]>([]);
const loading = ref(true);
const dateFrom = ref('');
const dateTo = ref('');
const selectedDbl = ref('');
const selectedMethod = ref('');
const selectedStatus = ref('');
const selectedRegion = ref('');
const reportType = ref<'daily' | 'monthly'>('daily');
const company = ref<CompanyProfile | null>(null);
const currentUser = ref<MeUser | null>(null);

const appliedDateFrom = ref('');
const appliedDateTo = ref('');
const appliedDbl = ref('');
const appliedMethod = ref('');
const appliedStatus = ref('');
const appliedRegion = ref('');
const appliedReportType = ref<'daily' | 'monthly'>('daily');

const statusOptions = [
  { value: '', label: 'Semua Status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'LOADING', label: 'Loading' },
  { value: 'DEPARTED', label: 'Departed' },
  { value: 'ARRIVED', label: 'Arrived' }
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

const dblOptions = computed(() => {
  const nums = items.value.map(i => i.dbl_number).filter(Boolean) as string[];
  return [...new Set(nums)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
});

const methodOptions = [
  { value: '', label: 'Semua Metode' },
  { value: 'CASH BALI', label: 'Cash Bali' },
  { value: 'CASH JAKARTA', label: 'Cash Jakarta' },
  { value: 'TF BALI', label: 'Tf Bali' },
  { value: 'TF JAKARTA', label: 'Tf Jakarta' }
];

function getCashTotal(item: DBLReportItem): number {
  return Number(item.paid_cash_bali || 0) + Number(item.paid_cash_jakarta || 0);
}

function getTfTotal(item: DBLReportItem): number {
  return Number(item.paid_tf_bali || 0) + Number(item.paid_tf_jakarta || 0);
}

function getMethodAmount(item: DBLReportItem, method: string): number {
  const m = String(method || '').toUpperCase();
  if (!m) return 0;
  if (m === 'CASH BALI') return Number(item.paid_cash_bali || 0);
  if (m === 'CASH JAKARTA') return Number(item.paid_cash_jakarta || 0);
  if (m === 'TF BALI') return Number(item.paid_tf_bali || 0);
  if (m === 'TF JAKARTA') return Number(item.paid_tf_jakarta || 0);
  return 0;
}

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
  if (appliedRegion.value) {
    result = result.filter(i => getRegionFromDestination(i.destination || '') === appliedRegion.value);
  }
  return result;
});

const totalDBL = computed(() => filteredItems.value.length);
const totalShipments = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.total_shipments || 0), 0));
const totalSjReturned = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.sj_returned_count || 0), 0));
const totalColli = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.total_colli || 0), 0));
const totalWeight = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.total_weight || 0), 0));
const totalNominal = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.total_nominal || 0), 0));
const totalCashReceived = computed(() => filteredItems.value.reduce((sum, i) => sum + getCashTotal(i), 0));
const totalTfReceived = computed(() => filteredItems.value.reduce((sum, i) => sum + getTfTotal(i), 0));

const nominalCardLabel = computed(() => {
  if (!appliedMethod.value) return 'Total Nominal';
  const label = methodOptions.find(o => o.value === appliedMethod.value)?.label || appliedMethod.value;
  return `Total Diterima (${label})`;
});

const nominalCardValue = computed(() => {
  if (!appliedMethod.value) return totalNominal.value;
  return filteredItems.value.reduce((sum, i) => sum + getMethodAmount(i, appliedMethod.value), 0);
});

const hasPendingChanges = computed(() => (
  dateFrom.value !== appliedDateFrom.value ||
  dateTo.value !== appliedDateTo.value ||
  selectedDbl.value !== appliedDbl.value ||
  selectedMethod.value !== appliedMethod.value ||
  selectedStatus.value !== appliedStatus.value ||
  selectedRegion.value !== appliedRegion.value ||
  reportType.value !== appliedReportType.value
));

async function loadReport() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ endpoint: 'report' });
    if (appliedDateFrom.value) params.set('start_date', appliedDateFrom.value);
    if (appliedDateTo.value) params.set('end_date', appliedDateTo.value);
    if (appliedStatus.value) params.set('status', appliedStatus.value);
    if (appliedDbl.value) params.set('dbl_number', appliedDbl.value);

    const res = await fetch(`/api/dbl?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      items.value = (data.items || []).map((x: Partial<DBLReportItem>) => ({
        ...x,
        total_shipments: Number(x.total_shipments || 0),
        sj_returned_count: Number(x.sj_returned_count || 0),
        total_colli: Number(x.total_colli || 0),
        total_weight: Number(x.total_weight || 0),
        total_nominal: Number(x.total_nominal || 0),
        paid_cash_bali: Number(x.paid_cash_bali || 0),
        paid_cash_jakarta: Number(x.paid_cash_jakarta || 0),
        paid_tf_bali: Number(x.paid_tf_bali || 0),
        paid_tf_jakarta: Number(x.paid_tf_jakarta || 0),
        paid_cicilan: Number(x.paid_cicilan || 0)
      })) as DBLReportItem[];
    }
  } catch (e) {
    console.error('Failed to load DBL report:', e);
  } finally {
    loading.value = false;
  }
}

function getSjVariant(item: DBLReportItem): 'default' | 'warning' | 'success' {
  const total = Number(item.total_shipments || 0);
  const returned = Number(item.sj_returned_count || 0);
  if (total <= 0) return 'default';
  if (returned >= total) return 'success';
  if (returned > 0) return 'warning';
  return 'default';
}

const sjDrawerOpen = ref(false);
const sjDrawerItem = ref<DBLReportItem | null>(null);

function openSjChecklist(item: DBLReportItem): void {
  sjDrawerItem.value = item;
  sjDrawerOpen.value = true;
}

function onSjStats(payload: { dblId: number; sjReturned: number; totalShipments: number }): void {
  const target = items.value.find(i => i.id === payload.dblId);
  if (!target) return;
  target.sj_returned_count = payload.sjReturned;
  target.total_shipments = payload.totalShipments;
  if (sjDrawerItem.value?.id === payload.dblId) {
    sjDrawerItem.value.sj_returned_count = payload.sjReturned;
    sjDrawerItem.value.total_shipments = payload.totalShipments;
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
  selectedDbl.value = '';
  selectedMethod.value = '';
  selectedStatus.value = '';
  selectedRegion.value = '';
}

async function applyFilters(): Promise<void> {
  const shouldReload =
    items.value.length === 0 ||
    appliedDateFrom.value !== dateFrom.value ||
    appliedDateTo.value !== dateTo.value ||
    appliedDbl.value !== selectedDbl.value ||
    appliedStatus.value !== selectedStatus.value;

  appliedDateFrom.value = dateFrom.value;
  appliedDateTo.value = dateTo.value;
  appliedDbl.value = selectedDbl.value;
  appliedMethod.value = selectedMethod.value;
  appliedStatus.value = selectedStatus.value;
  appliedRegion.value = selectedRegion.value;
  appliedReportType.value = reportType.value;
  if (shouldReload) {
    await loadReport();
  }
}

async function resetAndApply(): Promise<void> {
  resetFilters();
  await applyFilters();
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
    sj: `${item.sj_returned_count || 0}/${item.total_shipments || 0}`,
    colli: item.total_colli,
    berat: item.total_weight || 0,
    nominal: item.total_nominal,
    status: item.status
  }));

  exportToExcel({
    filename: buildFilename('dbl'),
    sheetName: 'DBL Report',
    title: 'LAPORAN DBL (DAFTAR BONGKAR LOADING)',
    subtitle: appliedDateFrom.value && appliedDateTo.value ? `Periode: ${formatDate(appliedDateFrom.value)} - ${formatDate(appliedDateTo.value)}` : 'Semua Periode',
    columns: [
      { header: 'No', key: 'no', width: 5, type: 'number', align: 'center' },
      { header: 'Tanggal', key: 'tanggal', width: 12, type: 'text', align: 'center' },
      { header: 'No. DBL', key: 'dbl', width: 14, type: 'text' },
      { header: 'Plat', key: 'plat', width: 12, type: 'text' },
      { header: 'Driver', key: 'driver', width: 15, type: 'text' },
      { header: 'Tujuan', key: 'tujuan', width: 15, type: 'text' },
      { header: 'SPB', key: 'spb', width: 8, type: 'number', align: 'center' },
      { header: 'SJ Balik', key: 'sj', width: 10, type: 'text', align: 'center' },
      { header: 'Colli', key: 'colli', width: 8, type: 'number', align: 'center' },
      { header: 'Berat', key: 'berat', width: 10, type: 'number', align: 'right' },
      { header: 'Nominal', key: 'nominal', width: 15, type: 'currency', align: 'right' },
      { header: 'Status', key: 'status', width: 12, type: 'text', align: 'center' }
    ],
    data: exportData,
    totals: {
      spb: totalShipments.value,
      colli: totalColli.value,
      berat: totalWeight.value,
      nominal: totalNominal.value
    }
  });
}

function printReport() {
  const prev = document.title;
  document.title = buildFilename('dbl');
  try {
    window.print();
  } finally {
    document.title = prev;
  }
}

function makeSlug(input = ''): string {
  return (input || '').toString().trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
}

function buildFilename(prefix = 'dbl'): string {
  const typePart = appliedReportType.value || 'daily';
  const regionPart = appliedRegion.value ? makeSlug(regionOptions.find(r => r.value === appliedRegion.value)?.label || appliedRegion.value) : 'all';
  const statusPart = appliedStatus.value ? makeSlug(appliedStatus.value) : '';
  const datePart = `${appliedDateFrom.value || 'all'}_${appliedDateTo.value || 'all'}`;
  const parts = [prefix, typePart, regionPart, statusPart, datePart].filter(Boolean);
  return parts.join('-');
}

function formatDateTime(date: Date = new Date()): string {
  return date.toLocaleString('id-ID', {
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

onMounted(async () => {
  setToday();
  await applyFilters();
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
  <div class="space-y-4 pb-24 lg:pb-0 dark:text-gray-100">
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
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-200">No. DBL</label>
          <select v-model="selectedDbl" class="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
            <option value="">Semua DBL</option>
            <option v-for="dbl in dblOptions" :key="dbl" :value="dbl">{{ dbl }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-200">Metode</label>
          <select v-model="selectedMethod" class="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
            <option v-for="opt in methodOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-200">Dari Tanggal</label>
          <input v-model="dateFrom" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-200">Sampai Tanggal</label>
          <input v-model="dateTo" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-200">Status</label>
          <select v-model="selectedStatus" class="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
            <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-200">Wilayah</label>
          <select v-model="selectedRegion" class="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
            <option v-for="opt in regionOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>
      <div class="flex gap-2">
        <Button variant="default" @click="resetAndApply">Reset</Button>
        <Button variant="primary" :disabled="loading || !hasPendingChanges" @click="applyFilters">Apply</Button>
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
        <div class="text-xs text-gray-500 dark:text-gray-400">Total Berat</div>
        <div class="text-xl font-bold text-amber-600">{{ totalWeight.toFixed(1) }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 col-span-2 sm:col-span-1">
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ nominalCardLabel }}</div>
        <div class="text-xl font-bold text-purple-600">{{ formatRupiah(nominalCardValue) }}</div>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 print:hidden">
      <div v-if="loading" class="flex items-center justify-center h-32">
        <div class="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>

      <div v-else-if="filteredItems.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
        Tidak ada data DBL untuk periode ini
      </div>

      <div v-else>
        <div class="mb-2 text-xs text-gray-500 dark:text-gray-400">Klik No. DBL untuk lihat list SPB & checklist SJ balik.</div>
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
                <th class="px-2 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300">SJ</th>
                <th class="px-2 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300">Colli</th>
                <th class="px-2 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Berat</th>
                <th class="px-2 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Nominal</th>
                <th class="px-2 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="(item, idx) in filteredItems" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ idx + 1 }}</td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ formatDate(item.departure_date || item.created_at) }}</td>
                <td class="px-2 py-2">
                  <button class="font-medium text-gray-900 dark:text-gray-100 hover:underline text-left" @click="openSjChecklist(item)">
                    {{ item.dbl_number || '-' }}
                  </button>
                </td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ item.vehicle_plate || '-' }}</td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ item.driver_name || '-' }}</td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ item.destination || '-' }}</td>
                <td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{{ item.total_shipments }}</td>
                <td class="px-2 py-2 text-center">
                  <Badge :variant="getSjVariant(item)">
                    {{ item.sj_returned_count || 0 }}/{{ item.total_shipments || 0 }}
                  </Badge>
                </td>
                <td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{{ item.total_colli }}</td>
                <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">{{ (item.total_weight || 0).toFixed(1) }}</td>
                <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">
                  <div class="font-medium">{{ formatRupiah(item.total_nominal) }}</div>
                  <div class="text-[11px] text-green-600">Cash: {{ formatRupiah(getCashTotal(item)) }}</div>
                  <div class="text-[11px] text-blue-600">TF: {{ formatRupiah(getTfTotal(item)) }}</div>
                </td>
                <td class="px-2 py-2 text-center">
                  <Badge :variant="getStatusVariant(item.status)">{{ item.status }}</Badge>
                </td>
              </tr>
            </tbody>
            <tfoot class="bg-gray-100 dark:bg-gray-700 font-semibold">
              <tr>
                <td colspan="6" class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">Total:</td>
                <td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{{ totalShipments }}</td>
                <td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{{ totalSjReturned }}/{{ totalShipments }}</td>
                <td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{{ totalColli }}</td>
                <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">{{ totalWeight.toFixed(1) }}</td>
                <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">
                  <div class="font-medium">{{ formatRupiah(totalNominal) }}</div>
                  <div class="text-[11px] text-green-700">Cash: {{ formatRupiah(totalCashReceived) }}</div>
                  <div class="text-[11px] text-blue-700">TF: {{ formatRupiah(totalTfReceived) }}</div>
                </td>
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
                <button class="font-medium text-sm text-gray-900 dark:text-gray-100 hover:underline text-left" @click="openSjChecklist(item)">
                  {{ item.dbl_number || '-' }}
                </button>
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
              <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs">SJ: {{ item.sj_returned_count || 0 }}/{{ item.total_shipments || 0 }}</span>
              <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs">{{ item.total_colli }} colli</span>
              <span class="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 text-xs">{{ (item.total_weight || 0).toFixed(1) }}</span>
              <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs">{{ formatRupiah(item.total_nominal) }}</span>
              <span class="text-[11px] text-green-600">Cash: {{ formatRupiah(getCashTotal(item)) }}</span>
              <span class="text-[11px] text-blue-600">TF: {{ formatRupiah(getTfTotal(item)) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <DblSjChecklistDrawer
      :show="sjDrawerOpen"
      :dbl-id="sjDrawerItem?.id ?? null"
      :dbl-number="sjDrawerItem?.dbl_number ?? null"
      :driver-name="sjDrawerItem?.driver_name ?? null"
      :vehicle-plate="sjDrawerItem?.vehicle_plate ?? null"
      :destination="sjDrawerItem?.destination ?? null"
      :departure-date="sjDrawerItem ? formatDate(sjDrawerItem.departure_date || sjDrawerItem.created_at) : null"
      @close="sjDrawerOpen = false"
      @stats="onSjStats"
    />

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
        <div class="print-subtitle">{{ appliedDateFrom && appliedDateTo ? `Periode: ${formatDate(appliedDateFrom)} - ${formatDate(appliedDateTo)}` : 'Semua Periode' }}{{ appliedRegion ? ` | Wilayah: ${regionOptions.find(r => r.value === appliedRegion)?.label || appliedRegion}` : '' }}</div>
      </div>
      <table class="print-table">
        <thead>
          <tr>
            <th class="text-center" style="width: 4%">No</th>
            <th class="text-center" style="width: 9%">Tanggal</th>
            <th style="width: 12%">No. DBL</th>
            <th style="width: 9%">Plat</th>
            <th style="width: 11%">Driver</th>
            <th style="width: 11%">Tujuan</th>
            <th class="text-center" style="width: 6%">SPB</th>
            <th class="text-center" style="width: 7%">SJ</th>
            <th class="text-center" style="width: 6%">Colli</th>
            <th class="text-right" style="width: 7%">Berat</th>
            <th class="text-right" style="width: 11%">Nominal</th>
            <th class="text-center" style="width: 7%">Status</th>
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
            <td class="text-center">{{ item.sj_returned_count || 0 }}/{{ item.total_shipments || 0 }}</td>
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
            <td class="text-center">{{ totalSjReturned }}/{{ totalShipments }}</td>
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
