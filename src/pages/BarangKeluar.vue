<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Button from '../components/ui/Button.vue';
import Badge from '../components/ui/Badge.vue';
import CityAutocomplete from '../components/CityAutocomplete.vue';
import CustomerAutocomplete from '../components/CustomerAutocomplete.vue';
import { useFormatters } from '../composables/useFormatters';

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
    const res = await fetch('/api/shipments/list');
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
      const res = await fetch('/api/shipments/update', {
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
      const res = await fetch('/api/shipments/create', {
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
    const res = await fetch(`/api/shipments/delete?id=${id}`, { method: 'DELETE' });
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
  win.document.write('<html><head><title>Print Label</title><style>body{margin:0;font-family:Arial;} .square{width:80mm;height:80mm;box-sizing:border-box;padding:6mm;display:flex;flex-direction:column;justify-content:space-between;border:1px solid #000;} img{max-width:100%;height:auto;} .row{text-align:center;font-size:12px;font-weight:600;} .codes{display:flex;gap:4mm;} .codes img{flex:1;} @media print{.square{box-shadow:none;border:1px solid #000;}}</style></head><body>');
  win.document.write('<div class="square">');
  win.document.write(`<div class="row">${code}</div>`);
  win.document.write(`<div class="row">${origin} → ${dest}</div>`);
  win.document.write('<div class="codes">');
  win.document.write(`<img src="/api/barcode/generate?code=${code}&type=qr" />`);
  win.document.write(`<img src="/api/barcode/generate?code=${code}&type=barcode" />`);
  win.document.write('</div>');
  win.document.write('</div></body></html>');
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
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="text-xl font-semibold">Barang Keluar (Shipments)</div>
      <Button variant="primary" @click="openCreateModal">+ Tambah Shipment</Button>
    </div>

    <div v-if="loading" class="flex items-center justify-center h-64">
      <div class="text-gray-500">Loading...</div>
    </div>

    <div v-else class="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600">Kode</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600">Customer</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600">Rute</th>
            <th class="px-4 py-3 text-center text-xs font-medium text-gray-600">Colli</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600">Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600">ETA</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-if="shipments.length === 0">
            <td colspan="7" class="px-4 py-8 text-center text-sm text-gray-500">
              Belum ada shipment
            </td>
          </tr>
          <tr v-for="ship in shipments" :key="ship.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 text-sm font-medium">{{ ship.public_code }}</td>
            <td class="px-4 py-3 text-sm">{{ ship.customer_name || '-' }}</td>
            <td class="px-4 py-3 text-sm">{{ ship.origin }} → {{ ship.destination }}</td>
            <td class="px-4 py-3 text-sm text-center">{{ ship.total_colli }}</td>
            <td class="px-4 py-3">
              <Badge :variant="getStatusVariant(ship.status)">
                {{ statusOptions.find(o => o.value === ship.status)?.label || ship.status }}
              </Badge>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">
              {{ ship.eta ? formatDate(ship.eta) : '-' }}
            </td>
            <td class="px-4 py-3 text-right space-x-2">
              <button
                @click="viewBarcode(ship)"
                class="text-green-600 hover:text-green-700 text-sm font-medium"
              >
                Barcode
              </button>
              <button
                @click="openEditModal(ship)"
                class="text-blue-600 hover:text-blue-700 text-sm font-medium"
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

    <div
      v-if="showModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="showModal = false"
    >
      <div class="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
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
      <div class="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
        <div class="text-lg font-semibold">Barcode - {{ selectedShipment.public_code }}</div>
        <div class="space-y-4">
          <div class="text-center">
            <div class="text-sm text-gray-600 mb-2">QR Code</div>
            <img
              :src="`/api/barcode/generate?code=${selectedShipment.public_code}&type=qr`"
              alt="QR Code"
              class="mx-auto border border-gray-200 p-2 rounded"
            />
          </div>
          <div class="text-center">
            <div class="text-sm text-gray-600 mb-2">Barcode (Code 128)</div>
            <img
              :src="`/api/barcode/generate?code=${selectedShipment.public_code}&type=barcode`"
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
