<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import Button from './ui/Button.vue';
import Badge from './ui/Badge.vue';
import ProgressBar from './ui/ProgressBar.vue';
import { Icon } from '@iconify/vue';

type Row = {
  id: number;
  spb_number: string | null;
  public_code: string | null;
  customer_name: string | null;
  penerima_name: string | null;
  destination: string | null;
  macam_barang: string | null;
  total_colli: number;
  nominal: number;
  sj_returned: boolean;
  sj_returned_at: string | null;
};

type Props = {
  show: boolean;
  dblId: number | null;
  dblNumber?: string | null;
  driverName?: string | null;
  vehiclePlate?: string | null;
  destination?: string | null;
  departureDate?: string | null;
};

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
  stats: [payload: { dblId: number; sjReturned: number; totalShipments: number }];
}>();

const loading = ref(false);
const error = ref<string | null>(null);
const rows = ref<Row[]>([]);
const q = ref('');
const showUnreturnedOnly = ref(false);
const savingIds = ref<Set<number>>(new Set());
const requestId = ref(0);

const totalShipments = computed(() => rows.value.length);
const sjReturnedCount = computed(() => rows.value.reduce((sum, r) => sum + (r.sj_returned ? 1 : 0), 0));
const sjPendingCount = computed(() => Math.max(0, totalShipments.value - sjReturnedCount.value));
const sjReturnedPercent = computed(() => totalShipments.value === 0 ? 0 : (sjReturnedCount.value / totalShipments.value) * 100);

const filteredRows = computed(() => {
  const query = q.value.trim().toLowerCase();
  return rows.value.filter((r) => {
    if (showUnreturnedOnly.value && r.sj_returned) return false;
    if (!query) return true;
    return (
      (r.spb_number || '').toLowerCase().includes(query) ||
      (r.public_code || '').toLowerCase().includes(query) ||
      (r.customer_name || '').toLowerCase().includes(query) ||
      (r.penerima_name || '').toLowerCase().includes(query) ||
      (r.destination || '').toLowerCase().includes(query) ||
      (r.macam_barang || '').toLowerCase().includes(query)
    );
  });
});

function close(): void {
  emit('close');
}

function setSaving(shipmentId: number, saving: boolean): void {
  const next = new Set(savingIds.value);
  if (saving) next.add(shipmentId);
  else next.delete(shipmentId);
  savingIds.value = next;
}

function emitStats(): void {
  if (!props.dblId) return;
  emit('stats', {
    dblId: props.dblId,
    sjReturned: sjReturnedCount.value,
    totalShipments: totalShipments.value
  });
}

async function fetchRows(): Promise<void> {
  if (!props.dblId) return;
  const rid = ++requestId.value;
  loading.value = true;
  error.value = null;
  try {
    const res = await fetch(`/api/dbl?endpoint=items&id=${props.dblId}`);
    if (!res.ok) throw new Error('Gagal memuat list SPB');
    const data = await res.json();
    if (rid !== requestId.value) return;
    const raw = Array.isArray(data.items) ? data.items : [];
    rows.value = raw.map((x: Record<string, unknown>) => ({
      id: Number(x.id || 0),
      spb_number: (x.spb_number as string | null) ?? null,
      public_code: (x.public_code as string | null) ?? null,
      customer_name: (x.customer_name as string | null) ?? null,
      penerima_name: (x.penerima_name as string | null) ?? null,
      destination: (x.destination as string | null) ?? null,
      macam_barang: (x.macam_barang as string | null) ?? null,
      total_colli: Number(x.total_colli || 0),
      nominal: Number(x.nominal || 0),
      sj_returned: Boolean(x.sj_returned),
      sj_returned_at: (x.sj_returned_at as string | null) ?? null
    })).filter((r: Row) => r.id > 0);
    emitStats();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    rows.value = [];
  } finally {
    if (rid === requestId.value) {
      loading.value = false;
    }
  }
}

async function setSjReturned(shipmentId: number, value: boolean): Promise<void> {
  const row = rows.value.find(r => r.id === shipmentId);
  if (!row) return;
  if (savingIds.value.has(shipmentId)) return;

  const prev = row.sj_returned;
  const prevAt = row.sj_returned_at;
  row.sj_returned = value;
  row.sj_returned_at = value ? new Date().toISOString() : null;
  setSaving(shipmentId, true);
  error.value = null;
  try {
    const res = await fetch('/api/shipments?endpoint=update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: shipmentId, sj_returned: value })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({} as any));
      throw new Error(data?.error || 'Gagal menyimpan SJ');
    }
    emitStats();
  } catch (e) {
    row.sj_returned = prev;
    row.sj_returned_at = prevAt;
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    setSaving(shipmentId, false);
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (!props.show) return;
  if (e.key === 'Escape') close();
}

watch(() => props.show, (val) => {
  if (val) {
    void fetchRows();
    window.addEventListener('keydown', onKeydown);
  } else {
    window.removeEventListener('keydown', onKeydown);
    q.value = '';
    showUnreturnedOnly.value = false;
    rows.value = [];
    error.value = null;
    savingIds.value = new Set();
  }
});

watch(() => props.dblId, () => {
  if (props.show) void fetchRows();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 print:hidden">
    <div class="absolute inset-0 bg-black/30" @click="close"></div>

    <div class="absolute inset-y-0 right-0 w-[95vw] max-w-5xl bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl flex flex-col">
      <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div class="min-w-0">
          <div class="font-semibold text-gray-900 dark:text-gray-100 truncate">Checklist SJ Balik</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
            <span class="font-medium">{{ dblNumber || '-' }}</span>
            <span v-if="vehiclePlate"> | {{ vehiclePlate }}</span>
            <span v-if="driverName"> | {{ driverName }}</span>
            <span v-if="destination"> | {{ destination }}</span>
            <span v-if="departureDate"> | {{ departureDate }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="default" class="text-sm" :disabled="loading" @click="fetchRows">
            <Icon icon="mdi:refresh" class="mr-1" /> Refresh
          </Button>
          <Button variant="default" class="text-sm" @click="close">Tutup</Button>
        </div>
      </div>

      <div class="px-4 py-3 space-y-3">
        <div v-if="error" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {{ error }}
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div class="p-2 rounded-lg bg-gray-50 dark:bg-gray-700">
            <div class="text-xs text-gray-500 dark:text-gray-300">Total SPB</div>
            <div class="font-semibold text-gray-900 dark:text-gray-100">{{ totalShipments }}</div>
          </div>
          <div class="p-2 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-900/40">
            <div class="text-xs text-green-700 dark:text-green-300">SJ sudah balik</div>
            <div class="font-semibold text-green-800 dark:text-green-200">{{ sjReturnedCount }}</div>
          </div>
          <div class="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/30 border border-orange-100 dark:border-orange-900/40">
            <div class="text-xs text-orange-700 dark:text-orange-300">SJ belum balik</div>
            <div class="font-semibold text-orange-800 dark:text-orange-200">{{ sjPendingCount }}</div>
          </div>
        </div>

        <ProgressBar :value="sjReturnedPercent" />

        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-300">
            <label class="flex items-center gap-2">
              <input type="checkbox" v-model="showUnreturnedOnly" class="h-3 w-3" />
              Hanya tampilkan SJ belum balik
            </label>
            <Badge v-if="sjReturnedCount === totalShipments && totalShipments > 0" variant="success">Semua SJ balik</Badge>
          </div>
          <input
            v-model="q"
            type="text"
            class="w-full sm:w-80 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
            placeholder="Cari: SPB, RESI, Customer, Penerima, Kota..."
            :disabled="loading"
          >
        </div>
      </div>

      <div class="px-4 pb-4 flex-1 overflow-hidden">
        <div v-if="loading" class="h-32 flex items-center justify-center text-gray-500">Loading...</div>
        <div v-else-if="rows.length === 0" class="h-32 flex items-center justify-center text-gray-400">Tidak ada SPB</div>
        <div v-else class="h-full overflow-x-auto overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 sticky top-0 z-10">
              <tr>
                <th class="px-2 py-2 text-center text-xs font-medium w-12">No</th>
                <th class="px-2 py-2 text-left text-xs font-medium">No. SPB / RESI</th>
                <th class="px-2 py-2 text-left text-xs font-medium">Customer</th>
                <th class="px-2 py-2 text-left text-xs font-medium">Nama Barang</th>
                <th class="px-2 py-2 text-right text-xs font-medium">QTY</th>
                <th class="px-2 py-2 text-left text-xs font-medium">Penerima</th>
                <th class="px-2 py-2 text-center text-xs font-medium">SJ Balik</th>
                <th class="px-2 py-2 text-right text-xs font-medium">Tagihan</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="(r, idx) in filteredRows" :key="r.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td class="px-2 py-2 text-center text-xs text-gray-500">{{ idx + 1 }}</td>
                <td class="px-2 py-2">
                  <div class="text-xs font-mono text-gray-900 dark:text-gray-100">{{ r.spb_number || '-' }}</div>
                  <div class="text-[11px] text-gray-500 dark:text-gray-400">{{ r.public_code || '' }}</div>
                </td>
                <td class="px-2 py-2 text-xs text-gray-700 dark:text-gray-200">{{ r.customer_name || '-' }}</td>
                <td class="px-2 py-2 text-xs text-gray-700 dark:text-gray-200">{{ r.macam_barang || '-' }}</td>
                <td class="px-2 py-2 text-right text-xs text-gray-700 dark:text-gray-200">{{ r.total_colli || 0 }}</td>
                <td class="px-2 py-2">
                  <div class="text-xs text-gray-700 dark:text-gray-200">{{ r.penerima_name || '-' }}</div>
                  <div class="text-[11px] text-gray-500 dark:text-gray-400">{{ r.destination || '' }}</div>
                </td>
                <td class="px-2 py-2 text-center">
                  <div class="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      class="h-4 w-4"
                      :checked="r.sj_returned"
                      :disabled="savingIds.has(r.id)"
                      :title="r.sj_returned_at ? `Balik: ${new Date(r.sj_returned_at).toLocaleString('id-ID')}` : (r.sj_returned ? 'Dokumen SJ sudah balik' : 'Tandai SJ sudah balik')"
                      @change="setSjReturned(r.id, !r.sj_returned)"
                    />
                    <Icon v-if="savingIds.has(r.id)" icon="mdi:loading" class="animate-spin text-gray-400" />
                  </div>
                </td>
                <td class="px-2 py-2 text-right text-xs font-semibold text-gray-900 dark:text-gray-100">
                  {{ new Intl.NumberFormat('id-ID').format(r.nominal || 0) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

