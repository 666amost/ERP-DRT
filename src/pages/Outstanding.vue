<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Button from '../components/ui/Button.vue';
import { useFormatters } from '../composables/useFormatters';
import { Icon } from '@iconify/vue';
import { exportToExcel } from '../lib/excelExport';
import { getCompany, type CompanyProfile } from '../lib/company';

const LOGO_URL = '/brand/logo.png';

const { formatDate, formatRupiah } = useFormatters();

type MeUser = { id: number; email: string; name: string | null; role: string };

type OutstandingItem = {
  id: number;
  spb_number: string | null;
  public_code: string | null;
  customer_id: number | null;
  customer_name: string | null;
  origin: string;
  destination: string;
  total_colli: number;
  total_weight: number;
  nominal: number;
  remaining_amount: number;
  created_at: string;
  dbl_id: number | null;
  dbl_number: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  vehicle_plate?: string | null;
  dbl_date?: string | null;
  invoice_id: number | null;
  invoice_number: string | null;
  invoice_status: string | null;
};

const items = ref<OutstandingItem[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const selectedCustomer = ref('');
const selectedDbl = ref('');
const dateFrom = ref('');
const dateTo = ref('');
const company = ref<CompanyProfile | null>(null);
const currentUser = ref<MeUser | null>(null);

const customers = computed(() => {
  const names = items.value.map(i => i.customer_name).filter(Boolean);
  return [...new Set(names)].sort();
});

const dblNumbers = computed(() => {
  const numbers = items.value.map(i => i.dbl_number).filter((n): n is string => Boolean(n));
  return [...new Set(numbers)].sort();
});

const hasUnassignedDbl = computed(() => items.value.some(i => !i.dbl_number));

const filteredItems = computed(() => {
  let result = items.value;
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(i =>
      (i.public_code || '').toLowerCase().includes(q) ||
      (i.spb_number || '').toLowerCase().includes(q) ||
      (i.dbl_number || '').toLowerCase().includes(q) ||
      (i.customer_name || '').toLowerCase().includes(q) ||
      (i.invoice_number || '').toLowerCase().includes(q) ||
      (i.origin || '').toLowerCase().includes(q) ||
      (i.destination || '').toLowerCase().includes(q)
    );
  }
  if (selectedCustomer.value) {
    result = result.filter(i => i.customer_name === selectedCustomer.value);
  }
  if (selectedDbl.value === '__no_dbl') {
    result = result.filter(i => !i.dbl_number);
  } else if (selectedDbl.value) {
    result = result.filter(i => i.dbl_number === selectedDbl.value);
  }
  if (dateFrom.value) {
    result = result.filter(i => new Date(i.created_at) >= new Date(dateFrom.value));
  }
  if (dateTo.value) {
    result = result.filter(i => new Date(i.created_at) <= new Date(dateTo.value + 'T23:59:59'));
  }
  return result;
});

const totalOutstanding = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.remaining_amount || i.nominal || 0), 0));
const totalColli = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.total_colli || 0), 0));
const totalWeight = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.total_weight || 0), 0));

async function loadOutstanding() {
  loading.value = true;
  try {
    const res = await fetch('/api/invoices?endpoint=outstanding');
    if (res.ok) {
      const data = await res.json();
      items.value = data.items || [];
    }
  } catch (e) {
    console.error('Failed to load outstanding:', e);
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  searchQuery.value = '';
  selectedCustomer.value = '';
  selectedDbl.value = '';
  dateFrom.value = '';
  dateTo.value = '';
}

function exportExcel() {
  const exportData = filteredItems.value.map((item, idx) => ({
    no: idx + 1,
    kode: item.public_code || '-',
    spb: item.spb_number || '-',
    dbl: item.dbl_number || '-',
    customer: item.customer_name || '-',
    rute: `${item.origin} → ${item.destination}`,
    colli: item.total_colli,
    kg: item.total_weight || 0,
    nominal: item.nominal,
    sisa: item.remaining_amount || item.nominal,
    tanggal: formatDate(item.created_at)
  }));

  exportToExcel({
    filename: `outstanding_${new Date().toISOString().slice(0, 10)}`,
    sheetName: 'Outstanding',
    title: 'LAPORAN OUTSTANDING (BELUM LUNAS)',
    subtitle: dateFrom.value && dateTo.value ? `Periode: ${formatDate(dateFrom.value)} - ${formatDate(dateTo.value)}` : 'Semua Periode',
    columns: [
      { header: 'No', key: 'no', width: 5, type: 'number', align: 'center' },
      { header: 'Kode', key: 'kode', width: 18, type: 'text' },
      { header: 'SPB', key: 'spb', width: 12, type: 'text' },
      { header: 'DBL', key: 'dbl', width: 14, type: 'text' },
      { header: 'Customer', key: 'customer', width: 20, type: 'text' },
      { header: 'Rute', key: 'rute', width: 28, type: 'text' },
      { header: 'Colli', key: 'colli', width: 8, type: 'number', align: 'center' },
      { header: 'Kg', key: 'kg', width: 10, type: 'number', align: 'right' },
      { header: 'Nominal', key: 'nominal', width: 15, type: 'currency', align: 'right' },
      { header: 'Sisa', key: 'sisa', width: 15, type: 'currency', align: 'right' },
      { header: 'Tanggal', key: 'tanggal', width: 14, type: 'text', align: 'center' }
    ],
    data: exportData,
    totals: {
      colli: totalColli.value,
      kg: totalWeight.value,
      sisa: totalOutstanding.value
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

onMounted(async () => {
  loadOutstanding();
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
      <div class="text-xl font-semibold dark:text-gray-100">Outstanding (Belum Lunas)</div>
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
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-300">Cari</label>
          <input
            v-model="searchQuery"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm"
            placeholder="Kode, SPB, Customer, DBL..."
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-300">Customer</label>
          <select v-model="selectedCustomer" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm">
            <option value="">Semua Customer</option>
            <option v-for="c in customers" :key="c || 'unknown'" :value="c">{{ c || '-' }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-300">DBL</label>
          <select v-model="selectedDbl" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm">
            <option value="">Semua DBL</option>
            <option v-if="hasUnassignedDbl" value="__no_dbl">Belum ada DBL</option>
            <option v-for="d in dblNumbers" :key="d" :value="d">DBL {{ d }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-300">Dari Tanggal</label>
          <input v-model="dateFrom" type="date" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-300">Sampai Tanggal</label>
          <input v-model="dateTo" type="date" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm" />
        </div>
      </div>
      <div class="flex gap-2">
        <Button variant="default" size="sm" @click="resetFilters">Reset Filter</Button>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 print:hidden">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div class="text-sm text-gray-600 dark:text-gray-400">
          {{ filteredItems.length }} item
        </div>
        <div class="text-lg font-semibold text-red-600">
          Total: {{ formatRupiah(totalOutstanding) }}
        </div>
      </div>

      <div v-if="loading" class="flex items-center justify-center h-32">
        <div class="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>

      <div v-else-if="filteredItems.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
        Tidak ada data outstanding
      </div>

      <div v-else>
        <div class="hidden lg:block overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              <tr>
                <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">No</th>
                <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Kode</th>
                <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">SPB</th>
                <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">DBL</th>
                <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Customer</th>
                <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Rute</th>
                <th class="px-2 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300">Colli</th>
                <th class="px-2 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Kg</th>
                <th class="px-2 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Nominal</th>
                <th class="px-2 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Sisa</th>
                <th class="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Tanggal</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="(item, idx) in filteredItems" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ idx + 1 }}</td>
                <td class="px-2 py-2 font-medium text-gray-900 dark:text-gray-100">{{ item.public_code || '-' }}</td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ item.spb_number || '-' }}</td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">
                  <div class="text-xs">
                    <div>{{ item.dbl_number || '-' }}</div>
                    <div v-if="item.driver_name" class="text-gray-500">{{ item.driver_name }}</div>
                  </div>
                </td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ item.customer_name || '-' }}</td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ item.origin }} → {{ item.destination }}</td>
                <td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{{ item.total_colli }}</td>
                <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">{{ (item.total_weight || 0).toFixed(1) }}</td>
                <td class="px-2 py-2 text-right text-gray-600 dark:text-gray-400">{{ formatRupiah(item.nominal) }}</td>
                <td class="px-2 py-2 text-right font-medium text-red-600">{{ formatRupiah(item.remaining_amount || item.nominal) }}</td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ formatDate(item.created_at) }}</td>
              </tr>
            </tbody>
            <tfoot class="bg-gray-100 dark:bg-gray-700 font-semibold">
              <tr>
                <td colspan="6" class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">Total:</td>
                <td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{{ totalColli }}</td>
                <td class="px-2 py-2 text-right text-gray-700 dark:text-gray-300">{{ totalWeight.toFixed(1) }}</td>
                <td class="px-2 py-2 text-right text-gray-500"></td>
                <td class="px-2 py-2 text-right text-red-600">{{ formatRupiah(totalOutstanding) }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="lg:hidden space-y-3">
          <div v-for="item in filteredItems" :key="item.id" class="border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-white dark:bg-gray-800">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ item.public_code || '-' }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">SPB: {{ item.spb_number || '-' }}</div>
                <div v-if="item.dbl_number || hasUnassignedDbl" class="text-[11px] text-gray-500 dark:text-gray-400">
                  DBL: {{ item.dbl_number || 'Belum ada' }}
                  <span v-if="item.driver_name" class="text-gray-400">| {{ item.driver_name }}</span>
                </div>
              </div>
              <div class="text-right">
                <div class="text-sm font-bold text-red-600">{{ formatRupiah(item.remaining_amount || item.nominal) }}</div>
                <div class="text-xs text-gray-500">{{ formatDate(item.created_at) }}</div>
              </div>
            </div>
            <div class="mt-2 text-xs text-gray-600 dark:text-gray-400">
              <div class="font-medium">{{ item.customer_name || '-' }}</div>
              <div>{{ item.origin }} → {{ item.destination }}</div>
            </div>
            <div class="mt-2 flex gap-2 flex-wrap">
              <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-300">{{ item.total_colli }} colli</span>
              <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-300">{{ (item.total_weight || 0).toFixed(1) }} kg</span>
            </div>
          </div>
          <div class="border-t border-gray-200 dark:border-gray-700 pt-3 text-sm font-semibold flex justify-between">
            <span class="text-gray-700 dark:text-gray-300">Total Outstanding</span>
            <span class="text-red-600">{{ formatRupiah(totalOutstanding) }}</span>
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
        <div class="print-title">LAPORAN OUTSTANDING (BELUM LUNAS)</div>
        <div class="print-subtitle">{{ dateFrom && dateTo ? `Periode: ${formatDate(dateFrom)} - ${formatDate(dateTo)}` : 'Semua Periode' }}</div>
      </div>
      <table class="print-table">
        <thead>
          <tr>
            <th class="text-center" style="width: 5%">No</th>
            <th style="width: 12%">Kode</th>
            <th style="width: 7%">SPB</th>
            <th style="width: 10%">DBL</th>
            <th style="width: 13%">Customer</th>
            <th style="width: 16%">Rute</th>
            <th class="text-center" style="width: 6%">Colli</th>
            <th class="text-right" style="width: 7%">Kg</th>
            <th class="text-right" style="width: 9%">Nominal</th>
            <th class="text-right" style="width: 9%">Sisa</th>
            <th class="text-center" style="width: 6%">Tanggal</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in filteredItems" :key="item.id">
            <td class="text-center">{{ index + 1 }}</td>
            <td>{{ item.public_code || '-' }}</td>
            <td>{{ item.spb_number || '-' }}</td>
            <td>
              {{ item.dbl_number || '-' }}
              <span v-if="item.driver_name">({{ item.driver_name }})</span>
            </td>
            <td>{{ item.customer_name || '-' }}</td>
            <td>{{ item.origin }} → {{ item.destination }}</td>
            <td class="text-center">{{ item.total_colli }}</td>
            <td class="text-right">{{ (item.total_weight || 0).toFixed(1) }}</td>
            <td class="text-right">{{ formatRupiah(item.nominal) }}</td>
            <td class="text-right">{{ formatRupiah(item.remaining_amount || item.nominal) }}</td>
            <td class="text-center">{{ formatDate(item.created_at) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="6" class="text-right">Total:</td>
            <td class="text-center">{{ totalColli }}</td>
            <td class="text-right">{{ totalWeight.toFixed(1) }}</td>
            <td class="text-right"></td>
            <td class="text-right">{{ formatRupiah(totalOutstanding) }}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <div class="print-footer">
        <div class="print-date">Dicetak: {{ formatDateTime() }}</div>
        <div class="print-user">Oleh: {{ currentUser?.name || currentUser?.email || '-' }}</div>
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

  .print-user {
    font-weight: 500;
  }
}
</style>

