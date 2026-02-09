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

type SetSjOptions = {
  clearError?: boolean;
  showNotice?: boolean;
};

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
  stats: [payload: { dblId: number; sjReturned: number; totalShipments: number }];
}>();

const loading = ref(false);
const bulkSaving = ref(false);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);
const rows = ref<Row[]>([]);
const q = ref('');
const sjFilter = ref<'all' | 'pending' | 'returned'>('all');
const savingIds = ref<Set<number>>(new Set());
const requestId = ref(0);

const totalShipments = computed(() => rows.value.length);
const sjReturnedCount = computed(() => rows.value.reduce((sum, r) => sum + (r.sj_returned ? 1 : 0), 0));
const sjPendingCount = computed(() => Math.max(0, totalShipments.value - sjReturnedCount.value));
const sjReturnedPercent = computed(() => (totalShipments.value === 0 ? 0 : (sjReturnedCount.value / totalShipments.value) * 100));

const filteredRows = computed(() => {
  const query = q.value.trim().toLowerCase();
  return rows.value.filter((r) => {
    if (sjFilter.value === 'pending' && r.sj_returned) return false;
    if (sjFilter.value === 'returned' && !r.sj_returned) return false;
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

const visibleTotal = computed(() => filteredRows.value.length);
const visibleReturnedCount = computed(() => filteredRows.value.reduce((sum, r) => sum + (r.sj_returned ? 1 : 0), 0));
const visiblePendingCount = computed(() => Math.max(0, visibleTotal.value - visibleReturnedCount.value));

function close(): void {
  emit('close');
}

function formatNominal(value: number): string {
  return new Intl.NumberFormat('id-ID').format(Number(value || 0));
}

function formatReturnedAt(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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
  notice.value = null;
  try {
    const res = await fetch(`/api/dbl?endpoint=items&id=${props.dblId}`);
    if (!res.ok) throw new Error('Gagal memuat list SPB');
    const data = await res.json();
    if (rid !== requestId.value) return;
    const raw = Array.isArray(data.items) ? data.items : [];
    rows.value = raw
      .map((x: Record<string, unknown>) => ({
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
      }))
      .filter((r: Row) => r.id > 0);
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

async function setSjReturned(shipmentId: number, value: boolean, options: SetSjOptions = {}): Promise<boolean> {
  const row = rows.value.find((r) => r.id === shipmentId);
  if (!row) return false;
  if (savingIds.value.has(shipmentId)) return false;

  const prev = row.sj_returned;
  const prevAt = row.sj_returned_at;
  row.sj_returned = value;
  row.sj_returned_at = value ? new Date().toISOString() : null;
  setSaving(shipmentId, true);

  if (options.clearError !== false) {
    error.value = null;
  }

  try {
    const res = await fetch('/api/shipments?endpoint=update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: shipmentId, sj_returned: value })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message =
        typeof (data as { error?: unknown }).error === 'string'
          ? ((data as { error?: unknown }).error as string)
          : 'Gagal menyimpan SJ';
      throw new Error(message);
    }

    emitStats();

    if (options.showNotice !== false) {
      notice.value = value ? 'SJ berhasil ditandai sudah balik.' : 'Tanda SJ balik berhasil dibatalkan.';
    }

    return true;
  } catch (e) {
    row.sj_returned = prev;
    row.sj_returned_at = prevAt;
    const message = e instanceof Error ? e.message : String(e);
    if (!error.value) {
      error.value = message;
    }
    return false;
  } finally {
    setSaving(shipmentId, false);
  }
}

async function bulkSetSjReturned(value: boolean): Promise<void> {
  if (bulkSaving.value || loading.value) return;

  const targets = filteredRows.value.filter((r) => r.sj_returned !== value);
  if (targets.length === 0) return;

  const actionLabel = value ? 'menandai SJ sudah balik' : 'membatalkan tanda SJ balik';
  if (targets.length > 20 && !confirm(`Proses ${targets.length} SPB untuk ${actionLabel}?`)) {
    return;
  }

  bulkSaving.value = true;
  error.value = null;
  notice.value = null;

  let success = 0;
  let failed = 0;

  for (const row of targets) {
    const ok = await setSjReturned(row.id, value, { clearError: false, showNotice: false });
    if (ok) success += 1;
    else failed += 1;
  }

  if (failed === 0) {
    notice.value = `Berhasil memperbarui ${success} SPB.`;
  } else {
    error.value = `Gagal memperbarui ${failed} dari ${targets.length} SPB.`;
    if (success > 0) {
      notice.value = `${success} SPB berhasil diperbarui.`;
    }
  }

  bulkSaving.value = false;
}

function onToggleSj(row: Row): void {
  if (bulkSaving.value) return;
  void setSjReturned(row.id, !row.sj_returned);
}

function onKeydown(e: KeyboardEvent): void {
  if (!props.show) return;
  if (e.key === 'Escape') close();
}

watch(
  () => props.show,
  (val) => {
    if (val) {
      void fetchRows();
      window.addEventListener('keydown', onKeydown);
    } else {
      window.removeEventListener('keydown', onKeydown);
      q.value = '';
      sjFilter.value = 'all';
      rows.value = [];
      error.value = null;
      notice.value = null;
      bulkSaving.value = false;
      savingIds.value = new Set();
    }
  }
);

watch(
  () => props.dblId,
  () => {
    if (props.show) void fetchRows();
  }
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 print:hidden">
    <div class="absolute inset-0 bg-black/35" @click="close"></div>

    <div class="absolute inset-y-0 right-0 w-[97vw] max-w-6xl bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl flex flex-col lg:left-60 lg:right-0 lg:w-auto lg:max-w-none dark:text-gray-100">
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
          <Button variant="default" class="text-sm" :disabled="loading || bulkSaving" @click="fetchRows">
            <Icon icon="mdi:refresh" class="mr-1" /> Refresh
          </Button>
          <Button variant="default" class="text-sm" @click="close">Tutup</Button>
        </div>
      </div>

      <div class="px-4 py-3 space-y-3 border-b border-gray-200 dark:border-gray-700">
        <div v-if="error" class="text-sm text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
          {{ error }}
        </div>
        <div v-if="notice" class="text-sm text-green-700 dark:text-green-300 px-1">
          {{ notice }}
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div class="p-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
            <div class="text-xs text-gray-500 dark:text-gray-300">Total SPB</div>
            <div class="font-semibold text-gray-900 dark:text-gray-100">{{ totalShipments }}</div>
          </div>
          <div class="p-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
            <div class="text-xs text-gray-500 dark:text-gray-300">SJ sudah balik</div>
            <div class="font-semibold text-green-600 dark:text-green-400">{{ sjReturnedCount }}</div>
          </div>
          <div class="p-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
            <div class="text-xs text-gray-500 dark:text-gray-300">SJ belum balik</div>
            <div class="font-semibold text-orange-600 dark:text-orange-400">{{ sjPendingCount }}</div>
          </div>
          <div class="p-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
            <div class="text-xs text-gray-500 dark:text-gray-300">SPB terlihat</div>
            <div class="font-semibold text-blue-600 dark:text-blue-400">{{ visibleTotal }}</div>
          </div>
        </div>

        <div class="space-y-1">
          <ProgressBar :value="sjReturnedPercent" />
          <div class="text-[11px] text-gray-500 dark:text-gray-400 text-right">
            {{ sjReturnedCount }}/{{ totalShipments }} SJ sudah balik ({{ sjReturnedPercent.toFixed(1) }}%)
          </div>
        </div>

        <div class="flex flex-wrap items-end justify-between gap-2">
          <div class="w-full sm:w-56">
            <label class="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">Filter Status SJ</label>
            <select
              v-model="sjFilter"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
              :disabled="loading || bulkSaving"
            >
              <option value="all">Semua</option>
              <option value="pending">Belum Balik</option>
              <option value="returned">Sudah Balik</option>
            </select>
          </div>

          <div class="relative w-full md:w-96">
            <Icon icon="mdi:magnify" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              v-model="q"
              type="text"
              class="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
              placeholder="Cari SPB, RESI, customer, penerima, kota..."
              :disabled="loading || bulkSaving"
            >
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            class="text-sm"
            :disabled="loading || bulkSaving || visiblePendingCount === 0"
            @click="bulkSetSjReturned(true)"
          >
            <Icon :icon="bulkSaving ? 'mdi:loading' : 'mdi:check-all'" :class="bulkSaving ? 'mr-1 animate-spin' : 'mr-1'" />
            Checklist Terlihat ({{ visiblePendingCount }})
          </Button>
          <Button
            variant="default"
            class="text-sm"
            :disabled="loading || bulkSaving || visibleReturnedCount === 0"
            @click="bulkSetSjReturned(false)"
          >
            <Icon :icon="bulkSaving ? 'mdi:loading' : 'mdi:backup-restore'" :class="bulkSaving ? 'mr-1 animate-spin' : 'mr-1'" />
            Uncheck Terlihat ({{ visibleReturnedCount }})
          </Button>
        </div>
      </div>

      <div class="px-4 py-4 flex-1 overflow-hidden">
        <div v-if="loading" class="h-32 flex items-center justify-center text-gray-500 dark:text-gray-400">Loading...</div>
        <div v-else-if="rows.length === 0" class="h-32 flex items-center justify-center text-gray-400 dark:text-gray-500">Tidak ada SPB pada DBL ini</div>
        <div v-else-if="filteredRows.length === 0" class="h-32 flex items-center justify-center text-gray-400 dark:text-gray-500">Tidak ada data yang cocok dengan filter</div>
        <div v-else class="h-full overflow-hidden">
          <div class="hidden md:block h-full overflow-x-auto overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 sticky top-0 z-10">
                <tr>
                  <th class="px-2 py-2 text-center text-xs font-medium w-12">No</th>
                  <th class="px-2 py-2 text-left text-xs font-medium">No. SPB / RESI</th>
                  <th class="px-2 py-2 text-left text-xs font-medium">Customer</th>
                  <th class="px-2 py-2 text-left text-xs font-medium">Penerima</th>
                  <th class="px-2 py-2 text-left text-xs font-medium">Nama Barang</th>
                  <th class="px-2 py-2 text-right text-xs font-medium">QTY</th>
                  <th class="px-2 py-2 text-right text-xs font-medium">Tagihan</th>
                  <th class="px-2 py-2 text-center text-xs font-medium">Status SJ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr
                  v-for="(r, idx) in filteredRows"
                  :key="r.id"
                  class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td class="px-2 py-2 text-center text-xs text-gray-500 dark:text-gray-400">{{ idx + 1 }}</td>
                  <td class="px-2 py-2">
                    <div class="text-xs font-mono text-gray-900 dark:text-gray-100">{{ r.spb_number || '-' }}</div>
                    <div class="text-[11px] text-gray-500 dark:text-gray-400">{{ r.public_code || '-' }}</div>
                  </td>
                  <td class="px-2 py-2 text-xs text-gray-700 dark:text-gray-200">{{ r.customer_name || '-' }}</td>
                  <td class="px-2 py-2">
                    <div class="text-xs text-gray-700 dark:text-gray-200">{{ r.penerima_name || '-' }}</div>
                    <div class="text-[11px] text-gray-500 dark:text-gray-400">{{ r.destination || '-' }}</div>
                  </td>
                  <td class="px-2 py-2 text-xs text-gray-700 dark:text-gray-200">{{ r.macam_barang || '-' }}</td>
                  <td class="px-2 py-2 text-right text-xs text-gray-700 dark:text-gray-200">{{ r.total_colli || 0 }}</td>
                  <td class="px-2 py-2 text-right text-xs font-semibold text-gray-900 dark:text-gray-100">{{ formatNominal(r.nominal || 0) }}</td>
                  <td class="px-2 py-2 text-center">
                    <Button
                      :variant="r.sj_returned ? 'primary' : 'default'"
                      class="h-8 px-2 text-xs min-w-[120px]"
                      :disabled="savingIds.has(r.id) || bulkSaving"
                      @click="onToggleSj(r)"
                    >
                      <Icon
                        v-if="savingIds.has(r.id)"
                        icon="mdi:loading"
                        class="mr-1 animate-spin"
                      />
                      <Icon
                        v-else
                        :icon="r.sj_returned ? 'mdi:check-circle' : 'mdi:checkbox-blank-circle-outline'"
                        class="mr-1"
                      />
                      {{ r.sj_returned ? 'Sudah Balik' : 'Belum Balik' }}
                    </Button>
                    <div class="text-[10px] mt-1 text-gray-500 dark:text-gray-400">{{ r.sj_returned ? formatReturnedAt(r.sj_returned_at) : '-' }}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="md:hidden h-full overflow-y-auto space-y-2">
            <div
              v-for="(r, idx) in filteredRows"
              :key="r.id"
              class="rounded-lg border p-3 space-y-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="text-xs text-gray-500 dark:text-gray-400">#{{ idx + 1 }}</div>
                  <div class="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100">{{ r.spb_number || '-' }}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">{{ r.public_code || '-' }}</div>
                </div>
                <Badge :variant="r.sj_returned ? 'success' : 'warning'">
                  {{ r.sj_returned ? 'Sudah Balik' : 'Belum Balik' }}
                </Badge>
              </div>

              <div class="text-xs text-gray-700 dark:text-gray-200">
                <div><span class="text-gray-500 dark:text-gray-400">Customer:</span> {{ r.customer_name || '-' }}</div>
                <div><span class="text-gray-500 dark:text-gray-400">Penerima:</span> {{ r.penerima_name || '-' }}</div>
                <div><span class="text-gray-500 dark:text-gray-400">Tujuan:</span> {{ r.destination || '-' }}</div>
                <div><span class="text-gray-500 dark:text-gray-400">Barang:</span> {{ r.macam_barang || '-' }}</div>
                <div><span class="text-gray-500 dark:text-gray-400">QTY:</span> {{ r.total_colli || 0 }} | <span class="text-gray-500 dark:text-gray-400">Tagihan:</span> {{ formatNominal(r.nominal || 0) }}</div>
              </div>

              <Button
                block
                :variant="r.sj_returned ? 'primary' : 'default'"
                class="text-sm"
                :disabled="savingIds.has(r.id) || bulkSaving"
                @click="onToggleSj(r)"
              >
                <Icon
                  v-if="savingIds.has(r.id)"
                  icon="mdi:loading"
                  class="mr-1 animate-spin"
                />
                <Icon
                  v-else
                  :icon="r.sj_returned ? 'mdi:check-circle' : 'mdi:checkbox-blank-circle-outline'"
                  class="mr-1"
                />
                {{ r.sj_returned ? 'Sudah Balik' : 'Belum Balik' }}
              </Button>
              <div class="text-[11px] text-gray-500 dark:text-gray-400">Waktu balik: {{ r.sj_returned ? formatReturnedAt(r.sj_returned_at) : '-' }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
