<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import Badge from '../components/ui/Badge.vue';
import ProgressBar from '../components/ui/ProgressBar.vue';
import { useFormatters } from '../composables/useFormatters';

const { formatDate } = useFormatters();

type Shipment = {
  id: number;
  public_code: string | null;
  spb_number: string | null;
  origin: string;
  destination: string;
  status: string;
  carrier_name: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  eta: string | null;
  customer_name: string | null;
  dbl_number?: string | null;
  vehicle_plate?: string | null;
  dbl_status?: string | null;
};

const shipments = ref<Shipment[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const route = useRoute();
const statusFilter = ref('');

const statusOptions = [
  { value: '', label: 'Semua Status' },
  { value: 'DRAFT', label: 'Draft', variant: 'default' },
  { value: 'READY', label: 'Ready', variant: 'info' },
  { value: 'LOADING', label: 'Loading', variant: 'warning' },
  { value: 'IN_TRANSIT', label: 'In Transit', variant: 'info' },
  { value: 'DELIVERED', label: 'Delivered', variant: 'success' }
];

async function loadShipments() {
  loading.value = true;
  try {
    const statusParam = statusFilter.value ? `&status=${statusFilter.value}` : '';
    const searchParam = searchQuery.value.trim() ? `&search=${encodeURIComponent(searchQuery.value)}` : '';
    const res = await fetch(`/api/shipments?endpoint=list${statusParam}${searchParam}`);
    const data = await res.json();
    shipments.value = data.items || [];
  } catch (e) {
    console.error('Failed to load shipments:', e);
  } finally {
    loading.value = false;
  }
}

function getProgress(status: string): number {
  switch (status) {
    case 'DRAFT': return 0;
    case 'READY': return 25;
    case 'LOADING': return 50;
    case 'IN_TRANSIT': return 75;
    case 'DELIVERED': return 100;
    default: return 0;
  }
}

function getStatusVariant(status: string): 'default' | 'info' | 'warning' | 'success' {
  const opt = statusOptions.find(o => o.value === status);
  return (opt?.variant || 'default') as 'default' | 'info' | 'warning' | 'success';
}

onMounted(() => {
  if (route.query.q) {
    searchQuery.value = String(route.query.q || '');
  }
  loadShipments();
});

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(searchQuery, () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadShipments();
  }, 300);
});

// Reflect route query changes (when header triggers new search)
watch(() => route.query.q, (val) => {
  const v = val ? String(val) : '';
  if (v !== searchQuery.value) searchQuery.value = v;
});

watch(statusFilter, () => {
  loadShipments();
});
</script>

<template>
  <div class="space-y-4 pb-20 lg:pb-0 overflow-x-hidden">
    <div class="text-xl font-semibold">
      Pelacakan Pengiriman
    </div>

    <!-- Stack on mobile, inline on larger screens -->
    <div class="flex flex-col sm:flex-row gap-3 min-w-0">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Cari kode tracking, kota, DBL, driver..."
        class="w-full sm:flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 dark:border-gray-600"
      >
      <select
        v-model="statusFilter"
        class="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 dark:border-gray-600"
      >
        <option
          v-for="opt in statusOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </option>
      </select>
    </div>

    <div
      v-if="loading"
      class="flex items-center justify-center h-64"
    >
      <div class="text-gray-500 dark:text-gray-400">
        Loading...
      </div>
    </div>

    <div
      v-else
      class="space-y-3"
    >
      <div
        v-if="shipments.length === 0"
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center text-gray-500 dark:text-gray-300 card"
      >
        Tidak ada shipment yang sesuai
      </div>

      <div
        v-for="ship in shipments"
        :key="ship.id"
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3 card break-words min-w-0"
      >
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-base lg:text-lg truncate min-w-0">
              {{ ship.public_code }}
            </div>
            <div v-if="ship.spb_number" class="mt-0.5">
              <span class="inline-block text-[11px] leading-tight bg-black text-white rounded px-1.5 py-0.5">
                SPB: {{ ship.spb_number }}
              </span>
            </div>
            <div class="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1 flex flex-wrap gap-2">
              <span
                v-if="ship.dbl_number"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100"
              >
                {{ ship.dbl_number }}
              </span>
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              >
                {{ ship.driver_name || 'Belum ada supir' }}
                <span v-if="ship.driver_phone" class="hidden sm:inline text-[11px] font-normal text-gray-500 dark:text-gray-400">| {{ ship.driver_phone }}</span>
              </span>
              <span
                v-if="ship.vehicle_plate"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              >
                {{ ship.vehicle_plate }}
              </span>
            </div>
          </div>
          <Badge :variant="getStatusVariant(ship.status)" class="flex-shrink-0">
            {{ statusOptions.find(o => o.value === ship.status)?.label || ship.status }}
          </Badge>
        </div>

        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-sm flex-wrap">
          <div class="flex-1 min-w-0">
            <div class="text-gray-500 text-xs">
              Origin
            </div>
            <div class="font-medium truncate min-w-0">
              {{ ship.origin }}
            </div>
          </div>
          <div class="text-gray-400 dark:text-gray-500 flex-shrink-0">
            ->
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-gray-500 text-xs">
              Destination
            </div>
            <div class="font-medium truncate min-w-0">
              {{ ship.destination }}
            </div>
          </div>
        </div>

        <div>
          <div class="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Progress
          </div>
          <ProgressBar :value="getProgress(ship.status)" />
        </div>

        <div class="flex items-center justify-between text-sm flex-wrap gap-2">
          <div class="truncate max-w-full">
            <span class="text-gray-500 dark:text-gray-400 text-xs">Customer:</span>
            <span class="font-medium ml-1 dark:text-gray-100">{{ ship.customer_name || '-' }}</span>
          </div>
          <div v-if="ship.eta" class="flex-shrink-0">
            <span class="text-gray-500 text-xs">ETA:</span>
            <span class="font-medium ml-1">{{ formatDate(ship.eta) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
