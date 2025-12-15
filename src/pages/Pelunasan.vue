<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Button from '../components/ui/Button.vue';
import Badge from '../components/ui/Badge.vue';
import { useFormatters } from '../composables/useFormatters';
import { Icon } from '@iconify/vue';

const { formatDate, formatRupiah, toWIBDateString, toWIBMidnight } = useFormatters();

type PaymentHistory = {
  id: number;
  invoice_id: number;
  invoice_number: string | null;
  customer_name: string | null;
  original_amount: number;
  discount: number;
  final_amount: number;
  payment_date: string;
  payment_method: string | null;
  reference_no: string | null;
  notes: string | null;
};

const payments = ref<PaymentHistory[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const selectedCustomer = ref('');
const selectedMethod = ref('');
const dateFrom = ref('');
const dateTo = ref('');

function normalizeMethod(value?: string | null): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const customers = computed(() => {
  const names = payments.value.map(p => p.customer_name).filter(Boolean);
  return [...new Set(names)].sort();
});

const methodOptions = computed(() => [
  'CASH BALI',
  'CASH JAKARTA',
  'TF BALI',
  'TF JAKARTA',
  'CICILAN'
]);

const filteredPayments = computed(() => {
  let result = payments.value;
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(p =>
      (p.invoice_number || '').toLowerCase().includes(q) ||
      (p.customer_name || '').toLowerCase().includes(q) ||
      (p.payment_method || '').toLowerCase().includes(q) ||
      (p.notes || '').toLowerCase().includes(q) ||
      String(p.final_amount || 0).includes(q)
    );
  }
  if (selectedCustomer.value) {
    result = result.filter(p => p.customer_name === selectedCustomer.value);
  }
  if (selectedMethod.value) {
    const target = normalizeMethod(selectedMethod.value);
    result = result.filter(p => normalizeMethod(p.payment_method) === target);
  }
  if (dateFrom.value) {
    result = result.filter(p => new Date(p.payment_date) >= new Date(dateFrom.value));
  }
  if (dateTo.value) {
    result = result.filter(p => new Date(p.payment_date) <= new Date(dateTo.value + 'T23:59:59'));
  }
  return result;
});

const totalPaid = computed(() => {
  return filteredPayments.value.reduce((sum, p) => sum + (p.final_amount || 0), 0);
});

const totalDiscount = computed(() => {
  return filteredPayments.value.reduce((sum, p) => sum + (p.discount || 0), 0);
});

async function loadPayments() {
  loading.value = true;
  try {
    // Guard: never load full-history by accident
    if (!dateFrom.value && !dateTo.value) {
      setRangeDefault();
    }

    const params = new URLSearchParams({ endpoint: 'payment-history' });
    if (dateFrom.value) params.set('from', dateFrom.value);
    if (dateTo.value) params.set('to', dateTo.value);
    const res = await fetch(`/api/invoices?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      payments.value = data.items || [];
    }
  } catch (e) {
    console.error('Failed to load payment history:', e);
  } finally {
    loading.value = false;
  }
}

function getDefaultRange(): { from: string; to: string } {
  const todayStr = toWIBDateString();
  const todayMid = toWIBMidnight(todayStr);
  const start = new Date(todayMid);
  start.setDate(start.getDate() - 1);
  return { from: toWIBDateString(start), to: todayStr };
}

function setRangeToday(): void {
  const todayStr = toWIBDateString();
  dateFrom.value = todayStr;
  dateTo.value = todayStr;
}

function setRangeDefault(): void {
  const { from, to } = getDefaultRange();
  dateFrom.value = from;
  dateTo.value = to;
}

function setRangeLast7Days(): void {
  const todayStr = toWIBDateString();
  const todayMid = toWIBMidnight(todayStr);
  const start = new Date(todayMid);
  start.setDate(start.getDate() - 6);
  dateFrom.value = toWIBDateString(start);
  dateTo.value = todayStr;
}

function setRangeThisMonth(): void {
  const todayStr = toWIBDateString();
  const todayMid = toWIBMidnight(todayStr);
  const start = new Date(todayMid.getFullYear(), todayMid.getMonth(), 1);
  dateFrom.value = toWIBDateString(start);
  dateTo.value = todayStr;
}

async function applyFilters(): Promise<void> {
  await loadPayments();
}

function resetFilters() {
  searchQuery.value = '';
  selectedCustomer.value = '';
  selectedMethod.value = '';
  setRangeDefault();
  applyFilters();
}

function exportExcel() {
  const headers = ['No', 'Invoice', 'Customer', 'Original', 'Diskon', 'Bayar', 'Metode', 'No. Ref', 'Catatan', 'Tanggal'];
  const rows = filteredPayments.value.map((p, idx) => [
    idx + 1,
    p.invoice_number || '-',
    p.customer_name || '-',
    p.original_amount,
    p.discount,
    p.final_amount,
    p.payment_method || '-',
    p.reference_no || '-',
    p.notes || '-',
    formatDate(p.payment_date)
  ]);

  let csv = headers.join(',') + '\n';
  rows.forEach(row => {
    csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `pelunasan_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}

function getMethodVariant(method: string | null): 'default' | 'success' | 'info' {
  if (!method) return 'default';
  const m = method.toLowerCase();
  if (m === 'cash' || m.startsWith('cash ')) return 'success';
  if (m === 'transfer' || m.startsWith('transfer ') || m === 'tf' || m.startsWith('tf ')) return 'info';
  return 'default';
}

onMounted(() => {
  setRangeDefault();
  loadPayments();
});
</script>

<template>
  <div class="space-y-4 pb-20 lg:pb-0">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="text-xl font-semibold dark:text-gray-100">Pelunasan (Riwayat Pembayaran)</div>
      <Button variant="primary" class="text-sm" @click="exportExcel">
        <Icon icon="mdi:download" class="mr-1" /> Export
      </Button>
    </div>

    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Cari</label>
          <input
            v-model="searchQuery"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Invoice, Customer..."
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Customer</label>
          <select v-model="selectedCustomer" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
            <option value="">Semua Customer</option>
            <option v-for="c in customers" :key="c || 'unknown'" :value="c">{{ c || '-' }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Metode</label>
          <select v-model="selectedMethod" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
            <option value="">Semua Metode</option>
            <option v-for="m in methodOptions" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Dari Tanggal</label>
          <input v-model="dateFrom" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Sampai Tanggal</label>
          <input v-model="dateTo" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
      </div>
      <div class="flex flex-wrap gap-2 items-center">
        <Button variant="default" size="sm" :disabled="loading" @click="() => { setRangeToday(); applyFilters(); }">Hari Ini</Button>
        <Button variant="default" size="sm" :disabled="loading" @click="() => { setRangeLast7Days(); applyFilters(); }">Minggu Ini (7 hari)</Button>
        <Button variant="default" size="sm" :disabled="loading" @click="() => { setRangeThisMonth(); applyFilters(); }">Bulan Ini</Button>
        <div class="flex-1"></div>
        <Button variant="primary" size="sm" :disabled="loading" @click="applyFilters">Filter</Button>
        <Button variant="default" size="sm" :disabled="loading" @click="resetFilters">Reset</Button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div class="text-sm text-gray-500">Total Dibayar</div>
        <div class="text-2xl font-bold text-green-600">{{ formatRupiah(totalPaid) }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div class="text-sm text-gray-500">Total Diskon</div>
        <div class="text-2xl font-bold text-orange-500">{{ formatRupiah(totalDiscount) }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div class="text-sm text-gray-500">Jumlah Transaksi</div>
        <div class="text-2xl font-bold text-blue-600">{{ filteredPayments.length }}</div>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div v-if="loading" class="flex items-center justify-center h-32">
        <div class="text-gray-500">Loading...</div>
      </div>

      <div v-else-if="filteredPayments.length === 0" class="text-center py-8 text-gray-500">
        Tidak ada riwayat pembayaran
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-gray-700 border-b">
            <tr>
              <th class="px-3 py-2 text-left">No</th>
              <th class="px-3 py-2 text-left">Invoice</th>
              <th class="px-3 py-2 text-left">Customer</th>
              <th class="px-3 py-2 text-right">Original</th>
              <th class="px-3 py-2 text-right">Diskon</th>
              <th class="px-3 py-2 text-right">Bayar</th>
              <th class="px-3 py-2 text-center">Metode</th>
              <th class="px-3 py-2 text-left">No. Ref</th>
              <th class="px-3 py-2 text-left">Catatan</th>
              <th class="px-3 py-2 text-left">Tanggal</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-for="(p, idx) in filteredPayments" :key="p.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="px-3 py-2">{{ idx + 1 }}</td>
              <td class="px-3 py-2 font-medium">{{ p.invoice_number || '-' }}</td>
              <td class="px-3 py-2">{{ p.customer_name || '-' }}</td>
              <td class="px-3 py-2 text-right">{{ formatRupiah(p.original_amount) }}</td>
              <td class="px-3 py-2 text-right text-orange-500">{{ p.discount ? formatRupiah(p.discount) : '-' }}</td>
              <td class="px-3 py-2 text-right font-medium text-green-600">{{ formatRupiah(p.final_amount) }}</td>
              <td class="px-3 py-2 text-center">
                <Badge :variant="getMethodVariant(p.payment_method)">{{ p.payment_method || '-' }}</Badge>
              </td>
              <td class="px-3 py-2 text-gray-600 dark:text-gray-400">{{ p.reference_no || '-' }}</td>
              <td class="px-3 py-2 text-gray-600 dark:text-gray-400 max-w-[200px] truncate" :title="p.notes || ''">{{ p.notes || '-' }}</td>
              <td class="px-3 py-2">{{ formatDate(p.payment_date) }}</td>
            </tr>
          </tbody>
          <tfoot class="bg-gray-100 dark:bg-gray-700 font-semibold">
            <tr>
              <td colspan="5" class="px-3 py-2 text-right">Total:</td>
              <td class="px-3 py-2 text-right text-green-600">{{ formatRupiah(totalPaid) }}</td>
              <td colspan="4"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
</template>
