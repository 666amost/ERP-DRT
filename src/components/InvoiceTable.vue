<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import http from '../lib/http';
import { useFormatters } from '../composables/useFormatters';

const { formatRupiah, formatDate } = useFormatters();

type Invoice = { id: number; invoice_number: string; customer_name: string; amount: number; status: string; issued_at: string };

const invoices = ref<Invoice[]>([]);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const res = await http.get(`/dashboard?endpoint=invoices&page=${page.value}&limit=${pageSize.value}`);
    const data = res.data;
    invoices.value = data.items || [];
    total.value = data.meta?.total || invoices.value.length;
  } catch (e) {
    console.error('Failed to load invoices table', e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch([page, pageSize], load);
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 card">
    <div class="font-medium mb-3 dark:text-gray-100">Invoice Terbaru</div>
    <div class="max-h-[50vh] overflow-auto smooth-scroll pr-2">
      <div v-if="loading" class="text-sm text-gray-500">Loading...</div>
      <ul v-else class="divide-y dark:divide-gray-700">
        <li v-for="inv in invoices" :key="inv.id" class="py-3 flex items-center justify-between">
          <div>
            <div class="text-sm font-medium dark:text-gray-100">{{ inv.invoice_number }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ inv.customer_name }} • {{ formatDate(inv.issued_at) }}</div>
          </div>
          <div class="flex items-center gap-3">
            <div class="text-sm font-semibold dark:text-gray-100">{{ formatRupiah(inv.amount) }}</div>
            <div class="text-xs px-3 py-1 rounded-lg" :class="inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'">{{ inv.status === 'paid' ? 'Paid' : 'Pending' }}</div>
          </div>
        </li>
      </ul>
    </div>
    <div class="mt-4 flex justify-between items-center">
      <div class="text-sm text-gray-500">Total: {{ total }}</div>
      <div class="flex gap-2 items-center">
        <button @click="page = Math.max(1, page - 1)" class="px-3 py-1 rounded-lg bg-gray-100">Prev</button>
        <div class="text-sm">{{ page }} / {{ Math.max(1, Math.ceil(total / pageSize)) }}</div>
        <button @click="page = page + 1" class="px-3 py-1 rounded-lg bg-gray-100">Next</button>
      </div>
    </div>
  </div>
</template>
