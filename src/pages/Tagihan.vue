<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Button from '../components/ui/Button.vue';
import { useFormatters } from '../composables/useFormatters';

type BillingArea = 'BALI' | 'JAKARTA';

type TagihanItem = {
  id: number;
  spb_number: string | null;
  public_code: string | null;
  customer_id: number | null;
  customer_name: string | null;
  pengirim_name: string | null;
  penerima_name: string | null;
  origin: string;
  destination: string;
  total_colli: number;
  total_weight: number;
  nominal: number;
  remaining_amount: number;
  created_at: string;
  dbl_id: number | null;
  dbl_number: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_plate: string | null;
  dbl_date: string | null;
  invoice_id: number | null;
  invoice_number: string | null;
  invoice_status: string | null;
  sj_returned: boolean;
  jenis: string | null;
  billing_area: BillingArea;
};

type TagihanApiItem = Partial<Omit<TagihanItem, 'billing_area'>> & {
  billing_area?: string | null;
};

type TagihanSection = {
  key: BillingArea;
  title: string;
  subtitle: string;
  badgeClass: string;
  items: TagihanItem[];
  total: number;
};

type BillingView = BillingArea | 'ALL';

const { formatDate, formatRupiah, toWIBDateString, toWIBMidnight } = useFormatters();

const items = ref<TagihanItem[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const selectedCustomer = ref('');
const selectedDbl = ref('');
const sjFilter = ref<'all' | 'returned' | 'not_returned'>('all');
const dateFrom = ref('');
const dateTo = ref('');
const activeSection = ref<BillingView>('ALL');

function isBillingArea(value: string | null | undefined): value is BillingArea {
  return value === 'BALI' || value === 'JAKARTA';
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeDbl(value?: string | null): string | null {
  if (!value) return null;
  return value.toString().trim().replace(/^(DBL[:\-\s]+)/i, '').trim() || null;
}

function classifyBillingArea(jenis?: string | null): BillingArea | null {
  const normalized = String(jenis || '').trim().toUpperCase();
  if (normalized === 'FRANCO') return 'BALI';
  if (normalized === 'TJ' || normalized === 'TAGIHAN JAKARTA' || normalized === 'TAGIHAN_JAKARTA') return 'JAKARTA';
  return null;
}

function getRemainingAmount(item: TagihanItem): number {
  return (item.remaining_amount ?? item.nominal) ?? 0;
}

const customers = computed<string[]>(() => {
  const names = items.value.map((item) => item.customer_name).filter(isNonEmptyString);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
});

const dblNumbers = computed<string[]>(() => {
  const numbers = items.value
    .map((item) => normalizeDbl(item.dbl_number))
    .filter((val): val is string => isNonEmptyString(val));
  return [...new Set(numbers)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
});

const hasUnassignedDbl = computed(() => items.value.some((item) => !item.dbl_number));

const filteredItems = computed<TagihanItem[]>(() => {
  let result = items.value.filter((item) => getRemainingAmount(item) > 0);

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase();
    result = result.filter((item) =>
      (item.public_code || '').toLowerCase().includes(q) ||
      (item.spb_number || '').toLowerCase().includes(q) ||
      (item.customer_name || '').toLowerCase().includes(q) ||
      (item.pengirim_name || '').toLowerCase().includes(q) ||
      (item.penerima_name || '').toLowerCase().includes(q) ||
      (item.invoice_number || '').toLowerCase().includes(q) ||
      (item.origin || '').toLowerCase().includes(q) ||
      (item.destination || '').toLowerCase().includes(q) ||
      (item.dbl_number || '').toLowerCase().includes(q)
    );
  }

  if (selectedCustomer.value) {
    result = result.filter((item) => item.customer_name === selectedCustomer.value);
  }

  if (selectedDbl.value === '__no_dbl') {
    result = result.filter((item) => !item.dbl_number);
  } else if (selectedDbl.value) {
    result = result.filter((item) => normalizeDbl(item.dbl_number) === selectedDbl.value);
  }

  if (sjFilter.value === 'returned') {
    result = result.filter((item) => item.sj_returned);
  } else if (sjFilter.value === 'not_returned') {
    result = result.filter((item) => !item.sj_returned);
  }

  if (dateFrom.value) {
    result = result.filter((item) => new Date(item.created_at) >= new Date(dateFrom.value));
  }
  if (dateTo.value) {
    result = result.filter((item) => new Date(item.created_at) <= new Date(`${dateTo.value}T23:59:59`));
  }

  return result;
});

const baliItems = computed(() => filteredItems.value.filter((item) => item.billing_area === 'BALI'));
const jakartaItems = computed(() => filteredItems.value.filter((item) => item.billing_area === 'JAKARTA'));

const totalBali = computed(() => baliItems.value.reduce((sum, item) => sum + getRemainingAmount(item), 0));
const totalJakarta = computed(() => jakartaItems.value.reduce((sum, item) => sum + getRemainingAmount(item), 0));
const totalAll = computed(() => totalBali.value + totalJakarta.value);

const sections = computed<TagihanSection[]>(() => [
  {
    key: 'BALI',
    title: 'Tagihan Bali',
    subtitle: 'Metode SPB: FRANCO',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    items: baliItems.value,
    total: totalBali.value
  },
  {
    key: 'JAKARTA',
    title: 'Tagihan Jakarta',
    subtitle: 'Metode SPB: Tagihan Jakarta (TJ)',
    badgeClass: 'bg-sky-100 text-sky-700',
    items: jakartaItems.value,
    total: totalJakarta.value
  }
]);

const visibleSections = computed<TagihanSection[]>(() => {
  if (activeSection.value === 'ALL') return sections.value;
  return sections.value.filter((section) => section.key === activeSection.value);
});

function mapItem(raw: TagihanApiItem): TagihanItem | null {
  const rawArea = String(raw.billing_area || '').toUpperCase();
  const area = isBillingArea(rawArea) ? rawArea : classifyBillingArea(raw.jenis);
  if (!area) return null;

  return {
    id: Number(raw.id || 0),
    spb_number: isNonEmptyString(raw.spb_number) ? raw.spb_number : null,
    public_code: isNonEmptyString(raw.public_code) ? raw.public_code : null,
    customer_id: typeof raw.customer_id === 'number' ? raw.customer_id : null,
    customer_name: isNonEmptyString(raw.customer_name) ? raw.customer_name : null,
    pengirim_name: isNonEmptyString(raw.pengirim_name) ? raw.pengirim_name : null,
    penerima_name: isNonEmptyString(raw.penerima_name) ? raw.penerima_name : null,
    origin: String(raw.origin || '-'),
    destination: String(raw.destination || '-'),
    total_colli: Number(raw.total_colli || 0),
    total_weight: Number(raw.total_weight || 0),
    nominal: Number(raw.nominal || 0),
    remaining_amount: Number(raw.remaining_amount ?? raw.nominal ?? 0),
    created_at: String(raw.created_at || ''),
    dbl_id: typeof raw.dbl_id === 'number' ? raw.dbl_id : null,
    dbl_number: isNonEmptyString(raw.dbl_number) ? raw.dbl_number : null,
    driver_name: isNonEmptyString(raw.driver_name) ? raw.driver_name : null,
    driver_phone: isNonEmptyString(raw.driver_phone) ? raw.driver_phone : null,
    vehicle_plate: isNonEmptyString(raw.vehicle_plate) ? raw.vehicle_plate : null,
    dbl_date: isNonEmptyString(raw.dbl_date) ? raw.dbl_date : null,
    invoice_id: typeof raw.invoice_id === 'number' ? raw.invoice_id : null,
    invoice_number: isNonEmptyString(raw.invoice_number) ? raw.invoice_number : null,
    invoice_status: isNonEmptyString(raw.invoice_status) ? raw.invoice_status : null,
    sj_returned: Boolean(raw.sj_returned),
    jenis: isNonEmptyString(raw.jenis) ? raw.jenis.toUpperCase() : null,
    billing_area: area
  };
}

function getDefaultRange(): { from: string; to: string } {
  const today = toWIBDateString();
  const todayMidnight = toWIBMidnight(today);
  const start = new Date(todayMidnight);
  start.setDate(start.getDate() - 1);
  return { from: toWIBDateString(start), to: today };
}

function setRangeToday(): void {
  const today = toWIBDateString();
  dateFrom.value = today;
  dateTo.value = today;
}

function setRangeDefault(): void {
  const { from, to } = getDefaultRange();
  dateFrom.value = from;
  dateTo.value = to;
}

function setRangeLast7Days(): void {
  const today = toWIBDateString();
  const todayMidnight = toWIBMidnight(today);
  const start = new Date(todayMidnight);
  start.setDate(start.getDate() - 6);
  dateFrom.value = toWIBDateString(start);
  dateTo.value = today;
}

function setRangeThisMonth(): void {
  const today = toWIBDateString();
  const todayMidnight = toWIBMidnight(today);
  const start = new Date(todayMidnight.getFullYear(), todayMidnight.getMonth(), 1);
  dateFrom.value = toWIBDateString(start);
  dateTo.value = today;
}

async function loadTagihan(): Promise<void> {
  loading.value = true;
  try {
    if (!dateFrom.value && !dateTo.value) {
      setRangeDefault();
    }

    const params = new URLSearchParams({ endpoint: 'tagihan' });
    if (dateFrom.value) params.set('from', dateFrom.value);
    if (dateTo.value) params.set('to', dateTo.value);

    const res = await fetch(`/api/invoices?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json() as { items?: TagihanApiItem[] };
    const rawItems = Array.isArray(data.items) ? data.items : [];
    const mapped = rawItems.map(mapItem).filter((item): item is TagihanItem => item !== null);
    items.value = mapped;
  } catch (error) {
    console.error('Failed to load tagihan:', error);
    items.value = [];
  } finally {
    loading.value = false;
  }
}

async function applyFilters(): Promise<void> {
  await loadTagihan();
}

function resetFilters(): void {
  searchQuery.value = '';
  selectedCustomer.value = '';
  selectedDbl.value = '';
  sjFilter.value = 'all';
  activeSection.value = 'ALL';
  setRangeDefault();
  void applyFilters();
}

function selectSection(view: BillingView): void {
  activeSection.value = view;
}

function applyToday(): void {
  setRangeToday();
  void applyFilters();
}

function applyLast7Days(): void {
  setRangeLast7Days();
  void applyFilters();
}

function applyThisMonth(): void {
  setRangeThisMonth();
  void applyFilters();
}

onMounted(() => {
  setRangeDefault();
  void loadTagihan();
});
</script>

<template>
  <div class="space-y-4 pb-20 lg:pb-0">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <div class="text-xl font-semibold dark:text-gray-100">Tagihan Bali & Jakarta</div>
        <div class="text-xs text-gray-500 dark:text-gray-400">Sumber: SPB (metode FRANCO / Tagihan Jakarta)</div>
      </div>
      <Button variant="default" size="sm" :disabled="loading" @click="applyFilters">Refresh</Button>
    </div>

    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        <div class="lg:col-span-2">
          <label class="block text-sm font-medium mb-1 dark:text-gray-300">Cari</label>
          <input
            v-model="searchQuery"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm"
            placeholder="Kode, SPB, customer, DBL, rute..."
          >
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-300">Customer</label>
          <select v-model="selectedCustomer" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm">
            <option value="">Semua Customer</option>
            <option v-for="customer in customers" :key="customer" :value="customer">{{ customer }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-300">DBL</label>
          <select v-model="selectedDbl" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm">
            <option value="">Semua DBL</option>
            <option v-if="hasUnassignedDbl" value="__no_dbl">Belum ada DBL</option>
            <option v-for="dbl in dblNumbers" :key="dbl" :value="dbl">DBL {{ dbl }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-300">SJ Balik</label>
          <select v-model="sjFilter" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm">
            <option value="all">Semua</option>
            <option value="returned">Sudah balik</option>
            <option value="not_returned">Belum balik</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-300">Dari</label>
          <input v-model="dateFrom" type="date" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-300">Sampai</label>
          <input v-model="dateTo" type="date" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm">
        </div>
      </div>

      <div class="flex flex-wrap gap-2 items-center">
        <Button variant="default" size="sm" :disabled="loading" @click="applyToday">Hari Ini</Button>
        <Button variant="default" size="sm" :disabled="loading" @click="applyLast7Days">Minggu Ini (7 Hari)</Button>
        <Button variant="default" size="sm" :disabled="loading" @click="applyThisMonth">Bulan Ini</Button>
        <div class="flex-1" />
        <Button variant="primary" size="sm" :disabled="loading" @click="applyFilters">Filter</Button>
        <Button variant="default" size="sm" :disabled="loading" @click="resetFilters">Reset</Button>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
      <div class="text-[11px] text-gray-500 dark:text-gray-400 mb-2 px-1">Klik kartu untuk filter list tagihan</div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          type="button"
          class="text-left border rounded-xl p-4 transition-all duration-150"
          :class="activeSection === 'BALI'
            ? 'border-emerald-400 ring-2 ring-emerald-100 bg-emerald-50/50 dark:bg-emerald-900/20'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-emerald-300 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10'"
          :aria-pressed="activeSection === 'BALI'"
          @click="selectSection('BALI')"
        >
          <div class="text-xs text-gray-500 dark:text-gray-400">Tagihan Bali</div>
          <div class="text-lg font-semibold text-emerald-600">{{ formatRupiah(totalBali) }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ baliItems.length }} item</div>
          <div v-if="activeSection === 'BALI'" class="text-[11px] mt-1 font-medium text-emerald-700 dark:text-emerald-300">
            Aktif
          </div>
        </button>

        <button
          type="button"
          class="text-left border rounded-xl p-4 transition-all duration-150"
          :class="activeSection === 'JAKARTA'
            ? 'border-sky-400 ring-2 ring-sky-100 bg-sky-50/50 dark:bg-sky-900/20'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-sky-300 hover:bg-sky-50/30 dark:hover:bg-sky-900/10'"
          :aria-pressed="activeSection === 'JAKARTA'"
          @click="selectSection('JAKARTA')"
        >
          <div class="text-xs text-gray-500 dark:text-gray-400">Tagihan Jakarta</div>
          <div class="text-lg font-semibold text-sky-600">{{ formatRupiah(totalJakarta) }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ jakartaItems.length }} item</div>
          <div v-if="activeSection === 'JAKARTA'" class="text-[11px] mt-1 font-medium text-sky-700 dark:text-sky-300">
            Aktif
          </div>
        </button>

        <button
          type="button"
          class="text-left border rounded-xl p-4 transition-all duration-150"
          :class="activeSection === 'ALL'
            ? 'border-red-400 ring-2 ring-red-100 bg-red-50/40 dark:bg-red-900/20'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-red-300 hover:bg-red-50/20 dark:hover:bg-red-900/10'"
          :aria-pressed="activeSection === 'ALL'"
          @click="selectSection('ALL')"
        >
          <div class="text-xs text-gray-500 dark:text-gray-400">Total Keseluruhan</div>
          <div class="text-lg font-semibold text-red-600">{{ formatRupiah(totalAll) }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ filteredItems.length }} item</div>
          <div v-if="activeSection === 'ALL'" class="text-[11px] mt-1 font-medium text-red-700 dark:text-red-300">
            Aktif
          </div>
        </button>
      </div>
    </div>

    <div v-if="loading" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center text-gray-500 dark:text-gray-400">
      Memuat data tagihan...
    </div>

    <template v-else>
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="text-sm text-gray-600 dark:text-gray-300">
          List ditampilkan:
          <span class="font-semibold">
            {{
              activeSection === 'ALL'
                ? 'Semua (Bali + Jakarta)'
                : activeSection === 'BALI'
                  ? 'Tagihan Bali'
                  : 'Tagihan Jakarta'
            }}
          </span>
        </div>
        <Button
          v-if="activeSection !== 'ALL'"
          variant="default"
          size="sm"
          @click="selectSection('ALL')"
        >
          Tampilkan Semua
        </Button>
      </div>

      <div
        v-for="section in visibleSections"
        :key="section.key"
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
      >
        <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <div class="flex items-center gap-2">
              <div class="text-base font-semibold dark:text-gray-100">{{ section.title }}</div>
              <span class="px-2 py-0.5 rounded-full text-xs" :class="section.badgeClass">{{ section.subtitle }}</span>
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ section.items.length }} item</div>
          </div>
          <div class="text-lg font-semibold text-red-600">{{ formatRupiah(section.total) }}</div>
        </div>

        <div v-if="section.items.length === 0" class="py-6 text-center text-gray-500 dark:text-gray-400">
          Tidak ada data tagihan {{ section.key.toLowerCase() }} pada filter ini.
        </div>

        <div v-else>
          <div class="hidden lg:block overflow-x-auto">
            <table class="w-full text-sm table-fixed">
              <thead class="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                <tr>
                  <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 w-10">No</th>
                  <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 w-44">Shipment</th>
                  <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 w-40">Customer</th>
                  <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 w-36">Rute</th>
                  <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 w-24">DBL</th>
                  <th class="px-2 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300 w-14">Kg</th>
                  <th class="px-2 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300 w-24">Sisa</th>
                  <th class="px-2 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300 w-16">SJ</th>
                  <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 w-20">Tanggal</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr
                  v-for="(item, index) in section.items"
                  :key="`${section.key}-${item.id}-${item.invoice_id || 0}-${index}`"
                  class="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ index + 1 }}</td>
                  <td class="px-2 py-2 text-gray-700 dark:text-gray-300">
                    <div class="font-medium text-gray-900 dark:text-gray-100 truncate" :title="item.public_code || '-'">{{ item.public_code || '-' }}</div>
                    <div class="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      SPB: {{ item.spb_number || '-' }}
                      <span class="mx-1">|</span>
                      {{ item.invoice_number || 'Belum invoice' }}
                    </div>
                  </td>
                  <td class="px-2 py-2 text-gray-700 dark:text-gray-300">
                    <div class="font-medium truncate" :title="item.customer_name || '-'">{{ item.customer_name || '-' }}</div>
                    <div class="text-[11px] text-gray-500 dark:text-gray-400 truncate">{{ item.pengirim_name || '-' }} -> {{ item.penerima_name || '-' }}</div>
                  </td>
                  <td class="px-2 py-2 text-gray-700 dark:text-gray-300 truncate" :title="`${item.origin} -> ${item.destination}`">{{ item.origin }} -> {{ item.destination }}</td>
                  <td class="px-2 py-2 text-gray-700 dark:text-gray-300">
                    <div>{{ item.dbl_number || '-' }}</div>
                    <div v-if="item.driver_name" class="text-[11px] text-gray-500 dark:text-gray-400 truncate">{{ item.driver_name }}</div>
                  </td>
                  <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">{{ item.total_weight.toFixed(1) }}</td>
                  <td class="px-2 py-2 text-right font-medium text-red-600">{{ formatRupiah(getRemainingAmount(item)) }}</td>
                  <td class="px-2 py-2 text-center">
                    <span
                      class="px-2 py-0.5 rounded-full text-xs"
                      :class="item.sj_returned ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'"
                    >
                      {{ item.sj_returned ? 'Sudah' : 'Belum' }}
                    </span>
                  </td>
                  <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ formatDate(item.created_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="lg:hidden space-y-3">
            <div
              v-for="item in section.items"
              :key="`${section.key}-mobile-${item.id}-${item.invoice_id || 0}`"
              class="border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-white dark:bg-gray-800"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ item.public_code || '-' }}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">SPB: {{ item.spb_number || '-' }}</div>
                  <div class="text-[11px] text-gray-500 dark:text-gray-400">Invoice: {{ item.invoice_number || 'Belum invoice' }}</div>
                </div>
                <div class="text-right">
                  <div class="text-sm font-bold text-red-600">{{ formatRupiah(getRemainingAmount(item)) }}</div>
                  <div class="text-xs text-gray-500">{{ formatDate(item.created_at) }}</div>
                </div>
              </div>
              <div class="mt-2 text-xs text-gray-600 dark:text-gray-400">
                <div class="font-medium">{{ item.customer_name || '-' }}</div>
                <div>{{ item.pengirim_name || '-' }} -> {{ item.penerima_name || '-' }}</div>
                <div>{{ item.origin }} -> {{ item.destination }}</div>
              </div>
              <div class="mt-2 flex gap-2 flex-wrap">
                <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-300">{{ item.total_colli }} colli</span>
                <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-300">{{ item.total_weight.toFixed(1) }} kg</span>
                <span
                  class="px-2 py-0.5 rounded-full text-xs"
                  :class="item.sj_returned ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'"
                >
                  SJ: {{ item.sj_returned ? 'Sudah' : 'Belum' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
