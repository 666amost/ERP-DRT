<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import Button from './ui/Button.vue';
import CityAutocomplete from './CityAutocomplete.vue';
import { Icon } from '@iconify/vue';
import { getCityPlateCode } from '../lib/vehiclePlateCode';
import type { Shipment } from '../types/shipment';

type ShipmentForm = {
  spb_number: string;
  pengirim_name: string;
  penerima_name: string;
  penerima_phone: string;
  customer_name: string;
  customer_id: number | null;
  customer_address: string;
  origin: string;
  destination: string;
  macam_barang: string;
  satuan: string;
  berat: string;
  nominal: string;
  total_colli: string;
  keterangan: string;
  vehicle_plate_region: string;
  eta: string;
  status: string;
  service_type: string;
  jenis: string;
  regenerate_code: boolean;
};

const props = defineProps<{
  shipment: Shipment | null;
}>();

const emit = defineEmits(['close', 'saved']);

function toInputDate(val: string | null | undefined): string {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const jenisOptions = [
  { value: 'FRANCO', label: 'FRANCO' },
  { value: 'TJ', label: 'Tagihan Jakarta' },
  { value: 'LPT', label: 'Lunas PT' },
  { value: 'LJ', label: 'Lunas Jakarta' },
  { value: 'LB', label: 'Lunas Bali' }
];

const statusOptions = [
  { value: 'LOADING', label: 'Loading', variant: 'warning' },
  { value: 'IN_TRANSIT', label: 'In Transit', variant: 'info' }
];

const form = ref<ShipmentForm>(createDefaultForm());
const validationErrors = ref<Record<string, string>>({});
const saving = ref(false);

const showCustomerPicker = ref(false);
const showAddCustomerForm = ref(false);
const customerList = ref<{ id: number; name: string; phone: string | null; address: string | null }[]>([]);
const frequentCustomers = ref<{ id: number; name: string; phone: string | null; address: string | null }[]>([]);
const customerSearch = ref('');
const newCustomerForm = ref({
  name: '',
  pengirim_name: '',
  phone: '',
  address: ''
});
const isCreatingCustomer = ref(false);

const isEdit = computed(() => !!props.shipment);

function formatNumberID(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value;
  if (isNaN(num)) return '';
  const parts = num.toFixed(2).split('.');
  if (parts[0]) {
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  return parts.join(',');
}

function parseNumberID(value: string): number {
  if (!value || value.trim() === '') return 0;
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function createDefaultForm(): ShipmentForm {
  return {
    spb_number: '',
    pengirim_name: '',
    penerima_name: '',
    penerima_phone: '',
    customer_name: '',
    customer_id: null,
    customer_address: '',
    origin: '',
    destination: '',
    macam_barang: '',
    satuan: 'KG',
    berat: '0',
    nominal: '0',
    total_colli: '1',
    keterangan: '',
    vehicle_plate_region: '',
    eta: '',
    status: 'LOADING',
    service_type: 'CARGO',
    jenis: 'FRANCO',
    regenerate_code: true
  };
}

function resetCustomerState() {
  customerSearch.value = '';
  showAddCustomerForm.value = false;
  showCustomerPicker.value = false;
  newCustomerForm.value = { name: '', pengirim_name: '', phone: '', address: '' };
}

function resetForm(shipment: Shipment | null) {
  validationErrors.value = {};
  resetCustomerState();

  if (shipment) {
    form.value = {
      spb_number: shipment.spb_number || '',
      pengirim_name: shipment.pengirim_name || '',
      penerima_name: shipment.penerima_name || '',
      penerima_phone: shipment.penerima_phone || '',
      customer_name: shipment.customer_name || '',
      customer_id: shipment.customer_id,
      customer_address: shipment.customer_address || '',
      origin: shipment.origin,
      destination: shipment.destination,
      macam_barang: shipment.macam_barang || '',
      satuan: shipment.satuan || 'KG',
      berat: formatNumberID((shipment as unknown as { berat?: number }).berat || 0),
      nominal: String(shipment.nominal || 0),
      total_colli: String(shipment.total_colli || 1),
      keterangan: shipment.keterangan || '',
      vehicle_plate_region: shipment.vehicle_plate_region || '',
      eta: toInputDate(shipment.eta),
      status: shipment.status,
      service_type: shipment.service_type || 'CARGO',
      jenis: shipment.jenis || 'FRANCO',
      regenerate_code: false
    };
  } else {
    form.value = createDefaultForm();
  }
}

function validateForm(): { ok: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const f = form.value;
  if (!f.origin || !String(f.origin).trim()) errors.origin = 'Origin (kota asal) harus diisi';
  if (!f.destination || !String(f.destination).trim()) errors.destination = 'Destination (kota tujuan) harus diisi';
  const total = Number(f.total_colli);
  if (Number.isNaN(total) || total < 1) errors.total_colli = 'Total colli harus >= 1';
  if (f.eta && String(f.eta).trim()) {
    const d = new Date(f.eta);
    if (Number.isNaN(d.getTime())) errors.eta = 'Format ETA tidak valid';
  }
  const statuses = ['DRAFT', 'READY', 'LOADING', 'IN_TRANSIT', 'DELIVERED'];
  if (f.status && !statuses.includes(f.status)) errors.status = 'Status tidak valid';
  const services = ['REG', 'CARGO'];
  if (f.service_type && !services.includes(String(f.service_type).toUpperCase())) errors.service_type = 'Jenis layanan tidak valid';
  const jenisOpts = ['TJ', 'LPT', 'LJ', 'FRANCO', 'LB'];
  if (f.jenis && !jenisOpts.includes(String(f.jenis).toUpperCase())) errors.jenis = 'Jenis tidak valid';

  validationErrors.value = errors;
  return { ok: Object.keys(errors).length === 0, errors };
}

function autoDetectPlateCode(cityName: string) {
  const code = getCityPlateCode(cityName);
  if (code) {
    form.value.vehicle_plate_region = code;
    delete validationErrors.value.vehicle_plate_region;
  }
}

watch(() => form.value.destination, (val: string) => {
  if (val && String(val).trim()) {
    delete validationErrors.value.destination;
    autoDetectPlateCode(val);
  }
});

const filteredCustomerList = computed(() => {
  const search = customerSearch.value.trim().toLowerCase();
  if (!search) return customerList.value;
  return customerList.value.filter(c =>
    c.name.toLowerCase().includes(search) ||
    (c.phone || '').toLowerCase().includes(search) ||
    (c.address || '').toLowerCase().includes(search)
  );
});

async function loadCustomerList() {
  try {
    const res = await fetch('/api/customers?endpoint=list');
    const data = await res.json();
    customerList.value = data.items || [];
  } catch (e) {
    console.error('Failed to load customers:', e);
  }
}

async function loadFrequentCustomers() {
  try {
    const res = await fetch('/api/customers?endpoint=list&frequent=true');
    const data = await res.json();
    frequentCustomers.value = data.items || [];
  } catch (e) {
    console.error('Failed to load frequent customers:', e);
  }
}

function openCustomerPicker() {
  customerSearch.value = '';
  showCustomerPicker.value = true;
  showAddCustomerForm.value = false;
  loadCustomerList();
  loadFrequentCustomers();
}

async function createNewCustomer() {
  if (!newCustomerForm.value.name.trim()) {
    alert('Nama penerima/customer wajib diisi');
    return;
  }

  isCreatingCustomer.value = true;
  try {
    const res = await fetch('/api/customers?endpoint=create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newCustomerForm.value.name.trim(),
        pengirim_name: newCustomerForm.value.pengirim_name.trim() || undefined,
        phone: newCustomerForm.value.phone.trim() || undefined,
        address: newCustomerForm.value.address.trim() || undefined
      })
    });

    if (!res.ok) {
      const error = await res.json();
      alert(error.error || 'Gagal membuat customer');
      return;
    }

    const newCustomer = await res.json();
    newCustomerForm.value = { name: '', pengirim_name: '', phone: '', address: '' };
    showAddCustomerForm.value = false;

    await loadCustomerList();
    await loadFrequentCustomers();

    importCustomer(newCustomer);
  } catch (e) {
    console.error('Error creating customer:', e);
    alert('Gagal membuat customer');
  } finally {
    isCreatingCustomer.value = false;
  }
}

function importCustomer(c: { id: number; name: string; pengirim_name?: string | null; phone: string | null; address: string | null }) {
  form.value.customer_id = c.id;
  form.value.customer_name = c.name;
  form.value.customer_address = c.address || '';
  form.value.pengirim_name = c.pengirim_name || '';
  form.value.penerima_name = c.name;
  form.value.penerima_phone = c.phone || '';
  showCustomerPicker.value = false;
}

function closeModal() {
  emit('close');
}

async function saveShipment() {
  const totalColli = parseInt(form.value.total_colli) || 1;
  const beratVal = parseNumberID(form.value.berat);
  const nominalVal = parseFloat(form.value.nominal) || 0;

  const customerName = form.value.customer_name?.trim() || form.value.penerima_name?.trim() || null;

  const validation = validateForm();
  if (!validation.ok) {
    const msgs = Object.entries(validation.errors).map(([k, v]) => `${k}: ${v}`);
    alert('Periksa field berikut:\n' + msgs.join('\n'));
    return;
  }

  saving.value = true;
  try {
    if (props.shipment?.id) {
      const res = await fetch('/api/shipments?endpoint=update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: props.shipment.id,
          spb_number: form.value.spb_number || null,
          pengirim_name: form.value.pengirim_name || null,
          penerima_name: form.value.penerima_name || null,
          penerima_phone: form.value.penerima_phone || null,
          customer_id: customerName ? undefined : form.value.customer_id,
          customer_name: customerName,
          customer_address: form.value.customer_address || undefined,
          origin: form.value.origin,
          destination: form.value.destination,
          macam_barang: form.value.macam_barang || null,
          satuan: form.value.satuan || 'KG',
          berat: beratVal,
          nominal: nominalVal,
          total_colli: totalColli,
          keterangan: form.value.keterangan || null,
          vehicle_plate_region: form.value.vehicle_plate_region.trim().toUpperCase() || undefined,
          eta: form.value.eta || null,
          status: form.value.status,
          service_type: form.value.service_type || 'CARGO',
          jenis: form.value.jenis || 'FRANCO',
          regenerate_code: form.value.regenerate_code
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || errorData.details || 'Update failed');
      }
    } else {
      const res = await fetch('/api/shipments?endpoint=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spb_number: form.value.spb_number || null,
          pengirim_name: form.value.pengirim_name || null,
          penerima_name: form.value.penerima_name || null,
          penerima_phone: form.value.penerima_phone || null,
          customer_id: customerName ? undefined : form.value.customer_id,
          customer_name: customerName,
          customer_address: form.value.customer_address || undefined,
          origin: form.value.origin,
          destination: form.value.destination,
          macam_barang: form.value.macam_barang || null,
          satuan: form.value.satuan || 'KG',
          berat: beratVal,
          nominal: nominalVal,
          total_colli: totalColli,
          keterangan: form.value.keterangan || null,
          vehicle_plate_region: form.value.vehicle_plate_region.trim().toUpperCase() || 'XX',
          eta: form.value.eta || null,
          status: form.value.status,
          service_type: form.value.service_type || 'CARGO',
          jenis: form.value.jenis || 'FRANCO'
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || errorData.details || 'Create failed');
      }
    }

    emit('saved');
    emit('close');
  } catch (e) {
    console.error('Save error:', e);
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    alert(`Gagal menyimpan shipment: ${errorMessage}`);
  } finally {
    saving.value = false;
  }
}

watch(() => props.shipment, (val) => resetForm(val));

onMounted(() => {
  resetForm(props.shipment);
});
</script>

<template>
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 pt-4 px-4 pb-[60px] lg:p-4"
    @click.self="closeModal"
  >
    <div class="bg-white rounded-xl w-full max-w-2xl card flex flex-col h-[calc(100vh-60px)] lg:max-h-[90vh]">
      <div class="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 z-10">
        <h3 class="text-base font-semibold">{{ isEdit ? 'Edit SPB' : 'Tambah SPB Baru' }}</h3>
      </div>
      <div class="px-4 py-3 overflow-auto flex-1 space-y-1.5">
        <div>
          <label class="block text-sm font-medium mb-1">No. SPB / Resi</label>
          <input
            v-model="form.spb_number"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="Nomor SPB/Resi (input manual)"
          />
        </div>

        <button
          type="button"
          class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          @click="openCustomerPicker"
        >
          <Icon icon="mdi:account-search" class="text-lg" />
          Pilih / Tambah Customer
        </button>

        <div class="bg-gray-50 rounded-lg p-2.5 space-y-1.5">
          <div class="text-xs font-medium text-gray-700">Data Penerima & Penagihan</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-medium mb-0.5">Nama Pengirim</label>
              <input
                v-model="form.pengirim_name"
                type="text"
                class="w-full px-2 py-1 border border-gray-300 rounded-lg bg-white text-xs"
                placeholder="Nama pengirim"
              />
            </div>
            <div>
              <label class="block text-xs font-medium mb-0.5">Nama Penerima / Customer</label>
              <input
                v-model="form.penerima_name"
                type="text"
                class="w-full px-2 py-1 border border-gray-300 rounded-lg bg-white text-xs"
                placeholder="Nama penerima (juga untuk penagihan)"
              />
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-medium mb-0.5">No. Telepon Penerima</label>
              <input
                v-model="form.penerima_phone"
                type="text"
                class="w-full px-2 py-1 border border-gray-300 rounded-lg bg-white text-xs"
                placeholder="Nomor telepon penerima"
              />
            </div>
            <div>
              <label class="block text-xs font-medium mb-0.5">Alamat Penerima</label>
              <input
                v-model="form.customer_address"
                type="text"
                class="w-full px-2 py-1 border border-gray-300 rounded-lg bg-white text-xs"
                placeholder="Alamat lengkap penerima"
              />
            </div>
          </div>
        </div>

        <h3 class="text-xs font-semibold uppercase text-gray-600 mt-2 mb-1.5">Rute & Detail Barang</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <CityAutocomplete v-model="form.origin" label="Kota Asal" placeholder="Kota asal" />
            <p v-if="validationErrors.origin" class="text-red-600 text-xs mt-1">{{ validationErrors.origin }}</p>
          </div>
          <div>
            <CityAutocomplete v-model="form.destination" label="Kota Tujuan" placeholder="Kota tujuan" />
            <p v-if="validationErrors.destination" class="text-red-600 text-xs mt-1">{{ validationErrors.destination }}</p>
          </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <label class="block text-sm font-medium mb-1">Macam Barang</label>
            <input
              v-model="form.macam_barang"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Jenis barang"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Berat (KG)</label>
            <input
              v-model="form.berat"
              type="text"
              inputmode="decimal"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="0"
              @focus="($event.target as HTMLInputElement).select()"
              @blur="form.berat = formatNumberID(form.berat)"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Satuan</label>
            <select
              v-model="form.satuan"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="KG">KG</option>
              <option value="M3">M3</option>
              <option value="PCS">PCS</option>
              <option value="CTN">CTN</option>
              <option value="BOX">BOX</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Nominal (Rp)</label>
            <input
              v-model="form.nominal"
              type="number"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="0"
              @focus="($event.target as HTMLInputElement).select()"
            />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Total Colli</label>
          <input
            v-model="form.total_colli"
            type="number"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="10"
            @focus="($event.target as HTMLInputElement).select()"
          />
          <p v-if="validationErrors.total_colli" class="text-red-600 text-xs mt-1">{{ validationErrors.total_colli }}</p>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Keterangan</label>
          <textarea
            v-model="form.keterangan"
            rows="2"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Catatan tambahan"
          ></textarea>
        </div>

        <h3 class="text-lg font-semibold border-b pb-2 mb-4 mt-6">Info Pengiriman</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">ETA</label>
            <input
              v-model="form.eta"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
            <p v-if="validationErrors.eta" class="text-red-600 text-xs mt-1">{{ validationErrors.eta }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Jenis Layanan</label>
            <select
              v-model="form.service_type"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="REG">REG</option>
              <option value="CARGO">CARGO</option>
            </select>
            <p v-if="validationErrors.service_type" class="text-red-600 text-xs mt-1">{{ validationErrors.service_type }}</p>
          </div>
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
          <p v-if="validationErrors.status" class="text-red-600 text-xs mt-1">{{ validationErrors.status }}</p>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Jenis</label>
          <select
            v-model="form.jenis"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option
              v-for="opt in jenisOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
          <p v-if="validationErrors.jenis" class="text-red-600 text-xs mt-1">{{ validationErrors.jenis }}</p>
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
      </div>
      <div class="flex gap-2 justify-end border-t border-gray-100 dark:border-gray-800 p-4 bg-white">
        <Button
          variant="default"
          @click="closeModal"
          :disabled="saving"
        >
          Batal
        </Button>
        <Button
          variant="primary"
          @click="saveShipment"
          :disabled="saving"
        >
          {{ saving ? 'Menyimpan...' : 'Simpan' }}
        </Button>
      </div>
    </div>
  </div>

  <div
    v-if="showCustomerPicker"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
    @click.self="showCustomerPicker = false"
  >
    <div class="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col card">
      <div v-if="!showAddCustomerForm" class="p-4 border-b border-gray-200 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">Pilih Customer</h3>
          <button
            type="button"
            class="text-gray-400 hover:text-gray-600"
            @click="showCustomerPicker = false"
          >
            <Icon icon="mdi:close" class="text-xl" />
          </button>
        </div>
        <input
          v-model="customerSearch"
          type="text"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg"
          placeholder="Cari nama, telepon, atau alamat..."
        />
        <button
          type="button"
          class="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
          @click="showAddCustomerForm = true"
        >
          <Icon icon="mdi:plus" class="text-lg" />
          Tambah Customer Baru
        </button>
      </div>

      <div v-else class="p-4 border-b border-gray-200">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-semibold">Tambah Customer Baru</h3>
          <button
            type="button"
            class="text-gray-400 hover:text-gray-600"
            @click="showAddCustomerForm = false"
          >
            <Icon icon="mdi:close" class="text-xl" />
          </button>
        </div>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium mb-1">Nama Pengirim</label>
            <input
              v-model="newCustomerForm.pengirim_name"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Nama pengirim"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Nama Penerima / Customer *</label>
            <input
              v-model="newCustomerForm.name"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Nama penerima (juga untuk penagihan)"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">No. Telepon Penerima</label>
            <input
              v-model="newCustomerForm.phone"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="08xx xxxx xxxx"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Alamat Penerima</label>
            <textarea
              v-model="newCustomerForm.address"
              rows="2"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Alamat lengkap"
            ></textarea>
          </div>
        </div>
      </div>

      <div v-if="!showAddCustomerForm" class="flex-1 overflow-y-auto p-2">
        <div v-if="!customerSearch && frequentCustomers.length > 0" class="mb-4">
          <div class="text-xs font-semibold text-gray-600 px-2 py-1 uppercase">
            <Icon icon="mdi:fire" class="text-sm inline mr-1" />
            Sering Mengirim
          </div>
          <button
            v-for="c in frequentCustomers"
            :key="c.id"
            type="button"
            class="w-full text-left p-3 hover:bg-amber-50 rounded-lg transition-colors mb-1 bg-amber-50/50"
            @click="importCustomer(c)"
          >
            <div class="font-medium text-gray-900">{{ c.name }}</div>
            <div v-if="c.phone" class="text-sm text-gray-500">{{ c.phone }}</div>
            <div v-if="c.address" class="text-sm text-gray-400 truncate">{{ c.address }}</div>
          </button>
        </div>

        <div v-if="filteredCustomerList.length === 0 && customerSearch" class="text-center text-gray-500 py-8">
          <Icon icon="mdi:account-off" class="text-4xl mb-2" />
          <div>Tidak ada customer</div>
        </div>
        <div v-else-if="customerSearch">
          <div class="text-xs font-semibold text-gray-600 px-2 py-1 uppercase mb-2">Hasil Pencarian</div>
        </div>
        <button
          v-for="c in filteredCustomerList"
          :key="c.id"
          type="button"
          class="w-full text-left p-3 hover:bg-blue-50 rounded-lg transition-colors mb-1"
          @click="importCustomer(c)"
        >
          <div class="font-medium text-gray-900">{{ c.name }}</div>
          <div v-if="c.phone" class="text-sm text-gray-500">{{ c.phone }}</div>
          <div v-if="c.address" class="text-sm text-gray-400 truncate">{{ c.address }}</div>
        </button>
      </div>

      <div v-if="showAddCustomerForm" class="p-4 border-t border-gray-200 flex gap-2 justify-end bg-gray-50">
        <button
          type="button"
          class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium transition-colors"
          @click="showAddCustomerForm = false"
        >
          Batal
        </button>
        <button
          type="button"
          :disabled="isCreatingCustomer || !newCustomerForm.name.trim()"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          @click="createNewCustomer"
        >
          {{ isCreatingCustomer ? 'Menyimpan...' : 'Simpan' }}
        </button>
      </div>
    </div>
  </div>
</template>
