<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import { useFormatters } from '../composables/useFormatters';
import { useAuth } from '../composables/useAuth';

const { formatRupiah, formatDate, toWIBDateString } = useFormatters();
const { fetchUser } = useAuth();

type DBLWithCost = {
  id: number;
  dbl_number: string;
  origin: string | null;
  destination: string | null;
  driver_name: string | null;
  dbl_date: string | null;
  vehicle_plate: string | null;
  total_nominal: number;
  bayar_supir: number | null;
  solar: number | null;
  ongkos_mobil: number | null;
  ops_jakarta: number | null;
  ops_bali: number | null;
  ops_lombok: number | null;
  lain_lain: number | null;
  potongan_diskon: number | null;
  total_operational: number | null;
  oc_catatan: string | null;
};

type CostForm = {
  dbl_id: number;
  bayar_supir: string;
  solar: string;
  ongkos_mobil: string;
  ops_jakarta: string;
  ops_bali: string;
  ops_lombok: string;
  lain_lain: string;
  potongan_diskon: string;
  catatan: string;
};

type CostAmountField = Exclude<keyof CostForm, 'dbl_id' | 'catatan'>;

type ReportItem = {
  id: number;
  dbl_number: string;
  origin: string | null;
  destination: string | null;
  driver_name: string | null;
  dbl_date: string | null;
  vehicle_plate: string | null;
  total_nominal: number;
  bayar_supir: number;
  solar: number;
  ongkos_mobil: number;
  ops_jakarta: number;
  ops_bali: number;
  ops_lombok: number;
  lain_lain: number;
  potongan_diskon: number;
  total_operational: number;
  margin: number;
  margin_percent: string | number;
};

const loading = ref(true);
const saving = ref(false);
const dblList = ref<DBLWithCost[]>([]);
const reportItems = ref<ReportItem[]>([]);
const showModal = ref(false);
const selectedDbl = ref<DBLWithCost | null>(null);

const startDate = ref('');
const endDate = ref('');
const destinationFilter = ref('all');
const viewMode = ref<'input' | 'report'>('input');

const form = ref<CostForm>({
  dbl_id: 0,
  bayar_supir: '0',
  solar: '0',
  ongkos_mobil: '0',
  ops_jakarta: '0',
  ops_bali: '0',
  ops_lombok: '0',
  lain_lain: '0',
  potongan_diskon: '0',
  catatan: ''
});

const summary = ref({
  total_nominal: 0,
  total_operational: 0,
  total_margin: 0
});

function toAmount(value: string): number {
  return parseFloat(value) || 0;
}

function formatInputAmount(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return new Intl.NumberFormat('id-ID').format(Number(digits));
}

function updateAmountField(field: CostAmountField, event: Event): void {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  form.value[field] = target.value.replace(/\D/g, '');
}

const calculatedTotal = computed(() => {
  return toAmount(form.value.bayar_supir) +
    toAmount(form.value.solar) +
    toAmount(form.value.ongkos_mobil) +
    toAmount(form.value.ops_jakarta) +
    toAmount(form.value.ops_bali) +
    toAmount(form.value.ops_lombok) +
    toAmount(form.value.lain_lain) +
    toAmount(form.value.potongan_diskon);
});

const calculatedMargin = computed(() => {
  if (!selectedDbl.value) return 0;
  return selectedDbl.value.total_nominal - calculatedTotal.value;
});

const marginPercent = computed(() => {
  if (!selectedDbl.value || selectedDbl.value.total_nominal === 0) return 0;
  return ((calculatedMargin.value / selectedDbl.value.total_nominal) * 100).toFixed(1);
});

function initDates(): void {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  startDate.value = toWIBDateString(firstDay);
  endDate.value = toWIBDateString(lastDay);
}

async function loadData(): Promise<void> {
  loading.value = true;
  try {
    const params = new URLSearchParams({ endpoint: 'operational-costs' });
    if (startDate.value) params.set('start_date', startDate.value);
    if (endDate.value) params.set('end_date', endDate.value);
    if (destinationFilter.value !== 'all') params.set('destination', destinationFilter.value);

    const res = await fetch(`/api/dbl?${params.toString()}`);
    const data = await res.json();
    dblList.value = data.items || [];
  } catch {
    dblList.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadReport(): Promise<void> {
  loading.value = true;
  try {
    const params = new URLSearchParams({ endpoint: 'margin-report' });
    if (startDate.value) params.set('start_date', startDate.value);
    if (endDate.value) params.set('end_date', endDate.value);
    if (destinationFilter.value !== 'all') params.set('destination', destinationFilter.value);

    const res = await fetch(`/api/dbl?${params.toString()}`);
    const data = await res.json();
    reportItems.value = data.items || [];
    summary.value = data.summary || { total_nominal: 0, total_operational: 0, total_margin: 0 };
  } catch {
    reportItems.value = [];
  } finally {
    loading.value = false;
  }
}

function openCostModal(dbl: DBLWithCost): void {
  selectedDbl.value = dbl;
  form.value = {
    dbl_id: dbl.id,
    bayar_supir: String(dbl.bayar_supir || 0),
    solar: String(dbl.solar || 0),
    ongkos_mobil: String(dbl.ongkos_mobil || 0),
    ops_jakarta: String(dbl.ops_jakarta || 0),
    ops_bali: String(dbl.ops_bali || 0),
    ops_lombok: String(dbl.ops_lombok || 0),
    lain_lain: String(dbl.lain_lain || 0),
    potongan_diskon: String(dbl.potongan_diskon || 0),
    catatan: dbl.oc_catatan || ''
  };
  showModal.value = true;
}

async function saveCosts(): Promise<void> {
  if (!selectedDbl.value) return;
  saving.value = true;
  try {
    const res = await fetch('/api/dbl?endpoint=save-operational-costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dbl_id: form.value.dbl_id,
        bayar_supir: toAmount(form.value.bayar_supir),
        solar: toAmount(form.value.solar),
        ongkos_mobil: toAmount(form.value.ongkos_mobil),
        ops_jakarta: toAmount(form.value.ops_jakarta),
        ops_bali: toAmount(form.value.ops_bali),
        ops_lombok: toAmount(form.value.ops_lombok),
        lain_lain: toAmount(form.value.lain_lain),
        potongan_diskon: toAmount(form.value.potongan_diskon),
        catatan: form.value.catatan || null
      })
    });

    if (!res.ok) throw new Error('Save failed');
    
    showModal.value = false;
    if (viewMode.value === 'report') {
      await loadReport();
    } else {
      await loadData();
    }
  } catch {
    alert('Gagal menyimpan biaya operasional');
  } finally {
    saving.value = false;
  }
}

watch([viewMode, startDate, endDate, destinationFilter], () => {
  if (viewMode.value === 'report') {
    loadReport();
  } else {
    loadData();
  }
});

const destinationOptions = computed(() => {
  const source = viewMode.value === 'report' ? reportItems.value : dblList.value;
  const unique = new Set<string>();
  for (const item of source) {
    const dest = String(item.destination || '').trim();
    if (dest) unique.add(dest);
  }

  const sorted = Array.from(unique).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const base = [
    { value: 'all', label: 'Semua Tujuan' },
    { value: 'bali', label: 'Bali (semua kota Bali)' },
    { value: 'jakarta', label: 'Jakarta' }
  ];

  const extra = sorted
    .filter((d) => !base.some((b) => b.value.toLowerCase() === d.toLowerCase()))
    .map((d) => ({ value: d, label: d }));

  return [...base, ...extra];
});

onMounted(() => {
  fetchUser();
  initDates();
  loadData();
});
</script>

<template>
  <div class="space-y-4 pb-20 lg:pb-4">
    <div class="hidden lg:flex items-center justify-between gap-4 mb-4">
      <h1 class="text-xl font-semibold dark:text-gray-100">Biaya Operasional</h1>
      <div class="flex gap-2">
        <Button
          :variant="viewMode === 'input' ? 'primary' : 'default'"
          @click="viewMode = 'input'"
        >
          Input Biaya
        </Button>
        <Button
          :variant="viewMode === 'report' ? 'primary' : 'default'"
          @click="viewMode = 'report'"
        >
          Laporan Margin
        </Button>
      </div>
    </div>

    <div class="lg:hidden mb-4">
      <div class="flex gap-2">
        <Button
          :variant="viewMode === 'input' ? 'primary' : 'default'"
          class="flex-1"
          @click="viewMode = 'input'"
        >
          Input Biaya
        </Button>
        <Button
          :variant="viewMode === 'report' ? 'primary' : 'default'"
          class="flex-1"
          @click="viewMode = 'report'"
        >
          Laporan Margin
        </Button>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label class="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Dari</label>
          <input
            v-model="startDate"
            type="date"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
        <div>
          <label class="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Sampai</label>
          <input
            v-model="endDate"
            type="date"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
        <div>
          <label class="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Tujuan</label>
          <select
            v-model="destinationFilter"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
          >
            <option v-for="opt in destinationOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div class="flex items-end">
          <Button
            variant="primary"
            block
            @click="viewMode === 'report' ? loadReport() : loadData()"
          >
            Filter
          </Button>
        </div>
      </div>
    </div>

    <template v-if="viewMode === 'report'">
      <div class="grid grid-cols-3 gap-3 lg:gap-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-3 lg:p-4 border border-gray-200 dark:border-gray-700">
          <div class="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">Pendapatan</div>
          <div class="text-sm lg:text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
            {{ formatRupiah(summary.total_nominal) }}
          </div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-3 lg:p-4 border border-gray-200 dark:border-gray-700">
          <div class="text-xs font-medium text-red-600 dark:text-red-400 uppercase">Biaya</div>
          <div class="text-sm lg:text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
            {{ formatRupiah(summary.total_operational) }}
          </div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-3 lg:p-4 border border-gray-200 dark:border-gray-700">
          <div class="text-xs font-medium uppercase" :class="summary.total_margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">Margin</div>
          <div
            class="text-sm lg:text-lg font-bold mt-1"
            :class="summary.total_margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
          >
            {{ formatRupiah(summary.total_margin) }}
          </div>
        </div>
      </div>
    </template>

    <div v-if="loading" class="flex items-center justify-center h-48">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <template v-else-if="viewMode === 'input'">
      <div class="hidden lg:block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. DBL</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rute</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Supir</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nominal</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Biaya</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Margin</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-if="dblList.length === 0">
              <td colspan="9" class="px-4 py-8 text-center text-gray-500">Tidak ada data</td>
            </tr>
            <tr
              v-for="dbl in dblList"
              :key="dbl.id"
              class="hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <td class="px-4 py-3">
                <div class="font-medium text-gray-900 dark:text-gray-100">{{ dbl.dbl_number }}</div>
                <div class="text-xs text-gray-500">{{ dbl.vehicle_plate || '-' }}</div>
              </td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ dbl.dbl_date ? formatDate(dbl.dbl_date) : '-' }}</td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ dbl.origin || '-' }} - {{ dbl.destination || '-' }}</td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ dbl.driver_name || '-' }}</td>
              <td class="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">{{ formatRupiah(dbl.total_nominal || 0) }}</td>
              <td class="px-4 py-3 text-right text-red-600 dark:text-red-400">{{ formatRupiah(dbl.total_operational || 0) }}</td>
              <td
                class="px-4 py-3 text-right font-medium"
                :class="(dbl.total_nominal - (dbl.total_operational || 0)) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
              >
                {{ formatRupiah(dbl.total_nominal - (dbl.total_operational || 0)) }}
              </td>
              <td class="px-4 py-3 text-center">
                <Badge :variant="dbl.total_operational ? 'success' : 'warning'">
                  {{ dbl.total_operational ? 'Sudah' : 'Belum' }}
                </Badge>
              </td>
              <td class="px-4 py-3 text-center">
                <Button
                  :variant="dbl.total_operational ? 'default' : 'primary'"
                  size="sm"
                  @click="openCostModal(dbl)"
                >
                  {{ dbl.total_operational ? 'Edit' : 'Input' }}
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="lg:hidden space-y-3">
        <div
          v-if="dblList.length === 0"
          class="bg-white dark:bg-gray-800 rounded-lg p-8 text-center border border-gray-200 dark:border-gray-700"
        >
          <div class="text-gray-500">Tidak ada data</div>
        </div>
        <div
          v-for="dbl in dblList"
          :key="dbl.id"
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div class="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div class="flex justify-between items-center">
              <div>
                <div class="font-semibold text-gray-900 dark:text-gray-100">{{ dbl.dbl_number }}</div>
                <div class="text-xs text-gray-500 mt-0.5">{{ dbl.dbl_date ? formatDate(dbl.dbl_date) : '-' }}</div>
              </div>
              <Badge :variant="dbl.total_operational ? 'success' : 'warning'">
                {{ dbl.total_operational ? 'Isi' : 'Kosong' }}
              </Badge>
            </div>
          </div>
          <div class="p-3">
            <div class="text-sm text-gray-600 dark:text-gray-300 mb-3">
              {{ dbl.origin || '-' }} - {{ dbl.destination || '-' }}
            </div>
            <div class="grid grid-cols-3 gap-2 mb-3 text-center">
              <div class="p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                <div class="text-[10px] text-gray-500 uppercase">Nominal</div>
                <div class="text-xs font-semibold text-gray-900 dark:text-gray-100">{{ formatRupiah(dbl.total_nominal || 0) }}</div>
              </div>
              <div class="p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                <div class="text-[10px] text-gray-500 uppercase">Biaya</div>
                <div class="text-xs font-semibold text-red-600 dark:text-red-400">{{ formatRupiah(dbl.total_operational || 0) }}</div>
              </div>
              <div class="p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                <div class="text-[10px] text-gray-500 uppercase">Margin</div>
                <div
                  class="text-xs font-semibold"
                  :class="(dbl.total_nominal - (dbl.total_operational || 0)) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
                >
                  {{ formatRupiah(dbl.total_nominal - (dbl.total_operational || 0)) }}
                </div>
              </div>
            </div>
            <Button
              :variant="dbl.total_operational ? 'default' : 'primary'"
              block
              @click="openCostModal(dbl)"
            >
              {{ dbl.total_operational ? 'Edit Biaya' : 'Input Biaya' }}
            </Button>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="hidden lg:block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div class="overflow-x-auto">
          <table class="min-w-[1450px] w-full text-sm table-auto">
            <thead class="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th class="w-[90px] px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">DBL</th>
                <th class="w-[80px] px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Tgl</th>
                <th class="w-[150px] px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rute</th>
                <th class="w-[110px] px-3 py-3 text-right text-xs font-medium text-blue-600 dark:text-blue-400 uppercase whitespace-nowrap">Nominal</th>
                <th class="w-[90px] px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Supir</th>
                <th class="w-[80px] px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Solar</th>
                <th class="w-[90px] px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Mobil</th>
                <th class="w-[90px] px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Ops Jkt</th>
                <th class="w-[90px] px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Ops Bali</th>
                <th class="w-[90px] px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Ops Lbk</th>
                <th class="w-[90px] px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Lain2</th>
                <th class="w-[90px] px-3 py-3 text-right text-xs font-medium text-amber-600 dark:text-amber-400 uppercase whitespace-nowrap">Diskon</th>
                <th class="w-[110px] px-3 py-3 text-right text-xs font-medium text-red-600 dark:text-red-400 uppercase whitespace-nowrap">Total</th>
                <th class="w-[110px] px-3 py-3 text-right text-xs font-medium text-green-600 dark:text-green-400 uppercase whitespace-nowrap">Margin</th>
                <th class="w-[60px] px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">%</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-if="reportItems.length === 0">
                <td colspan="15" class="px-4 py-8 text-center text-gray-500">Tidak ada data laporan</td>
              </tr>
              <tr
                v-for="item in reportItems"
                :key="item.id"
                class="hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <td class="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 truncate">{{ item.dbl_number }}</td>
                <td class="px-3 py-2 text-gray-600 dark:text-gray-300 text-xs whitespace-nowrap">{{ item.dbl_date ? formatDate(item.dbl_date) : '-' }}</td>
                <td class="px-3 py-2 text-gray-600 dark:text-gray-300 text-xs truncate">{{ item.origin || '-' }} - {{ item.destination || '-' }}</td>
                <td class="px-3 py-2 text-right font-medium text-blue-600 dark:text-blue-400 text-xs whitespace-nowrap tabular-nums">{{ formatRupiah(item.total_nominal) }}</td>
                <td class="px-3 py-2 text-right text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap tabular-nums">{{ formatRupiah(item.bayar_supir) }}</td>
                <td class="px-3 py-2 text-right text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap tabular-nums">{{ formatRupiah(item.solar) }}</td>
                <td class="px-3 py-2 text-right text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap tabular-nums">{{ formatRupiah(item.ongkos_mobil) }}</td>
                <td class="px-3 py-2 text-right text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap tabular-nums">{{ formatRupiah(item.ops_jakarta) }}</td>
                <td class="px-3 py-2 text-right text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap tabular-nums">{{ formatRupiah(item.ops_bali) }}</td>
                <td class="px-3 py-2 text-right text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap tabular-nums">{{ formatRupiah(item.ops_lombok) }}</td>
                <td class="px-3 py-2 text-right text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap tabular-nums">{{ formatRupiah(item.lain_lain) }}</td>
                <td class="px-3 py-2 text-right text-amber-600 dark:text-amber-400 text-xs whitespace-nowrap tabular-nums">{{ formatRupiah(item.potongan_diskon) }}</td>
                <td class="px-3 py-2 text-right font-medium text-red-600 dark:text-red-400 text-xs whitespace-nowrap tabular-nums">{{ formatRupiah(item.total_operational) }}</td>
                <td
                  class="px-3 py-2 text-right font-medium text-xs whitespace-nowrap tabular-nums"
                  :class="item.margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
                >
                  {{ formatRupiah(item.margin) }}
                </td>
                <td
                  class="px-3 py-2 text-right font-medium text-xs whitespace-nowrap tabular-nums"
                  :class="Number(item.margin_percent) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
                >
                  {{ item.margin_percent }}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="lg:hidden space-y-3">
        <div
          v-if="reportItems.length === 0"
          class="bg-white dark:bg-gray-800 rounded-lg p-8 text-center border border-gray-200 dark:border-gray-700"
        >
          <div class="text-gray-500">Tidak ada data laporan</div>
        </div>
        <div
          v-for="item in reportItems"
          :key="item.id"
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div class="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div class="flex justify-between items-center">
              <div>
                <div class="font-semibold text-gray-900 dark:text-gray-100">{{ item.dbl_number }}</div>
                <div class="text-xs text-gray-500 mt-0.5">{{ item.dbl_date ? formatDate(item.dbl_date) : '-' }}</div>
              </div>
              <Badge :variant="item.margin >= 0 ? 'success' : 'warning'">
                {{ item.margin_percent }}%
              </Badge>
            </div>
          </div>
          <div class="p-3">
            <div class="text-sm text-gray-600 dark:text-gray-300 mb-3">
              {{ item.origin || '-' }} - {{ item.destination || '-' }}
            </div>

            <div class="space-y-1 text-xs mb-3">
              <div class="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                <span class="text-gray-500">Nominal</span>
                <span class="font-medium text-blue-600 dark:text-blue-400">{{ formatRupiah(item.total_nominal) }}</span>
              </div>
              <div class="grid grid-cols-2 gap-x-4 gap-y-1 py-1">
                <div class="flex justify-between">
                  <span class="text-gray-400">Supir</span>
                  <span class="text-gray-600 dark:text-gray-300">{{ formatRupiah(item.bayar_supir) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Solar</span>
                  <span class="text-gray-600 dark:text-gray-300">{{ formatRupiah(item.solar) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Mobil</span>
                  <span class="text-gray-600 dark:text-gray-300">{{ formatRupiah(item.ongkos_mobil) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Ops Jakarta</span>
                  <span class="text-gray-600 dark:text-gray-300">{{ formatRupiah(item.ops_jakarta) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Ops Bali</span>
                  <span class="text-gray-600 dark:text-gray-300">{{ formatRupiah(item.ops_bali) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Ops Lombok</span>
                  <span class="text-gray-600 dark:text-gray-300">{{ formatRupiah(item.ops_lombok) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Lain2</span>
                  <span class="text-gray-600 dark:text-gray-300">{{ formatRupiah(item.lain_lain) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Diskon</span>
                  <span class="text-amber-600 dark:text-amber-400">{{ formatRupiah(item.potongan_diskon) }}</span>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div class="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                <div class="text-[10px] text-gray-500 uppercase">Total Biaya</div>
                <div class="text-sm font-semibold text-red-600 dark:text-red-400">{{ formatRupiah(item.total_operational) }}</div>
              </div>
              <div class="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                <div class="text-[10px] text-gray-500 uppercase">Margin</div>
                <div
                  class="text-sm font-semibold"
                  :class="item.margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
                >
                  {{ formatRupiah(item.margin) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div
      v-if="showModal"
      class="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50"
      @click.self="showModal = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-t-xl lg:rounded-xl w-full lg:max-w-md max-h-[85vh] lg:max-h-[90vh] flex flex-col">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold dark:text-gray-100">Input Biaya Operasional</h3>
            <div
              v-if="selectedDbl"
              class="text-sm text-gray-500 dark:text-gray-400 mt-0.5"
            >
              {{ selectedDbl.dbl_number }} - {{ selectedDbl.origin }} - {{ selectedDbl.destination }}
            </div>
          </div>
          <button
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
            @click="showModal = false"
          >
            <span class="text-xl text-gray-400">&times;</span>
          </button>
        </div>
        
        <div class="flex-1 overflow-auto p-4 space-y-4">
          <div
            v-if="selectedDbl"
            class="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800"
          >
            <div class="text-xs text-blue-600 dark:text-blue-400">Total Nominal DBL</div>
            <div class="text-xl font-bold text-blue-700 dark:text-blue-300">{{ formatRupiah(selectedDbl.total_nominal) }}</div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Bayar Supir</label>
              <input 
                :value="formatInputAmount(form.bayar_supir)" 
                type="text"
                inputmode="numeric"
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
                @input="updateAmountField('bayar_supir', $event)"
                @focus="($event.target as HTMLInputElement).select()"
              />
            </div>
            <div>
              <label class="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Solar / BBM</label>
              <input 
                :value="formatInputAmount(form.solar)" 
                type="text"
                inputmode="numeric"
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
                @input="updateAmountField('solar', $event)"
                @focus="($event.target as HTMLInputElement).select()"
              />
            </div>
            <div>
              <label class="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Ongkos Mobil</label>
              <input 
                :value="formatInputAmount(form.ongkos_mobil)" 
                type="text"
                inputmode="numeric"
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
                @input="updateAmountField('ongkos_mobil', $event)"
                @focus="($event.target as HTMLInputElement).select()"
              />
            </div>
            <div>
              <label class="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Ops Jakarta</label>
              <input 
                :value="formatInputAmount(form.ops_jakarta)" 
                type="text"
                inputmode="numeric"
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
                @input="updateAmountField('ops_jakarta', $event)"
                @focus="($event.target as HTMLInputElement).select()"
              />
            </div>
            <div>
              <label class="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Ops Bali</label>
              <input 
                :value="formatInputAmount(form.ops_bali)" 
                type="text"
                inputmode="numeric"
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
                @input="updateAmountField('ops_bali', $event)"
                @focus="($event.target as HTMLInputElement).select()"
              />
            </div>
            <div>
              <label class="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Ops Lombok</label>
              <input 
                :value="formatInputAmount(form.ops_lombok)" 
                type="text"
                inputmode="numeric"
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
                @input="updateAmountField('ops_lombok', $event)"
                @focus="($event.target as HTMLInputElement).select()"
              />
            </div>
            <div>
              <label class="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Lain2</label>
              <input 
                :value="formatInputAmount(form.lain_lain)" 
                type="text"
                inputmode="numeric"
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
                @input="updateAmountField('lain_lain', $event)"
                @focus="($event.target as HTMLInputElement).select()"
              />
            </div>
            <div>
              <label class="block text-xs font-medium mb-1 text-amber-700 dark:text-amber-400">Potongan / Diskon</label>
              <input 
                :value="formatInputAmount(form.potongan_diskon)" 
                type="text"
                inputmode="numeric"
                class="w-full px-3 py-2 text-sm border border-amber-300 dark:border-amber-700 rounded-lg dark:bg-gray-700 dark:text-gray-100"
                @input="updateAmountField('potongan_diskon', $event)"
                @focus="($event.target as HTMLInputElement).select()"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Catatan</label>
            <textarea 
              v-model="form.catatan" 
              rows="2" 
              class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
              placeholder="Catatan tambahan..."
            ></textarea>
          </div>

          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
            <div class="flex justify-between items-center text-sm">
              <span class="text-gray-600 dark:text-gray-400">Total Biaya</span>
              <span class="font-medium text-red-600 dark:text-red-400">{{ formatRupiah(calculatedTotal) }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-600 dark:text-gray-400">Margin</span>
              <div class="text-right">
                <span
                  class="font-bold text-lg"
                  :class="calculatedMargin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
                >
                  {{ formatRupiah(calculatedMargin) }}
                </span>
                <span
                  class="text-xs ml-1"
                  :class="calculatedMargin >= 0 ? 'text-green-500' : 'text-red-500'"
                >
                  ({{ marginPercent }}%)
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
          <Button
            variant="default"
            class="flex-1"
            @click="showModal = false"
          >
            Batal
          </Button>
          <Button
            variant="primary"
            class="flex-1"
            :disabled="saving"
            @click="saveCosts"
          >
            {{ saving ? 'Menyimpan...' : 'Simpan' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
