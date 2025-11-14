<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Button from '../components/ui/Button.vue';
import Badge from '../components/ui/Badge.vue';
import CityAutocomplete from '../components/CityAutocomplete.vue';
import CustomerAutocomplete from '../components/CustomerAutocomplete.vue';
import { useFormatters } from '../composables/useFormatters';
import { Icon } from '@iconify/vue';

const { formatDate } = useFormatters();

type Shipment = {
  id: number;
  customer_id: number | null;
  customer_name: string | null;
  origin: string;
  destination: string;
  eta: string | null;
  status: string;
  total_colli: number;
  public_code: string | null;
  vehicle_plate_region: string | null;
  created_at: string;
};

type ShipmentForm = {
  origin: string;
  destination: string;
  eta: string;
  status: string;
  total_colli: string;
  vehicle_plate_region: string;
  customer_name: string;
  customer_id: number | null;
  regenerate_code: boolean;
};

const shipments = ref<Shipment[]>([]);
const loading = ref(true);
const showModal = ref(false);
const editingId = ref<number | null>(null);
const form = ref<ShipmentForm>({
  origin: '',
  destination: '',
  eta: '',
  status: 'DRAFT',
  total_colli: '0',
  vehicle_plate_region: '',
  customer_name: '',
  customer_id: null,
  regenerate_code: false
});

const statusOptions = [
  { value: 'DRAFT', label: 'Draft', variant: 'default' },
  { value: 'READY', label: 'Ready', variant: 'info' },
  { value: 'LOADING', label: 'Loading', variant: 'warning' },
  { value: 'IN_TRANSIT', label: 'In Transit', variant: 'info' },
  { value: 'DELIVERED', label: 'Delivered', variant: 'success' }
];

const selectedShipment = ref<Shipment | null>(null);
const showBarcodeModal = ref(false);

function viewBarcode(shipment: Shipment) {
  selectedShipment.value = shipment;
  showBarcodeModal.value = true;
}

async function loadShipments() {
  loading.value = true;
  try {
    const res = await fetch('/api/shipments?endpoint=list');
    const data = await res.json();
    shipments.value = data.items || [];
  } catch (e) {
    console.error('Failed to load shipments:', e);
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  editingId.value = null;
  form.value = {
    origin: '',
    destination: '',
    eta: '',
    status: 'DRAFT',
    total_colli: '0',
    vehicle_plate_region: '',
    customer_name: '',
    customer_id: null,
    regenerate_code: true
  };
  showModal.value = true;
}

function openEditModal(shipment: Shipment) {
  editingId.value = shipment.id;
  form.value = {
    origin: shipment.origin,
    destination: shipment.destination,
    eta: shipment.eta || '',
    status: shipment.status,
    total_colli: String(shipment.total_colli),
    vehicle_plate_region: shipment.vehicle_plate_region || '',
    customer_name: shipment.customer_name || '',
    customer_id: shipment.customer_id,
    regenerate_code: false
  };
  showModal.value = true;
}

async function saveShipment() {
  const totalColli = parseInt(form.value.total_colli);
  if (!form.value.origin || !form.value.destination || isNaN(totalColli)) {
    alert('Isi semua field dengan benar');
    return;
  }

  try {
    if (editingId.value) {
      const res = await fetch('/api/shipments?endpoint=update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId.value,
          origin: form.value.origin,
          destination: form.value.destination,
          eta: form.value.eta || null,
          status: form.value.status,
          total_colli: totalColli,
          customer_id: form.value.customer_id || undefined,
          vehicle_plate_region: form.value.vehicle_plate_region.trim().toUpperCase() || undefined,
          regenerate_code: form.value.regenerate_code
        })
      });
      if (!res.ok) throw new Error('Update failed');
    } else {
      const res = await fetch('/api/shipments?endpoint=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: form.value.origin,
          destination: form.value.destination,
          eta: form.value.eta || null,
          status: form.value.status,
          total_colli: totalColli,
          vehicle_plate_region: form.value.vehicle_plate_region.trim().toUpperCase() || 'XX',
          customer_id: form.value.customer_id || undefined
        })
      });
      if (!res.ok) throw new Error('Create failed');
    }
    showModal.value = false;
    loadShipments();
  } catch (e) {
    console.error('Save error:', e);
    alert('Gagal menyimpan shipment');
  }
}

async function deleteShipment(id: number) {
  if (!confirm('Yakin ingin menghapus shipment ini?')) return;
  
  try {
    const res = await fetch(`/api/shipments?endpoint=delete&id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    loadShipments();
  } catch (e) {
    console.error('Delete error:', e);
    alert('Gagal menghapus shipment');
  }
}

function getStatusVariant(status: string): 'default' | 'info' | 'warning' | 'success' {
  const opt = statusOptions.find(o => o.value === status);
  return (opt?.variant || 'default') as 'default' | 'info' | 'warning' | 'success';
}

function printLabel() {
  if (!selectedShipment.value) return;
  const code = selectedShipment.value.public_code;
  const origin = selectedShipment.value.origin;
  const dest = selectedShipment.value.destination;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>Print Label</title><style>
    @page { size: 100mm 100mm; margin: 0; }
    body { margin:0; font-family: 'Inter', Arial, sans-serif; -webkit-print-color-adjust: exact; }
    .label-box {
      width: 100mm; height: 100mm; box-sizing: border-box;
      padding: 0; border: 2px solid #b91c1c; border-radius: 8px;
      display: flex; flex-direction: column; justify-content: space-between;
      background: #ffffff;
      position: relative; left: 0; top: 0;
    }
    .label-inner {
      padding: 8mm; height: calc(100mm - 16mm); display: flex; flex-direction: column; justify-content: space-between;
    }
    .label-header { text-align: center; font-size: 16px; font-weight: 700; color: #b91c1c; margin-bottom: 2mm; }
    .label-route { text-align: center; font-size: 13px; font-weight: 500; color: #991b1b; margin-bottom: 4mm; }
    .codes { display: flex; gap: 8mm; justify-content: center; align-items: center; }
    .codes img { width: 38mm; height: 38mm; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 4px; background: #fff; }
    .label-footer { text-align: center; font-size: 12px; color: #991b1b; margin-top: 4mm; }
    @media print {
      body { background: transparent; }
      .label-box { box-shadow: none; }
    }
  </style></head><body>`);
  win.document.write(`<div class="label-box">
    <div class="label-inner">
      <div class="label-header">${code}</div>
      <div class="label-route">${origin} → ${dest}</div>
      <div class="codes">
        <img src="/api/blob?endpoint=generate&code=${code}&type=qr" alt="QR Code" />
        <img src="/api/blob?endpoint=generate&code=${code}&type=barcode" alt="Barcode" />
      </div>
      <div class="label-footer">ERP DARAT BUKAN BCE</div>
    </div>
  </div>`);
  win.document.write('</body></html>');
  win.document.close();
  win.focus();
  win.print();
  setTimeout(() => win.close(), 500);
}

onMounted(() => {
  loadShipments();
});
</script>

<template>
  <div class="space-y-4 pb-20 lg:pb-0">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="text-xl font-semibold dark:text-gray-100">Barang Keluar (Shipments)</div>
      <Button variant="primary" @click="openCreateModal" class="text-sm">+ Tambah</Button>
    </div>

    <div v-if="loading" class="flex items-center justify-center h-64 pb-20 lg:pb-0">
      <div class="text-gray-500">Loading...</div>
    </div>

    <!-- Desktop Table View -->
    <div v-else class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden card hidden lg:block transition-all duration-200">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Kode</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Customer</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Rute</th>
            <th class="px-4 py-3 text-center text-xs font-medium text-gray-600 dark:text-gray-300">Colli</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300">ETA</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-if="shipments.length === 0">
            <td colspan="7" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Belum ada shipment
            </td>
          </tr>
          <tr v-for="ship in shipments" :key="ship.id" class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
            <td class="px-4 py-3 text-sm font-medium dark:text-gray-200">{{ ship.public_code }}</td>
            <td class="px-4 py-3 text-sm dark:text-gray-300">{{ ship.customer_name || '-' }}</td>
            <td class="px-4 py-3 text-sm dark:text-gray-300">{{ ship.origin }} → {{ ship.destination }}</td>
            <td class="px-4 py-3 text-sm text-center">{{ ship.total_colli }}</td>
            <td class="px-4 py-3">
              <Badge :variant="getStatusVariant(ship.status)">
                {{ statusOptions.find(o => o.value === ship.status)?.label || ship.status }}
              </Badge>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              {{ ship.eta ? formatDate(ship.eta) : '-' }}
            </td>
            <td class="px-4 py-3 text-right space-x-2">
              <button
                @click="viewBarcode(ship)"
                class="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 text-sm font-medium transition-colors"
              >
                Barcode
              </button>
              <button
                @click="openEditModal(ship)"
                class="text-primary hover:text-primary-dark dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium transition-colors"
              >
                Edit
              </button>
              <button
                @click="deleteShipment(ship.id)"
                class="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

      <!-- Mobile Card View -->
      <div v-if="!loading" class="lg:hidden space-y-3">
        <div v-if="shipments.length === 0" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400">Belum ada shipment</p>
        </div>
        <div v-for="ship in shipments" :key="ship.id" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3 transition-all duration-200 hover:shadow-md">
          <div class="flex items-start justify-between">
            <div>
              <div class="text-sm font-semibold dark:text-gray-100">{{ ship.public_code }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ ship.customer_name || '-' }}</div>
            </div>
            <Badge :variant="getStatusVariant(ship.status)">
              {{ statusOptions.find(o => o.value === ship.status)?.label || ship.status }}
            </Badge>
          </div>
          <div class="text-sm dark:text-gray-300">
            <div class="flex items-center gap-2">
              <Icon icon="mdi:map-marker-outline" class="text-[18px] text-gray-500 dark:text-gray-400" />
              <span>{{ ship.origin }} → {{ ship.destination }}</span>
            </div>
            <div class="flex items-center gap-2 mt-1">
              <Icon icon="mdi:archive-outline" class="text-[18px] text-gray-500 dark:text-gray-400" />
              <span>{{ ship.total_colli }} colli</span>
            </div>
            <div v-if="ship.eta" class="flex items-center gap-2 mt-1">
              <Icon icon="mdi:calendar-outline" class="text-[18px] text-gray-500 dark:text-gray-400" />
              <span>{{ formatDate(ship.eta) }}</span>
            </div>
          </div>
          <div class="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <button @click="viewBarcode(ship)" class="flex-1 py-2 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
              Barcode
            </button>
            <button @click="openEditModal(ship)" class="flex-1 py-2 text-xs font-medium text-primary dark:text-blue-400 bg-primary-light dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
              Edit
            </button>
            <button @click="deleteShipment(ship.id)" class="flex-1 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
              Hapus
            </button>
          </div>
        </div>
      </div>

    <div
      v-if="showModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="showModal = false"
    >
      <div class="bg-white rounded-xl p-6 w-full max-w-md space-y-4 card">
        <div class="text-lg font-semibold">
          {{ editingId ? 'Edit Shipment' : 'Tambah Shipment' }}
        </div>
        <div class="space-y-3">
          <CityAutocomplete
            v-model="form.origin"
            label="Origin"
          />
          <CityAutocomplete
            v-model="form.destination"
            label="Destination"
          />
          <CustomerAutocomplete v-model="form.customer_name" label="Customer" @select-id="(id:number|null)=>{ form.customer_id = id; }" />
          <div>
            <label class="block text-sm font-medium mb-1">Total Colli</label>
            <input
              v-model="form.total_colli"
              type="number"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="10"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Kode Plat (2 huruf)</label>
            <input
              v-model="form.vehicle_plate_region"
              type="text"
              maxlength="2"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="BV, T, B"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">ETA</label>
            <input
              v-model="form.eta"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Status</label>
            <select
              v-model="form.status"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" v-model="form.regenerate_code" id="regen" class="h-4 w-4" />
            <label for="regen" class="text-xs text-gray-600 select-none">Regenerate kode tracking jika origin/dest/plat berubah</label>
          </div>
        </div>
        <div class="flex gap-2 justify-end">
          <Button variant="default" @click="showModal = false">Batal</Button>
          <Button variant="primary" @click="saveShipment">Simpan</Button>
        </div>
      </div>
    </div>

    <div
      v-if="showBarcodeModal && selectedShipment"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="showBarcodeModal = false"
    >
      <div class="bg-white rounded-xl p-6 w-full max-w-md space-y-4 card">
        <div class="text-lg font-semibold">Barcode - {{ selectedShipment.public_code }}</div>
        <div class="space-y-4">
          <div class="text-center">
            <div class="text-sm text-gray-600 mb-2">QR Code</div>
            <img
              :src="`/api/blob?endpoint=generate&code=${selectedShipment.public_code}&type=qr`"
              alt="QR Code"
              class="mx-auto border border-gray-200 p-2 rounded"
            />
          </div>
          <div class="text-center">
            <div class="text-sm text-gray-600 mb-2">Barcode (Code 128)</div>
            <img
              :src="`/api/blob?endpoint=generate&code=${selectedShipment.public_code}&type=barcode`"
              alt="Barcode"
              class="mx-auto border border-gray-200 p-2 rounded"
            />
          </div>
        </div>
        <div class="flex justify-end">
          <Button variant="default" @click="printLabel">Print Label</Button>
          <Button variant="default" @click="showBarcodeModal = false">Tutup</Button>
        </div>
      </div>
    </div>
  </div>
</template>
