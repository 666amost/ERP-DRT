<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Button from '../components/ui/Button.vue';
import { useFormatters } from '../composables/useFormatters';
import { Icon } from '@iconify/vue';

const { formatRupiah } = useFormatters();

type SalesItem = {
  customer_id: number;
  customer_name: string;
  total_shipments: number;
  total_colli: number;
  total_nominal: number;
  total_paid: number;
  total_outstanding: number;
};

const items = ref<SalesItem[]>([]);
const loading = ref(true);
const dateFrom = ref('');
const dateTo = ref('');
const searchQuery = ref('');

const filteredItems = computed(() => {
  let result = items.value;
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(i => (i.customer_name || '').toLowerCase().includes(q));
  }
  return result;
});

const totalShipments = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.total_shipments || 0), 0));
const totalColli = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.total_colli || 0), 0));
const totalNominal = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.total_nominal || 0), 0));
const totalPaid = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.total_paid || 0), 0));
const totalOutstanding = computed(() => filteredItems.value.reduce((sum, i) => sum + (i.total_outstanding || 0), 0));

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
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  dateFrom.value = firstDay;
  dateTo.value = lastDay;
  loadReport();
}

function setLastMonth() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
  dateFrom.value = firstDay;
  dateTo.value = lastDay;
  loadReport();
}

function resetFilters() {
  dateFrom.value = '';
  dateTo.value = '';
  searchQuery.value = '';
  loadReport();
}

function exportExcel() {
  const headers = ['No', 'Customer', 'SPB', 'Colli', 'Total', 'Lunas', 'Outstanding'];
  const rows = filteredItems.value.map((item, idx) => [
    idx + 1,
    item.customer_name || '-',
    item.total_shipments,
    item.total_colli,
    item.total_nominal,
    item.total_paid,
    item.total_outstanding
  ]);

  let csv = headers.join(',') + '\n';
  rows.forEach(row => {
    csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `sales_report_${dateFrom.value || 'all'}_${dateTo.value || 'all'}.csv`;
  link.click();
}

function printReport() {
  window.print();
}

onMounted(() => {
  setThisMonth();
});
</script>

<template>
  <div class="space-y-4 pb-20 lg:pb-0">
    <div class="flex items-center justify-between flex-wrap gap-3">
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
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="default" @click="setThisMonth">Bulan Ini</Button>
        <Button variant="default" @click="setLastMonth">Bulan Lalu</Button>
        <Button variant="primary" @click="loadReport">Terapkan</Button>
        <Button variant="default" @click="resetFilters">Reset</Button>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 print:hidden">
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div class="text-sm text-gray-500">Customer</div>
        <div class="text-2xl font-bold text-blue-600">{{ filteredItems.length }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div class="text-sm text-gray-500">Total SPB</div>
        <div class="text-2xl font-bold text-green-600">{{ totalShipments }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div class="text-sm text-gray-500">Total Colli</div>
        <div class="text-2xl font-bold text-orange-500">{{ totalColli }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div class="text-sm text-gray-500">Total Sales</div>
        <div class="text-2xl font-bold text-purple-600">{{ formatRupiah(totalNominal) }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div class="text-sm text-gray-500">Outstanding</div>
        <div class="text-2xl font-bold text-red-600">{{ formatRupiah(totalOutstanding) }}</div>
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
              <th class="px-3 py-2 text-left">No</th>
              <th class="px-3 py-2 text-left">Customer</th>
              <th class="px-3 py-2 text-center">SPB</th>
              <th class="px-3 py-2 text-center">Colli</th>
              <th class="px-3 py-2 text-right">Total</th>
              <th class="px-3 py-2 text-right">Lunas</th>
              <th class="px-3 py-2 text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-for="(item, idx) in filteredItems" :key="item.customer_id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="px-3 py-2">{{ idx + 1 }}</td>
              <td class="px-3 py-2 font-medium">{{ item.customer_name || '-' }}</td>
              <td class="px-3 py-2 text-center">{{ item.total_shipments }}</td>
              <td class="px-3 py-2 text-center">{{ item.total_colli }}</td>
              <td class="px-3 py-2 text-right">{{ formatRupiah(item.total_nominal) }}</td>
              <td class="px-3 py-2 text-right text-green-600">{{ formatRupiah(item.total_paid) }}</td>
              <td class="px-3 py-2 text-right text-red-600">{{ formatRupiah(item.total_outstanding) }}</td>
            </tr>
          </tbody>
          <tfoot class="bg-gray-100 dark:bg-gray-700 font-semibold">
            <tr>
              <td colspan="2" class="px-3 py-2 text-right">Total:</td>
              <td class="px-3 py-2 text-center">{{ totalShipments }}</td>
              <td class="px-3 py-2 text-center">{{ totalColli }}</td>
              <td class="px-3 py-2 text-right">{{ formatRupiah(totalNominal) }}</td>
              <td class="px-3 py-2 text-right text-green-600">{{ formatRupiah(totalPaid) }}</td>
              <td class="px-3 py-2 text-right text-red-600">{{ formatRupiah(totalOutstanding) }}</td>
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
