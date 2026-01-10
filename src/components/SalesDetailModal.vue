<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Button from './ui/Button.vue';

type ShipmentRow = {
  id: number;
  spb_number: string | null;
  public_code: string | null;
  customer_id: number | null;
  customer_name: string | null;
  origin: string | null;
  destination: string | null;
  total_colli: number | null;
  total_weight: number;
  nominal: number;
  created_at: string;
  dbl_id: number | null;
};

type Props = {
  show: boolean;
  customerId?: number | null;
  customerName?: string | null;
  from: string;
  to: string;
};

const props = defineProps<Props>();
const emit = defineEmits<{ close: [] }>();

const loading = ref(false);
const rows = ref<ShipmentRow[]>([]);
const currentPage = ref(1);
const itemsPerPage = ref(100);

const totalShipments = computed(() => rows.value.length);
const totalColli = computed(() => rows.value.reduce((s, r) => s + (Number(r.total_colli) || 0), 0));
const totalWeight = computed(() => rows.value.reduce((s, r) => s + (Number(r.total_weight) || 0), 0));
const totalNominal = computed(() => rows.value.reduce((s, r) => s + (Number(r.nominal) || 0), 0));

const totalPages = computed(() => Math.ceil(rows.value.length / itemsPerPage.value));

const paginatedRows = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return rows.value.slice(start, end);
});

async function fetchDetail(): Promise<void> {
  if (!props.show) return;
  loading.value = true;
  currentPage.value = 1;
  try {
    const p = new URLSearchParams({ endpoint: 'sales-detail', from: props.from || '', to: props.to || '' });
    if (props.customerId && props.customerId > 0) p.set('customer_id', String(props.customerId));
    else if (props.customerName) p.set('customer_name', String(props.customerName));
    const res = await fetch(`/api/invoices?${p.toString()}`);
    if (res.ok) {
      const data = await res.json();
      rows.value = Array.isArray(data.items) ? data.items : [];
    }
  } finally {
    loading.value = false;
  }
}

function goToPage(page: number): void {
  if (page < 1 || page > totalPages.value) return;
  currentPage.value = page;
}

watch(() => props.show, (val) => { if (val) fetchDetail(); });
watch(() => [props.customerId, props.customerName, props.from, props.to], () => { if (props.show) fetchDetail(); });

function close(): void { emit('close'); }
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/30" @click="close"></div>
    <div class="relative w-[95vw] max-w-5xl bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div class="font-semibold">Detail Shipments</div>
        <Button variant="default" class="text-sm" @click="close">Tutup</Button>
      </div>
      <div class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
        <div class="mb-2">Customer: <span class="font-medium">{{ customerName || customerId }}</span></div>
        <div class="mb-2">Periode: <span class="font-medium">{{ from }} - {{ to }}</span></div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div class="p-2 bg-gray-50 dark:bg-gray-700 rounded">
            <div class="text-xs">SPB</div>
            <div class="font-semibold">{{ totalShipments }}</div>
          </div>
          <div class="p-2 bg-gray-50 dark:bg-gray-700 rounded">
            <div class="text-xs">Colli</div>
            <div class="font-semibold">{{ totalColli }}</div>
          </div>
          <div class="p-2 bg-gray-50 dark:bg-gray-700 rounded">
            <div class="text-xs">Berat</div>
            <div class="font-semibold">{{ totalWeight.toFixed(1) }}</div>
          </div>
          <div class="p-2 bg-gray-50 dark:bg-gray-700 rounded">
            <div class="text-xs">Total Nominal</div>
            <div class="font-semibold">{{ new Intl.NumberFormat('id-ID').format(totalNominal) }}</div>
          </div>
        </div>
      </div>
      <div class="px-4 pb-4">
        <div v-if="loading" class="h-32 flex items-center justify-center text-gray-500">Loading...</div>
        <div v-else>
          <div class="overflow-x-auto max-h-[400px] overflow-y-auto border border-gray-200 dark:border-gray-600 rounded">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 sticky top-0 z-10">
                <tr>
                  <th class="px-2 py-2 text-left text-xs font-medium">SPB</th>
                  <th class="px-2 py-2 text-left text-xs font-medium">Tujuan</th>
                  <th class="px-2 py-2 text-center text-xs font-medium">Colli</th>
                  <th class="px-2 py-2 text-right text-xs font-medium">Berat</th>
                  <th class="px-2 py-2 text-right text-xs font-medium">Nominal</th>
                  <th class="px-2 py-2 text-left text-xs font-medium">Tanggal</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-for="r in paginatedRows" :key="r.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td class="px-2 py-2">{{ r.spb_number || '-' }}</td>
                  <td class="px-2 py-2">{{ r.destination || '-' }}</td>
                  <td class="px-2 py-2 text-center">{{ r.total_colli || 0 }}</td>
                  <td class="px-2 py-2 text-right">{{ (r.total_weight || 0).toFixed(1) }}</td>
                  <td class="px-2 py-2 text-right">{{ new Intl.NumberFormat('id-ID').format(r.nominal || 0) }}</td>
                  <td class="px-2 py-2">{{ new Date(r.created_at).toLocaleDateString('id-ID') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div v-if="totalPages > 1" class="mt-4 flex items-center justify-between">
            <div class="text-xs text-gray-600 dark:text-gray-400">
              Menampilkan {{ (currentPage - 1) * itemsPerPage + 1 }} - {{ Math.min(currentPage * itemsPerPage, totalShipments) }} dari {{ totalShipments }} SPB
            </div>
            <div class="flex gap-1">
              <Button 
                variant="default" 
                class="text-xs px-2 py-1" 
                :disabled="currentPage === 1"
                @click="goToPage(currentPage - 1)"
              >
                Prev
              </Button>
              <template v-for="page in totalPages" :key="page">
                <Button 
                  v-if="page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)"
                  :variant="page === currentPage ? 'primary' : 'default'" 
                  class="text-xs px-3 py-1"
                  @click="goToPage(page)"
                >
                  {{ page }}
                </Button>
                <span v-else-if="page === currentPage - 2 || page === currentPage + 2" class="px-2 py-1 text-gray-500">...</span>
              </template>
              <Button 
                variant="default" 
                class="text-xs px-2 py-1" 
                :disabled="currentPage === totalPages"
                @click="goToPage(currentPage + 1)"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
