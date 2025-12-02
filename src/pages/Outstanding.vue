<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Button from '../components/ui/Button.vue';
import { useFormatters } from '../composables/useFormatters';
import { Icon } from '@iconify/vue';

const { formatDate, formatRupiah } = useFormatters();

type OutstandingItem = {
  id: number;
  spb_number: string | null;
  public_code: string | null;
  customer_id: number | null;
  customer_name: string | null;
  origin: string;
  destination: string;
  total_colli: number;
  nominal: number;
  created_at: string;
  invoice_id: number | null;
  invoice_number: string | null;
};

const items = ref<OutstandingItem[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const selectedCustomer = ref('');
const dateFrom = ref('');
const dateTo = ref('');

const customers = computed(() => {
  const names = items.value.map(i => i.customer_name).filter(Boolean);
  return [...new Set(names)].sort();
});

const filteredItems = computed(() => {
  let result = items.value;
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(i =>
      (i.public_code || '').toLowerCase().includes(q) ||
      (i.spb_number || '').toLowerCase().includes(q) ||
      (i.customer_name || '').toLowerCase().includes(q)
    );
  }
  if (selectedCustomer.value) {
    result = result.filter(i => i.customer_name === selectedCustomer.value);
  }
  if (dateFrom.value) {
    result = result.filter(i => new Date(i.created_at) >= new Date(dateFrom.value));
  }
  if (dateTo.value) {
    result = result.filter(i => new Date(i.created_at) <= new Date(dateTo.value + 'T23:59:59'));
  }
  return result;
});

const totalOutstanding = computed(() => {
  return filteredItems.value.reduce((sum, i) => sum + (i.nominal || 0), 0);
});

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
  dateFrom.value = '';
  dateTo.value = '';
}

function exportExcel() {
  const headers = ['No', 'Kode', 'SPB', 'Customer', 'Rute', 'Colli', 'Nominal', 'Tanggal'];
  const rows = filteredItems.value.map((item, idx) => [
    idx + 1,
    item.public_code || '-',
    item.spb_number || '-',
    item.customer_name || '-',
    `${item.origin} → ${item.destination}`,
    item.total_colli,
    item.nominal,
    formatDate(item.created_at)
  ]);

  let csv = headers.join(',') + '\n';
  rows.forEach(row => {
    csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `outstanding_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}

onMounted(() => {
  loadOutstanding();
});
</script>

<template>
  <div class="space-y-4 pb-20 lg:pb-0">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="text-xl font-semibold dark:text-gray-100">Outstanding (Belum Lunas)</div>
      <Button variant="primary" class="text-sm" @click="exportExcel">
        <Icon icon="mdi:download" class="mr-1" /> Export
      </Button>
    </div>

    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Cari</label>
          <input
            v-model="searchQuery"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Kode, SPB, Customer..."
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
          <label class="block text-sm font-medium mb-1">Dari Tanggal</label>
          <input v-model="dateFrom" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Sampai Tanggal</label>
          <input v-model="dateTo" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
      </div>
      <div class="flex gap-2">
        <Button variant="default" @click="resetFilters">Reset Filter</Button>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div class="flex items-center justify-between mb-4">
        <div class="text-sm text-gray-600 dark:text-gray-400">
          {{ filteredItems.length }} item
        </div>
        <div class="text-lg font-semibold text-red-600">
          Total: {{ formatRupiah(totalOutstanding) }}
        </div>
      </div>

      <div v-if="loading" class="flex items-center justify-center h-32">
        <div class="text-gray-500">Loading...</div>
      </div>

      <div v-else-if="filteredItems.length === 0" class="text-center py-8 text-gray-500">
        Tidak ada data outstanding
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-gray-700 border-b">
            <tr>
              <th class="px-3 py-2 text-left">No</th>
              <th class="px-3 py-2 text-left">Kode</th>
              <th class="px-3 py-2 text-left">SPB</th>
              <th class="px-3 py-2 text-left">Customer</th>
              <th class="px-3 py-2 text-left">Rute</th>
              <th class="px-3 py-2 text-center">Colli</th>
              <th class="px-3 py-2 text-right">Nominal</th>
              <th class="px-3 py-2 text-left">Tanggal</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-for="(item, idx) in filteredItems" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="px-3 py-2">{{ idx + 1 }}</td>
              <td class="px-3 py-2 font-medium">{{ item.public_code || '-' }}</td>
              <td class="px-3 py-2">{{ item.spb_number || '-' }}</td>
              <td class="px-3 py-2">{{ item.customer_name || '-' }}</td>
              <td class="px-3 py-2">{{ item.origin }} → {{ item.destination }}</td>
              <td class="px-3 py-2 text-center">{{ item.total_colli }}</td>
              <td class="px-3 py-2 text-right font-medium text-red-600">{{ formatRupiah(item.nominal) }}</td>
              <td class="px-3 py-2">{{ formatDate(item.created_at) }}</td>
            </tr>
          </tbody>
          <tfoot class="bg-gray-100 dark:bg-gray-700 font-semibold">
            <tr>
              <td colspan="6" class="px-3 py-2 text-right">Total Outstanding:</td>
              <td class="px-3 py-2 text-right text-red-600">{{ formatRupiah(totalOutstanding) }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
</template>
