<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import Button from '../components/ui/Button.vue';
import Badge from '../components/ui/Badge.vue';
import CityAutocomplete from '../components/CityAutocomplete.vue';
import CustomerAutocomplete from '../components/CustomerAutocomplete.vue';
import { useFormatters } from '../composables/useFormatters';
import { Icon } from '@iconify/vue';
const LOGO_URL = '/brand/logo.png';

const { formatDate, formatRupiah } = useFormatters();

type Shipment = {
  id: number;
  customer_id: number | null;
  customer_name: string | null;
  customer_address: string | null;
  origin: string;
  destination: string;
  eta: string | null;
  status: string;
  total_colli: number;
  public_code: string | null;
  vehicle_plate_region: string | null;
  shipping_address: string | null;
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
  customer_address: string;
  shipping_address: string;
  regenerate_code: boolean;
  items?: { id?: number; description?: string; quantity?: number; kg_m3?: number | null; unit_price?: number; amount?: number; _unit_price_display?: string; status?: string }[];
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
  customer_address: '',
  shipping_address: '',
  regenerate_code: false
  , items: []
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
function addItemRow() {
  if (!form.value.items) form.value.items = [];
  form.value.items.push({ description: '', quantity: 1, kg_m3: null, unit_price: 0, amount: 0, _unit_price_display: '' });
}

function onUnitPriceFocus(it: { unit_price?: number; _unit_price_display?: string }) {
  it._unit_price_display = it.unit_price !== undefined ? String(it.unit_price) : '';
}

function onUnitPriceInput(it: { _unit_price_display?: string }, e: Event) {
  const target = e.target as HTMLInputElement | null;
  if (target) it._unit_price_display = target.value;
}

function onUnitPriceBlur(it: { unit_price?: number; _unit_price_display?: string }, e: Event) {
  const target = e.target as HTMLInputElement | null;
  const rawVal = String(it._unit_price_display || (target?.value || '')).replace(/[^0-9.,-]/g,'').replace(/,/g,'');
  it.unit_price = Number(rawVal || 0);
  it._unit_price_display = formatRupiah(it.unit_price || 0);
}

function removeItemRow(i: number) {
  if (!form.value.items) return;
  form.value.items.splice(i, 1);
}

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
    customer_address: '',
    shipping_address: '',
    regenerate_code: true
    , items: []
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
    customer_address: shipment.customer_address || '',
    shipping_address: shipment.shipping_address || shipment.customer_address || '',
    regenerate_code: false
    , items: []
  };
  // fetch colli rows for the shipment
  (async () => {
    try {
      const res = await fetch(`/api/colli?endpoint=list&shipment_id=${shipment.id}`);
      if (res.ok) {
        const data = await res.json();
        form.value.items = (data.items || []).map((i: { id: number; description?: string; quantity?: number; weight?: number; kg_m3?: number; unit_price?: number; amount?: number }) => ({ id: i.id, description: i.description || '', quantity: i.quantity || 1, kg_m3: i.weight || i.kg_m3 || null, unit_price: i.unit_price || 0, amount: i.amount || 0, _unit_price_display: i.unit_price ? formatRupiah(i.unit_price) : '' }));
      }
    } catch (err) {
      console.warn('Failed to load collis for edit modal', err);
    }
  })();
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
          customer_name: form.value.customer_name || undefined,
          customer_address: form.value.customer_address || undefined,
          shipping_address: form.value.shipping_address || undefined,
          vehicle_plate_region: form.value.vehicle_plate_region.trim().toUpperCase() || undefined,
          regenerate_code: form.value.regenerate_code
        })
      });
      if (!res.ok) throw new Error('Update failed');
      // handle collis update: delete existing and recreate from form
      try {
        if (form.value.items && form.value.items.length) {
          // bulk-set collis (upsert items)
          try {
            // ensure unit_price values are numeric and amounts are set
            const itemsToSend = (form.value.items || []).map(it => ({
              id: it.id,
              description: it.description,
              quantity: it.quantity || 1,
              kg_m3: it.kg_m3 || null,
              unit_price: (typeof it.unit_price === 'number' && !isNaN(it.unit_price)) ? it.unit_price : Number(String(it._unit_price_display || '').replace(/[^0-9.-]/g, '')) || 0,
              amount: (Number(it.quantity || 0) * (Number(it.unit_price || 0))) || 0,
              status: it.status || undefined
            }));
            const resp = await fetch(`/api/colli?endpoint=bulk-set`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shipment_id: editingId.value, items: itemsToSend }) });
            if (!resp.ok) console.warn('Bulk set collis failed', await resp.text());
          } catch (err) { console.warn('bulk-set colli request error', err); }
        } else {
          // if no items provided, delete existing collis
          const listRes = await fetch(`/api/colli?endpoint=list&shipment_id=${editingId.value}`);
          if (listRes.ok) {
            const listData = await listRes.json();
            const existing = listData.items || [];
            await Promise.all(existing.map((it: { id: number }) => fetch(`/api/colli?endpoint=delete&id=${it.id}`, { method: 'DELETE' })));
          }
        }
      } catch (err) {
        console.warn('Failed to update collis', err);
      }
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
          customer_id: form.value.customer_id || undefined,
          customer_name: form.value.customer_name || undefined,
          customer_address: form.value.customer_address || undefined,
          shipping_address: form.value.shipping_address || undefined
        })
      });
      if (!res.ok) throw new Error('Create failed');
      const created = await res.json();
      // create collis for the new shipment
      const sid = created.id;
      if (form.value.items && form.value.items.length) {
        try {
          const itemsToSend = (form.value.items || []).map(it => ({
            id: it.id,
            description: it.description,
            quantity: it.quantity || 1,
            kg_m3: it.kg_m3 || null,
            unit_price: (typeof it.unit_price === 'number' && !isNaN(it.unit_price)) ? it.unit_price : Number(String(it._unit_price_display || '').replace(/[^0-9.-]/g, '')) || 0,
            amount: (Number(it.quantity || 0) * (Number(it.unit_price || 0))) || 0,
            status: it.status || undefined
          }));
          const resp = await fetch(`/api/colli?endpoint=bulk-set`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shipment_id: sid, items: itemsToSend }) });
          if (!resp.ok) console.warn('Bulk set collis failed', await resp.text());
        } catch (err) { console.warn('bulk-set colli request error', err); }
      }
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
  const code = String(selectedShipment.value.public_code || '');
  const origin = selectedShipment.value.origin;
  const dest = selectedShipment.value.destination;
  const customerName = selectedShipment.value.customer_name || '';
  const customerAddress = selectedShipment.value.customer_address || '';
  const shippingAddressVal = selectedShipment.value.shipping_address || '';
  const win = window.open('', '_blank');
  if (!win) return;
  // small helper to escape HTML
  const esc = (s: string) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const addrHtml = esc(shippingAddressVal || customerAddress).replace(/\n/g,'<br />');
  const originEsc = esc(origin);
  const destEsc = esc(dest);
  const collis = selectedShipment.value.total_colli || '';
  const plate = selectedShipment.value.vehicle_plate_region || '';
  const etaFmt = selectedShipment.value.eta ? formatDate(selectedShipment.value.eta) : '';
  const customerNameHtml = esc(customerName);

  win.document.write(`<!DOCTYPE html><html><head><title>Print Label</title><style>
    @page { size: 100mm 150mm; margin: 0; }
    body { margin:0; font-family: 'Inter', Arial, sans-serif; -webkit-print-color-adjust: exact; }
    .label-box {
      width: 100mm; height: 150mm; box-sizing: border-box;
      padding: 0; border: 2px solid #1d4ed8; border-radius: 8px;
      display: flex; flex-direction: column; background: #ffffff;
      page-break-inside: avoid;
    }
    .label-inner {
      padding: 6mm; height: calc(150mm - 12mm); display: flex; flex-direction: column; gap: 2mm;
    }
    .brand { display:flex; align-items:center; justify-content:center; gap:5px; }
    .brand img { width: 14mm; height: 14mm; object-fit: contain; }
    .brand-name { font-size: 11px; font-weight: 700; color: #1d4ed8; letter-spacing: .4px; }
    .label-header { text-align: center; font-size: 16px; font-weight: 700; color: #1d4ed8; }
    .label-customer { text-align: center; font-size: 12px; color: #1e40af; font-weight: 600; }
    .label-address { text-align: center; font-size: 10px; color: #374151; line-height: 1.15; max-height: 26mm; overflow: hidden; }
    .label-route { text-align: center; font-size: 12px; font-weight: 600; color: #1e40af; }
    .label-meta { text-align:center; font-size:11px; color:#374151; }
    .codes { display: flex; flex-direction: column; gap: 4mm; justify-content: center; align-items: center; }
    .codes .qr { width: 44mm; height: 44mm; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 4px; background: #fff; display:block; }
    .codes .barcode { width: 80mm; height: 24mm; object-fit: contain; display:block; }
    .label-footer { text-align: center; font-size: 11px; color: #1e40af; margin-top:auto; }
    @media print { body { background: transparent; } }
  </style></head><body>`);
  win.document.write(`<div class="label-box">
    <div class="label-inner">
      <div class="brand"><img src="${LOGO_URL}" alt="Logo" /><div class="brand-name">SUMBER TRANS EXPRESS</div></div>
      <div class="label-header">${esc(code)}</div>
      <div class="label-customer">${customerNameHtml}</div>
      <div class="label-route">${originEsc} → ${destEsc}</div>
      <div class="label-address">${addrHtml}</div>
      <div class="label-meta">
        ${collis ? 'Colli: ' + esc(String(collis)) : ''}${(collis && plate) ? ' · ' : ''}${plate ? 'Plat: ' + esc(plate) : ''}${(collis || plate) && etaFmt ? ' · ' : ''}${etaFmt ? 'ETA: ' + esc(etaFmt) : ''}
      </div>
      <div class="codes">
        <img class="qr" src="/api/blob?endpoint=generate&code=${esc(code)}&type=qr" alt="QR Code" />
        <img class="barcode" src="/api/blob?endpoint=generate&code=${esc(code)}&type=barcode" alt="Barcode" />
      </div>
      <div class="label-footer">SUMBER TRANS EXPRESS</div>
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

watch(() => form.value.items, () => {
  if (!form.value.items) return;
  for (const it of form.value.items) {
    const qty = typeof it.quantity === 'number' ? it.quantity : Number(it.quantity || 0);
    const unit = typeof it.unit_price === 'number' ? it.unit_price : Number(it.unit_price || 0);
    it.amount = +(qty * unit);
  }
}, { deep: true });

watch(() => form.value.items, () => {
  if (!form.value.items || form.value.items.length === 0) return;
  const sum = form.value.items.reduce((acc, it) => acc + (Number(it.quantity || 0)), 0);
  form.value.total_colli = String(sum);
}, { deep: true });
</script>

<template>
  <div class="space-y-4 pb-20 lg:pb-0 overflow-x-hidden">
    <!-- Center content, keep layout in sync with other pages -->
    <div class="w-full max-w-6xl mx-auto min-w-0">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="text-xl font-semibold dark:text-gray-100">
        Barang Keluar (Shipments)
      </div>
      <Button
        variant="primary"
        class="flex-shrink-0 text-sm px-3"
        @click="openCreateModal"
      >
        + Tambah
      </Button>
    </div>

    <div
      v-if="loading"
      class="flex items-center justify-center h-64 pb-20 lg:pb-0"
    >
      <div class="text-gray-500">
        Loading...
      </div>
    </div>

    <!-- Desktop Table View -->
    <div
      v-else
      class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden card hidden lg:block transition-all duration-200"
    >
      <div class="overflow-x-auto">
        <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <tr>
            <th class="px-3 py-2 w-28 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
              Kode
            </th>
            <th class="px-3 py-2 w-56 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
              Customer
            </th>
            <th class="px-3 py-2 w-48 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
              Rute
            </th>
            <th class="px-3 py-2 w-16 text-center text-xs font-medium text-gray-600 dark:text-gray-300">
              Colli
            </th>
            <th class="px-3 py-2 w-24 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
              Status
            </th>
            <th class="px-3 py-2 w-20 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
              ETA
            </th>
            <th class="px-3 py-2 w-36 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-if="shipments.length === 0">
            <td
              colspan="7"
              class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
            >
              Belum ada shipment
            </td>
          </tr>
          <tr
            v-for="ship in shipments"
            :key="ship.id"
            class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
          >
            <td class="px-3 py-2 text-sm font-medium dark:text-gray-200">
              <div class="flex items-center gap-3">
                <div class="min-w-[72px]">
                  {{ ship.public_code }}
                </div>
              </div>
            </td>
            <td class="px-3 py-2 text-sm dark:text-gray-300 min-w-0">
              <div class="font-medium truncate">{{ ship.customer_name || '-' }}</div>
              <div class="text-xs text-gray-500 line-clamp-2">{{ ship.customer_address || '' }}</div>
              <div v-if="ship.shipping_address" class="text-xs text-gray-500 line-clamp-2">Shipping: {{ ship.shipping_address }}</div>
            </td>
            <td class="px-3 py-2 text-sm dark:text-gray-300 min-w-0">
              <div class="truncate">{{ ship.origin }} → {{ ship.destination }}</div>
            </td>
            <td class="px-3 py-2 text-sm text-center min-w-0">
              {{ ship.total_colli }}
            </td>
            <td class="px-3 py-2 min-w-0">
              <Badge :variant="getStatusVariant(ship.status)">
                {{ statusOptions.find(o => o.value === ship.status)?.label || ship.status }}
              </Badge>
            </td>
            <td class="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 min-w-0">
              {{ ship.eta ? formatDate(ship.eta) : '-' }}
            </td>
            <td class="px-3 py-2 text-right space-x-2 min-w-0">
              <Button
                variant="success"
                class="px-3 py-1 h-8 text-xs min-w-[84px]"
                @click="viewBarcode(ship)"
                title="Barcode"
              >
                Barcode
              </Button>
              <Button
                variant="primary"
                class="px-3 py-1 h-8 text-xs min-w-[84px]"
                @click="openEditModal(ship)"
                title="Edit"
              >
                Edit
              </Button>
              <Button
                variant="default"
                class="px-3 py-1 h-8 text-xs min-w-[84px] text-red-600 hover:text-red-700 bg-red-50 dark:bg-red-900/20"
                @click="deleteShipment(ship.id)"
                title="Delete"
              >
                Delete
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
    <!-- Mobile Card View -->
    <div
      v-if="!loading"
      class="lg:hidden space-y-3"
    >
      <div
        v-if="shipments.length === 0"
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center"
      >
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Belum ada shipment
        </p>
      </div>
      <div
        v-for="ship in shipments"
        :key="ship.id"
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3 transition-all duration-200 hover:shadow-md min-w-0"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold dark:text-gray-100 truncate">
              {{ ship.public_code }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {{ ship.customer_name || '-' }}
            </div>
            <div class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
              {{ ship.customer_address || '' }}
            </div>
            <div v-if="ship.shipping_address" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
              Ship: {{ ship.shipping_address }}
            </div>
          </div>
          <Badge :variant="getStatusVariant(ship.status)" class="flex-shrink-0">
            {{ statusOptions.find(o => o.value === ship.status)?.label || ship.status }}
          </Badge>
        </div>
        <div class="text-xs space-y-1.5">
          <div class="flex items-start gap-2">
            <Icon
              icon="mdi:map-marker-outline"
              class="text-base text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5"
            />
            <span class="dark:text-gray-300 text-xs leading-tight break-all">{{ ship.origin }} → {{ ship.destination }}</span>
          </div>
          <div class="flex items-center gap-2">
            <Icon
              icon="mdi:archive-outline"
              class="text-base text-gray-500 dark:text-gray-400 flex-shrink-0"
            />
            <span class="dark:text-gray-300 text-xs">{{ ship.total_colli }} colli</span>
          </div>
          <div
            v-if="ship.eta"
            class="flex items-center gap-2"
          >
            <Icon
              icon="mdi:calendar-outline"
              class="text-base text-gray-500 dark:text-gray-400 flex-shrink-0"
            />
            <span class="dark:text-gray-300 text-xs">{{ formatDate(ship.eta) }}</span>
          </div>
        </div>
        <div class="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700 min-w-0">
          <Button
            block
            variant="success"
            @click="viewBarcode(ship)"
            title="Barcode"
          >
            Barcode
          </Button>
          <Button
            block
            variant="primary"
            @click="openEditModal(ship)"
            title="Edit"
          >
            Edit
          </Button>
          <Button
            block
            variant="default"
            class="text-red-600 hover:text-red-700 bg-red-50 rounded-lg"
            @click="deleteShipment(ship.id)"
            title="Hapus"
          >
            Hapus
          </Button>
        </div>
      </div>
    </div>
    </div> <!-- end center wrapper -->

    <div
      v-if="showModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 pt-4 px-4 pb-[60px] lg:p-4"
      @click.self="showModal = false"
    >
      <!-- Modal: use full mobile height minus bottom nav (~56px) so action buttons sit lower without covering nav -->
      <div class="bg-white rounded-xl w-full max-w-4xl card flex flex-col h-[calc(100vh-60px)] lg:max-h-[90vh]">
        <div class="p-6 overflow-auto flex-1">
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
          <CustomerAutocomplete
            v-model="form.customer_name"
            label="Customer"
            @select-id="(id:number|null)=>{ form.customer_id = id; }"
                @selected="(c: { id: number; name: string; address?: string }) => { form.customer_id = c.id; form.customer_name = c.name; form.customer_address = c.address || ''; form.shipping_address = c.address || '' }"
          />
          <div>
            <label class="block text-sm font-medium mb-1">Alamat Customer</label>
            <textarea
              v-model="form.customer_address"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Alamat lengkap customer"
            ></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Alamat Pengiriman (Shipping Address)</label>
            <textarea
              v-model="form.shipping_address"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Alamat pengiriman (jika berbeda dari alamat customer)"
            ></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Total Colli</label>
            <input
              v-model="form.total_colli"
              type="number"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="10"
            >
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Kode Plat (2 huruf)</label>
            <input
              v-model="form.vehicle_plate_region"
              type="text"
              maxlength="2"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="BV, T, B"
            >
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">ETA</label>
            <input
              v-model="form.eta"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Status</label>
            <select
              v-model="form.status"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
          <div class="flex items-center gap-2">
            <input
              id="regen"
              v-model="form.regenerate_code"
              type="checkbox"
              class="h-4 w-4"
            >
            <label
              for="regen"
              class="text-xs text-gray-600 select-none"
            >Regenerate kode tracking jika origin/dest/plat berubah</label>
          </div>
          <div class="pt-2 border-t border-gray-100 dark:border-gray-800">
            <div class="mb-2 flex items-center justify-between">
              <div class="text-sm font-medium">Items</div>
              <div>
                <Button variant="default" class="text-xs px-3 py-1" @click="addItemRow">Tambah Item</Button>
              </div>
            </div>
            <div class="space-y-2">
              <div class="hidden md:grid md:grid-cols-[1fr_90px_100px_130px_130px_60px] gap-3 px-2 text-xs font-semibold text-gray-600">
                <div>Deskripsi</div>
                <div class="text-center">Qty</div>
                <div class="text-center">Kg/M3</div>
                <div class="text-center">Harga</div>
                <div class="text-center">Jumlah</div>
                <div></div>
              </div>
              <div v-if="!form.items || form.items.length === 0" class="text-sm text-gray-500 px-2">Belum ada item</div>
              <div v-for="(it, idx) in form.items" :key="idx" class="p-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded">
                <div class="grid md:grid-cols-[1fr_90px_100px_130px_130px_60px] gap-3 items-start">
                  <div class="md:row-span-1">
                    <div class="md:hidden text-xs text-gray-500 mb-1">Deskripsi</div>
                    <input v-model="it.description" class="w-full px-2 py-1 border rounded" placeholder="Deskripsi barang" />
                  </div>
                  <div>
                    <div class="md:hidden text-xs text-gray-500 mb-1">Qty</div>
                    <input v-model.number="it.quantity" type="number" min="1" class="w-full px-2 py-1 border rounded text-right" placeholder="Qty" />
                  </div>
                  <div>
                    <div class="md:hidden text-xs text-gray-500 mb-1">Kg/M3</div>
                    <input v-model.number="it.kg_m3" type="number" step="0.01" class="w-full px-2 py-1 border rounded text-right" placeholder="Kg/M3" />
                  </div>
                  <div>
                    <div class="md:hidden text-xs text-gray-500 mb-1">Harga</div>
                    <input
                      :value="it._unit_price_display || (it.unit_price !== undefined ? String(it.unit_price) : '')"
                      @focus="onUnitPriceFocus(it)"
                      @blur="onUnitPriceBlur(it, $event)"
                      @input="onUnitPriceInput(it, $event)"
                      type="text"
                      class="w-full px-2 py-1 border rounded text-right"
                      placeholder="Harga"
                    />
                  </div>
                  <div>
                    <div class="md:hidden text-xs text-gray-500 mb-1">Jumlah</div>
                    <input :value="formatRupiah(it.amount || 0)" readonly class="w-full px-2 py-1 border rounded bg-gray-50 text-right" />
                  </div>
                  <div class="flex md:flex-col justify-end items-center">
                    <Button variant="default" class="text-xs px-2 py-1" @click="removeItemRow(idx)">X</Button>
                  </div>
                </div>
              </div>
              <div class="flex items-center justify-between mt-2 px-2">
                <Button variant="default" class="text-xs px-3 py-1" @click="addItemRow">Tambah Item</Button>
                <div class="text-sm text-gray-500">Total Colli: {{ form.total_colli }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="flex gap-2 justify-end border-t border-gray-100 dark:border-gray-800 p-4 bg-white">
          <Button
            variant="default"
            @click="showModal = false"
          >
            Batal
          </Button>
          <Button
            variant="primary"
            @click="saveShipment"
          >
            Simpan
          </Button>
        </div>
        </div>
      </div>
    </div>

    <div
      v-if="showBarcodeModal && selectedShipment"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="showBarcodeModal = false"
    >
      <div class="bg-white rounded-xl p-6 w-full max-w-md space-y-4 card">
        <div class="text-lg font-semibold">
          Barcode - {{ selectedShipment.public_code }}
        </div>
        <div class="space-y-4">
          <div class="text-sm text-gray-500 text-center">
            <div class="font-medium">{{ selectedShipment.customer_name || '-' }}</div>
            <div class="text-xs text-gray-500 mt-1">{{ selectedShipment.shipping_address || selectedShipment.customer_address || '-' }}</div>
          </div>
          <!-- Removed live print preview to avoid overlay and mismatch -->
          <div class="text-center">
            <div class="text-sm text-gray-600 mb-2">
              QR Code
            </div>
            <img
              :src="`/api/blob?endpoint=generate&code=${selectedShipment.public_code}&type=qr`"
              alt="QR Code"
              class="mx-auto border border-gray-200 p-2 rounded"
            >
          </div>
          <div class="text-center">
            <div class="text-sm text-gray-600 mb-2">
              Barcode (Code 128)
            </div>
            <img
              :src="`/api/blob?endpoint=generate&code=${selectedShipment.public_code}&type=barcode`"
              alt="Barcode"
              class="mx-auto border border-gray-200 p-2 rounded"
            >
          </div>
        </div>
        <div class="flex justify-end">
          <Button
            variant="default"
            @click="printLabel"
          >
            Print Label
          </Button>
          <Button
            variant="default"
            @click="showBarcodeModal = false"
          >
            Tutup
          </Button>
        </div>
      </div>
    </div>
    </div> <!-- end space-y-4 wrapper -->
</template>
