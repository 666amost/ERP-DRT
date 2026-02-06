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

const methodColumns = ['CASH BALI', 'CASH JAKARTA', 'TF BALI', 'TF JAKARTA'] as const;
type MethodColumn = (typeof methodColumns)[number];
const methodColumnSet = new Set<string>(methodColumns);
const methodColumnLabels: Record<MethodColumn, string> = {
  'CASH BALI': 'Cash Bali',
  'CASH JAKARTA': 'Cash Jakarta',
  'TF BALI': 'TF Bali',
  'TF JAKARTA': 'TF Jakarta'
};

function canonicalMethod(method: string | null): string {
  const m = String(method || '').trim().toUpperCase();
  if (!m) return '';
  if (m === 'CASH') return 'CASH JAKARTA';
  if (m === 'TF' || m === 'TRANSFER') return 'TF JAKARTA';
  return m;
}

function getMethodAmount(payment: PaymentHistory, method: MethodColumn): number {
  const canonical = canonicalMethod(payment.payment_method);
  return canonical === method ? Number(payment.final_amount || 0) : 0;
}

function getMethodPillText(method: MethodColumn): string {
  return methodColumnLabels[method] || method;
}

function getMethodPillClasses(method: MethodColumn): string {
  return method.startsWith('CASH')
    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
    : 'bg-primary-light dark:bg-gray-700 text-primary-dark dark:text-gray-200';
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

const methodTotals = computed<Record<MethodColumn, number>>(() => {
  const totals = Object.fromEntries(methodColumns.map(m => [m, 0])) as Record<MethodColumn, number>;
  for (const p of filteredPayments.value) {
    const canonical = canonicalMethod(p.payment_method);
    if (methodColumnSet.has(canonical)) {
      totals[canonical as MethodColumn] += Number(p.final_amount || 0);
    }
  }
  return totals;
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
  const headers = ['No', 'Invoice', 'Customer', 'Original', 'Diskon', 'Bayar', ...methodColumns, 'Tanggal'];
  const rows = filteredPayments.value.map((p, idx) => [
    idx + 1,
    p.invoice_number || '-',
    p.customer_name || '-',
    p.original_amount,
    p.discount,
    p.final_amount,
    ...methodColumns.map(m => getMethodAmount(p, m)),
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

      <div class="flex flex-wrap gap-2 items-center text-xs text-gray-600 dark:text-gray-400">
        <span class="font-medium">Filter aktif:</span>
        <Badge v-if="selectedCustomer" variant="default">Customer: {{ selectedCustomer }}</Badge>
        <Badge v-if="selectedMethod" variant="default">Metode: {{ selectedMethod }}</Badge>
        <Badge v-if="dateFrom || dateTo" variant="default">Tanggal: {{ dateFrom || '-' }} s/d {{ dateTo || '-' }}</Badge>
        <Badge v-if="searchQuery" variant="default">Cari: {{ searchQuery }}</Badge>
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

      <div v-else>
        <div class="hidden lg:block">
          <table class="w-full text-sm table-fixed">
            <thead class="bg-gray-50 dark:bg-gray-700 border-b">
              <tr>
                <th class="px-2 py-2 text-left w-10">No</th>
                <th class="px-2 py-2 text-left">Invoice / Customer</th>
                <th class="px-2 py-2 text-right w-28">
                  <div class="font-medium">Bayar</div>
                  <div class="text-[10px] leading-3 text-gray-500 dark:text-gray-400 font-normal">Total</div>
                </th>
                <th v-for="m in methodColumns" :key="m" class="px-1 py-2 text-right w-24 text-[11px] leading-4">
                  {{ methodColumnLabels[m] }}
                </th>
                <th class="px-2 py-2 text-left w-24">Tanggal</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="(p, idx) in filteredPayments" :key="p.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ idx + 1 }}</td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">
                  <div class="font-medium text-gray-900 dark:text-gray-100 truncate" :title="p.invoice_number || '-'">
                    {{ p.invoice_number || '-' }}
                  </div>
                  <div class="text-[11px] text-gray-600 dark:text-gray-400 truncate" :title="p.customer_name || '-'">
                    {{ p.customer_name || '-' }}
                  </div>
                  <div class="text-[11px] text-gray-500 dark:text-gray-400">
                    <span>Orig: {{ formatRupiah(p.original_amount) }}</span>
                    <span class="mx-1">&middot;</span>
                    <span>Disk: {{ p.discount ? formatRupiah(p.discount) : '-' }}</span>
                  </div>
                </td>
                <td class="px-2 py-2 text-right tabular-nums text-[11px] font-medium text-gray-700 dark:text-gray-300">
                  {{ formatRupiah(p.final_amount) }}
                </td>
                <td
                  v-for="m in methodColumns"
                  :key="m"
                  class="px-1 py-2 text-center text-[11px]"
                >
                  <template v-if="canonicalMethod(p.payment_method) === m">
                    <div class="flex justify-center">
                      <span
                        class="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-4 max-w-full truncate whitespace-nowrap"
                        :class="getMethodPillClasses(m)"
                        :title="getMethodPillText(m)"
                      >
                        {{ getMethodPillText(m) }}
                      </span>
                    </div>
                  </template>
                  <span v-else class="text-gray-400 dark:text-gray-500">-</span>
                </td>
                <td class="px-2 py-2 text-gray-700 dark:text-gray-300">{{ formatDate(p.payment_date) }}</td>
              </tr>
            </tbody>
            <tfoot class="bg-gray-100 dark:bg-gray-700 font-semibold">
              <tr>
                <td colspan="2" class="px-2 py-2 text-right text-gray-700 dark:text-gray-200 whitespace-nowrap">Total:</td>
                <td class="px-2 py-2 text-right tabular-nums text-[11px] font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {{ formatRupiah(totalPaid) }}
                </td>
                <td
                  v-for="m in methodColumns"
                  :key="m"
                  class="px-2 py-2 text-center align-top border-l border-gray-200 dark:border-gray-600"
                >
                  <div class="text-[10px] leading-3 text-gray-500 dark:text-gray-300 font-medium whitespace-nowrap">
                    {{ methodColumnLabels[m] }}
                  </div>
                  <div
                    class="tabular-nums text-[11px] leading-4 font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap"
                    :title="formatRupiah(methodTotals[m])"
                  >
                    {{ methodTotals[m] ? formatRupiah(methodTotals[m]) : '-' }}
                  </div>
                </td>
                <td class="border-l border-gray-200 dark:border-gray-600"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="lg:hidden space-y-3">
          <div v-for="p in filteredPayments" :key="p.id" class="border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-white dark:bg-gray-800">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ p.invoice_number || '-' }}</div>
                <div class="text-xs text-gray-600 dark:text-gray-400 truncate">{{ p.customer_name || '-' }}</div>
              </div>
              <div class="text-right">
                <div class="text-sm font-bold text-green-600">{{ formatRupiah(p.final_amount) }}</div>
                <div class="text-xs text-gray-500">{{ formatDate(p.payment_date) }}</div>
              </div>
            </div>

            <div class="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              <span>Orig: {{ formatRupiah(p.original_amount) }}</span>
              <span class="mx-1">&middot;</span>
              <span>Disk: {{ p.discount ? formatRupiah(p.discount) : '-' }}</span>
            </div>

            <div class="mt-2 space-y-1 text-[11px] leading-4">
              <div v-for="m in methodColumns" :key="m" class="grid grid-cols-[1fr_auto] gap-2">
                <span class="text-gray-500 dark:text-gray-400">{{ methodColumnLabels[m] }}</span>
                <template v-if="canonicalMethod(p.payment_method) === m">
                  <span
                    class="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-4 max-w-full truncate whitespace-nowrap"
                    :class="getMethodPillClasses(m)"
                    :title="getMethodPillText(m)"
                  >
                    {{ getMethodPillText(m) }}
                  </span>
                </template>
                <span v-else class="text-right text-gray-400 dark:text-gray-500">-</span>
              </div>
            </div>
          </div>

          <div class="border-t border-gray-200 dark:border-gray-700 pt-3 text-sm font-semibold space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-gray-700 dark:text-gray-300">Total Dibayar</span>
              <span class="text-green-600">{{ formatRupiah(totalPaid) }}</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <Badge v-for="m in methodColumns" :key="m" variant="default">
                {{ methodColumnLabels[m] }}: {{ formatRupiah(methodTotals[m]) }}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
