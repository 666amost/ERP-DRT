<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import DriverAutocomplete from '@/components/DriverAutocomplete.vue';
import CityAutocomplete from '@/components/CityAutocomplete.vue';
import { useFormatters } from '../composables/useFormatters';
import { getCompany } from '../lib/company';
import { useAuth } from '../composables/useAuth';

const { fetchUser, permissions } = useAuth();

const { formatRupiah, formatDate } = useFormatters();

type DBL = {
  id: number;
  dbl_number: string;
  dbl_date: string | null;
  vehicle_plate: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  origin: string | null;
  destination: string | null;
  status: string;
  shipment_count: number;
  total_nominal: number;
  loco_amount: number;
  tekor_amount: number;
  sangu: number;
  komisi: number;
  ongkos_muatan: number;
  biaya_lain: number;
  administrasi: number;
  ongkos_lain: number;
  total_tagihan: number;
  total_bayar: number;
  catatan: string | null;
  pengurus_name: string | null;
  created_at: string;
};

type Shipment = {
  id: number;
  spb_number: string | null;
  public_code: string | null;
  customer_id: number | null;
  customer_name: string | null;
  pengirim_name: string | null;
  penerima_name: string | null;
  penerima_phone: string | null;
  origin: string;
  destination: string;
  macam_barang: string | null;
  qty: number;
  satuan: string | null;
  nominal: number;
  total_colli: number;
  status: string;
  invoice_generated: boolean;
};

type DBLForm = {
  dbl_number: string;
  departure_date: string;
  vehicle_number: string;
  driver_name: string;
  driver_phone: string;
  origin: string;
  destination: string;
  status: string;
  catatan: string;
  pengurus_name: string;
};

const dblList = ref<DBL[]>([]);
const filteredDblList = ref<DBL[]>([]);
const searchQuery = ref('');
const loading = ref(true);
const showModal = ref(false);
const showShipmentModal = ref(false);
const showInvoiceModal = ref(false);
const editingId = ref<number | null>(null);
const selectedDbl = ref<DBL | null>(null);

const dblShipments = ref<Shipment[]>([]);
const availableShipments = ref<Shipment[]>([]);
const selectedShipmentIds = ref<number[]>([]);
const loadingShipments = ref(false);

const availableShipmentsPage = ref(1);
const availableShipmentsTotal = ref(0);
const availableShipmentsLimit = 100;
const shipmentSearchQuery = ref('');

const pphPercent = ref<string>('0');

const form = ref<DBLForm>({
  dbl_number: '',
  departure_date: '',
  vehicle_number: '',
  driver_name: '',
  driver_phone: '',
  origin: '',
  destination: '',
  status: 'DRAFT',
  catatan: '',
  pengurus_name: ''
});

const validationErrors = ref<Record<string, string>>({});

function validateDBLForm(): { ok: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const f = form.value;
  
  if (!f.departure_date || !String(f.departure_date).trim()) {
    errors.departure_date = 'Tanggal keberangkatan harus diisi';
  }
  if (!f.origin || !String(f.origin).trim()) {
    errors.origin = 'Kota asal harus diisi';
  }
  if (!f.destination || !String(f.destination).trim()) {
    errors.destination = 'Kota tujuan harus diisi';
  }
  
  validationErrors.value = errors;
  return { ok: Object.keys(errors).length === 0, errors };
}

const statusOptions = [
  { value: 'DRAFT', label: 'Draft', variant: 'default' },
  { value: 'READY', label: 'Ready', variant: 'info' },
  { value: 'DEPARTED', label: 'Berangkat', variant: 'warning' },
  { value: 'ARRIVED', label: 'Tiba', variant: 'success' },
  { value: 'COMPLETED', label: 'Selesai', variant: 'success' }
];

function getStatusVariant(status: string): 'default' | 'info' | 'warning' | 'success' {
  const opt = statusOptions.find(o => o.value === status);
  return (opt?.variant || 'default') as 'default' | 'info' | 'warning' | 'success';
}

let shipmentSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(shipmentSearchQuery, () => {
  if (shipmentSearchDebounceTimer) clearTimeout(shipmentSearchDebounceTimer);
  shipmentSearchDebounceTimer = setTimeout(() => {
    loadAvailableShipments();
  }, 300);
});

async function loadAvailableShipments() {
  loadingShipments.value = true;
  try {
    const searchParam = shipmentSearchQuery.value.trim() ? `&search=${encodeURIComponent(shipmentSearchQuery.value)}` : '';
    const res = await fetch(`/api/dbl?endpoint=available-shipments&page=1${searchParam}`);
    if (res.ok) {
      const data = await res.json();
      availableShipments.value = data.items || [];
      availableShipmentsTotal.value = data.pagination?.total || 0;
    }
  } catch (e) {
    console.error('Failed to load available shipments:', e);
  } finally {
    loadingShipments.value = false;
  }
}

async function loadDBLList() {
  loading.value = true;
  try {
    const res = await fetch('/api/dbl?endpoint=list&limit=200');
    const data = await res.json();
    dblList.value = data.items || [];
    filterDBLList();
  } catch (e) {
    console.error('Failed to load DBL list:', e);
  } finally {
    loading.value = false;
  }
}

function filterDBLList() {
  if (!searchQuery.value.trim()) {
    filteredDblList.value = dblList.value;
  } else {
    const q = searchQuery.value.toLowerCase();
    filteredDblList.value = dblList.value.filter(d =>
      (d.dbl_number || '').toLowerCase().includes(q) ||
      (d.vehicle_plate || '').toLowerCase().includes(q) ||
      (d.driver_name || '').toLowerCase().includes(q) ||
      (d.origin || '').toLowerCase().includes(q) ||
      (d.destination || '').toLowerCase().includes(q) ||
      (d.status || '').toLowerCase().includes(q) ||
      (d.catatan || '').toLowerCase().includes(q)
    );
  }
}

watch([dblList, searchQuery], () => {
  filterDBLList();
});

function openCreateModal() {
  editingId.value = null;
  form.value = {
    dbl_number: '',
    departure_date: '',
    vehicle_number: '',
    driver_name: '',
    driver_phone: '',
    origin: '',
    destination: '',
    status: 'DRAFT',
    catatan: '',
    pengurus_name: ''
  };
  validationErrors.value = {};
  showModal.value = true;
}

async function openEditModal(dbl: DBL) {
  editingId.value = dbl.id;
  const sanitize = (val: string | null | undefined): string => {
    if (!val || val === 'null' || val === 'NULL') return '';
    return val;
  };
  form.value = {
    dbl_number: dbl.dbl_number,
    departure_date: dbl.dbl_date ? dbl.dbl_date.split('T')[0] ?? '' : '',
    vehicle_number: sanitize(dbl.vehicle_plate),
    driver_name: sanitize(dbl.driver_name),
    driver_phone: sanitize(dbl.driver_phone),
    origin: sanitize(dbl.origin),
    destination: sanitize(dbl.destination),
    status: dbl.status,
    catatan: sanitize(dbl.catatan),
    pengurus_name: sanitize(dbl.pengurus_name)
  };
  validationErrors.value = {};
  showModal.value = true;
}

async function saveDBL() {
  const validation = validateDBLForm();
  if (!validation.ok) {
    const msgs = Object.values(validation.errors);
    alert('Periksa field berikut:\n' + msgs.join('\n'));
    return;
  }

  try {
    const payload = {
      dbl_number: form.value.dbl_number || null,
      dbl_date: form.value.departure_date || null,
      vehicle_plate: form.value.vehicle_number || null,
      driver_name: form.value.driver_name || null,
      driver_phone: form.value.driver_phone || null,
      origin: form.value.origin || null,
      destination: form.value.destination || null,
      status: form.value.status,
      catatan: form.value.catatan || null,
      pengurus_name: form.value.pengurus_name || null
    };

    if (editingId.value) {
      const res = await fetch('/api/dbl?endpoint=update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId.value, ...payload })
      });
      if (!res.ok) throw new Error('Update failed');
    } else {
      const res = await fetch('/api/dbl?endpoint=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Create failed');
    }
    showModal.value = false;
    loadDBLList();
  } catch (e) {
    console.error('Save error:', e);
    alert('Gagal menyimpan DBL');
  }
}

async function deleteDBL(id: number) {
  if (!confirm('Yakin ingin menghapus DBL ini?')) return;
  try {
    const res = await fetch(`/api/dbl?endpoint=delete&id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    loadDBLList();
  } catch (e) {
    console.error('Delete error:', e);
    alert('Gagal menghapus DBL');
  }
}

async function openShipmentModal(dbl: DBL) {
  selectedDbl.value = dbl;
  loadingShipments.value = true;
  showShipmentModal.value = true;
  selectedShipmentIds.value = [];
  availableShipmentsPage.value = 1;
  shipmentSearchQuery.value = '';
  
  try {
    const [itemsRes] = await Promise.all([
      fetch(`/api/dbl?endpoint=items&id=${dbl.id}`)
    ]);
    
    if (itemsRes.ok) {
      const data = await itemsRes.json();
      dblShipments.value = data.items || [];
    }
    
    await loadAvailableShipments();
  } catch (e) {
    console.error('Failed to load shipments:', e);
  } finally {
    loadingShipments.value = false;
  }
}

async function loadMoreShipments() {
  if (loadingShipments.value) return;
  availableShipmentsPage.value++;
  loadingShipments.value = true;

  try {
    const res = await fetch(`/api/dbl?endpoint=available-shipments&page=${availableShipmentsPage.value}&limit=${availableShipmentsLimit}`);
    
    if (res.ok) {
      const data = await res.json();
      availableShipments.value = [...availableShipments.value, ...(data.items || [])];
      availableShipmentsTotal.value = data.pagination?.total || 0;
    }
  } catch (e) {
    console.error('Failed to load more shipments:', e);
    availableShipmentsPage.value--;
  } finally {
    loadingShipments.value = false;
  }
}

async function addSelectedShipments() {
  if (!selectedDbl.value || selectedShipmentIds.value.length === 0) return;
  
  try {
    for (const shipmentId of selectedShipmentIds.value) {
      await fetch('/api/dbl?endpoint=add-shipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbl_id: selectedDbl.value.id,
          shipment_id: shipmentId
        })
      });
    }
    await openShipmentModal(selectedDbl.value);
    loadDBLList();
  } catch (e) {
    console.error('Failed to add shipments:', e);
    alert('Gagal menambahkan resi');
  }
}

async function removeShipment(shipmentId: number) {
  if (!selectedDbl.value) return;
  if (!confirm('Hapus resi dari DBL ini?')) return;
  
  try {
    await fetch('/api/dbl?endpoint=remove-shipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dbl_id: selectedDbl.value.id,
        shipment_id: shipmentId
      })
    });
    await openShipmentModal(selectedDbl.value);
    loadDBLList();
  } catch (e) {
    console.error('Failed to remove shipment:', e);
    alert('Gagal menghapus resi');
  }
}

function openInvoiceModal(dbl: DBL) {
  selectedDbl.value = dbl;
  pphPercent.value = '0';
  showInvoiceModal.value = true;
}

async function generateInvoices() {
  if (!selectedDbl.value) return;
  
  const pph = parseFloat(pphPercent.value) || 0;
  
  try {
    const res = await fetch('/api/dbl?endpoint=generate-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dbl_id: selectedDbl.value.id,
        pph_percent: pph > 0 ? pph : undefined
      })
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Generate failed');
    }
    
    const data = await res.json();
    const count = data.invoices?.length || 0;
    alert(`Berhasil generate ${count} invoice`);
    showInvoiceModal.value = false;
    loadDBLList();
  } catch (e) {
    console.error('Generate invoices error:', e);
    alert('Gagal generate invoice: ' + (e instanceof Error ? e.message : 'Unknown error'));
  }
}

const totalNominal = computed(() => {
  return dblShipments.value.reduce((sum, s) => sum + (s.nominal || 0), 0);
});

async function printDaftarMuat(dbl: DBL) {
  const itemsRes = await fetch(`/api/dbl?endpoint=items&id=${dbl.id}`);
  let items: Shipment[] = [];
  if (itemsRes.ok) {
    const data = await itemsRes.json();
    items = data.items || [];
  }

  const company = await getCompany();
  const dblDate = dbl.dbl_date ? formatDate(dbl.dbl_date) : '-';
  const now = new Date();
  const printedAt = `${now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })} ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;

  const totalNom = items.reduce((sum, s) => sum + (s.nominal || 0), 0);
  const totalCol = items.reduce((sum, s) => sum + (s.total_colli || 0), 0);

  const win = window.open('', '_blank');
  if (!win) return;

  const esc = (s: string | null | undefined) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const rows = items.map((s, idx) => `
    <tr>
      <td class="border px-2 py-1 text-center">${idx + 1}</td>
      <td class="border px-2 py-1">${esc(s.spb_number || s.public_code)}</td>
      <td class="border px-2 py-1">${esc(s.pengirim_name)}</td>
      <td class="border px-2 py-1">${esc(s.penerima_name)}</td>
      <td class="border px-2 py-1">${esc(s.destination)}</td>
      <td class="border px-2 py-1">${esc(s.macam_barang)}</td>
      <td class="border px-2 py-1 text-center">${s.total_colli || 0}</td>
      <td class="border px-2 py-1 text-right">${formatRupiah(s.nominal || 0)}</td>
    </tr>
  `).join('');

  win.document.write(`<!DOCTYPE html><html><head><title>Daftar Muatan - ${esc(dbl.dbl_number)}</title>
  <script src="https://cdn.tailwindcss.com"></` + `script>
  <style>
    @page { size: A4; margin: 8mm; orphans: 3; widows: 3; }
    @media print { body { -webkit-print-color-adjust: exact; } }
    body { font-family: Arial, sans-serif; font-size: 10px; }
    .border { border: 1px solid #374151; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #374151; padding: 4px 2px; }
    th { font-size: 9px; font-weight: bold; }
    tbody tr { page-break-inside: avoid; }
    .page-break { page-break-after: always; }
    .footer-section { page-break-inside: avoid; }
  </style>
  </head><body class="p-2">
  
  <div class="flex justify-between items-start mb-2">
    <div class="text-lg font-bold">DAFTAR MUATAN</div>
    <div class="text-right text-sm">
      <div class="font-bold">No: ${esc(dbl.dbl_number)}</div>
      <div>Tgl: ${esc(dblDate)}</div>
    </div>
  </div>

  <div class="mb-2 p-1 bg-gray-100 rounded text-xs">
    <div class="grid grid-cols-2 gap-1">
      <div><strong>Plat:</strong> ${esc(dbl.vehicle_plate)}</div>
      <div><strong>Supir:</strong> ${esc(dbl.driver_name)}</div>
      <div><strong>Asal:</strong> ${esc(dbl.origin)}</div>
      <div><strong>Tujuan:</strong> ${esc(dbl.destination)}</div>
    </div>
  </div>

  <table class="mb-4">
    <thead class="bg-gray-200">
      <tr>
        <th class="border px-2 py-1 w-10">No</th>
        <th class="border px-2 py-1">TTB/Resi</th>
        <th class="border px-2 py-1">Pengirim</th>
        <th class="border px-2 py-1">Penerima</th>
        <th class="border px-2 py-1">Alamat</th>
        <th class="border px-2 py-1">Macam Barang</th>
        <th class="border px-2 py-1 w-12">Colli</th>
        <th class="border px-2 py-1 w-20">Jumlah</th>
      </tr>
    </thead>
    <tfoot>
      <tr class="font-bold bg-gray-100">
        <td colspan="6" class="border px-2 py-1 text-right">TOTAL</td>
        <td class="border px-2 py-1 text-center">${totalCol}</td>
        <td class="border px-2 py-1 text-right">${formatRupiah(totalNom)}</td>
      </tr>
    </tfoot>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="footer-section grid grid-cols-2 gap-2 mb-2 text-xs">
    <div class="border p-1 rounded">
      <div class="font-bold mb-1 border-b pb-0.5">CATATAN:</div>
      <div class="text-gray-600 text-xs">${esc(dbl.catatan) || '-'}</div>
    </div>

    <div class="border p-1 rounded">
      <table class="w-full text-xs mb-2">
        <tr><td class="font-bold">TOTAL NOMINAL</td><td class="text-right font-bold">Rp. ${formatRupiah(totalNom)}</td></tr>
      </table>
      
      <div class="grid grid-cols-2 gap-2 mt-4">
        <div class="text-center text-xs">
          <div class="font-bold text-xs">PENGURUS</div>
          <div class="h-10"></div>
          <div class="border-t border-black pt-0.5 text-xs">${esc(dbl.pengurus_name) || '________________'}</div>
        </div>
        <div class="text-center text-xs">
          <div class="font-bold text-xs">SUPIR</div>
          <div class="h-10"></div>
          <div class="border-t border-black pt-0.5 text-xs">${esc(dbl.driver_name) || '________________'}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="text-xs text-gray-500 text-center mt-2">
    ${printedAt} | ${esc(company?.name || '')}
  </div>

  </body></html>`);

  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

onMounted(async () => {
  await fetchUser();
  loadDBLList();
});
</script>

<template>
  <div class="space-y-4 pb-20 lg:pb-0 overflow-x-hidden">
    <div class="w-full max-w-6xl mx-auto min-w-0">
      <div class="hidden lg:flex items-center justify-between flex-wrap gap-3">
        <div class="text-xl font-semibold dark:text-gray-100">
          Daftar Bongkar/Muat (DBL)
        </div>
        <div class="flex gap-2 flex-1 lg:flex-initial min-w-0 max-w-md">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari no DBL, plat, supir, rute..."
            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 dark:border-gray-600"
          >
        </div>
        <Button variant="primary" class="flex-shrink-0 text-sm px-3" @click="openCreateModal">
          + Buat DBL
        </Button>
      </div>

      <div v-if="loading" class="flex items-center justify-center h-64 pb-20 lg:pb-0">
        <div class="text-gray-500">Loading...</div>
      </div>

      <div v-else class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden card hidden lg:block transition-all duration-200">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">No. DBL</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Tgl Berangkat</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Kendaraan</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Rute</th>
                <th class="px-3 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300">Jumlah Resi</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Total Nominal</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Status</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-if="filteredDblList.length === 0">
                <td colspan="8" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Belum ada DBL
                </td>
              </tr>
              <tr v-for="dbl in filteredDblList" :key="dbl.id" class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                <td class="px-3 py-2 text-sm font-medium dark:text-gray-200">{{ dbl.dbl_number || '-' }}</td>
                <td class="px-3 py-2 text-sm dark:text-gray-300">{{ dbl.dbl_date ? formatDate(dbl.dbl_date) : '-' }}</td>
                <td class="px-3 py-2 text-sm dark:text-gray-300">
                  <div>{{ dbl.vehicle_plate || '-' }}</div>
                  <div class="text-xs text-gray-500">{{ dbl.driver_name || '' }}</div>
                </td>
                <td class="px-3 py-2 text-sm dark:text-gray-300">{{ dbl.origin || '-' }} → {{ dbl.destination || '-' }}</td>
                <td class="px-3 py-2 text-sm text-center">{{ dbl.shipment_count || 0 }}</td>
                <td class="px-3 py-2 text-sm text-right">{{ formatRupiah(dbl.total_nominal || 0) }}</td>
                <td class="px-3 py-2">
                  <Badge :variant="getStatusVariant(dbl.status)">
                    {{ statusOptions.find(o => o.value === dbl.status)?.label || dbl.status }}
                  </Badge>
                </td>
                <td class="px-3 py-2 text-right space-x-1">
                  <Button variant="success" class="px-2 py-1 h-7 text-xs" @click="openShipmentModal(dbl)">Resi</Button>
                  <Button variant="warning" class="px-2 py-1 h-7 text-xs" @click="printDaftarMuat(dbl)">Print</Button>
                  <Button v-if="permissions.canViewKeuangan" variant="info" class="px-2 py-1 h-7 text-xs" @click="openInvoiceModal(dbl)">Invoice</Button>
                  <Button variant="primary" class="px-2 py-1 h-7 text-xs" @click="openEditModal(dbl)">Edit</Button>
                  <Button variant="default" class="px-2 py-1 h-7 text-xs text-red-600" @click="deleteDBL(dbl.id)">Hapus</Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="lg:hidden space-y-3 mt-4">
        <div class="mb-3">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari no DBL, plat, supir, rute..."
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 dark:border-gray-600"
          >
        </div>
        <div v-for="dbl in filteredDblList" :key="dbl.id" class="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-start">
            <div class="font-medium dark:text-gray-200">{{ dbl.dbl_number || 'DBL-' + dbl.id }}</div>
            <Badge :variant="getStatusVariant(dbl.status)">
              {{ statusOptions.find(o => o.value === dbl.status)?.label || dbl.status }}
            </Badge>
          </div>
          <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ dbl.dbl_date ? formatDate(dbl.dbl_date) : '-' }}
          </div>
          <div class="mt-2 text-sm text-gray-700 dark:text-gray-300 space-y-1">
            <div class="font-medium">{{ dbl.origin || '-' }} → {{ dbl.destination || '-' }}</div>
            <div class="flex flex-wrap gap-2">
              <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                {{ dbl.vehicle_plate || '-' }}
              </span>
              <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                {{ dbl.driver_name || '-' }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-full bg-black text-white">{{ dbl.shipment_count || 0 }} resi</span>
              <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">{{ formatRupiah(dbl.total_nominal || 0) }}</span>
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-2">
            <Button block variant="success" @click="openShipmentModal(dbl)">Resi</Button>
            <Button block variant="warning" @click="printDaftarMuat(dbl)">Print</Button>
            <Button v-if="permissions.canViewKeuangan" block variant="info" @click="openInvoiceModal(dbl)">Invoice</Button>
            <Button block variant="primary" @click="openEditModal(dbl)">Edit</Button>
          </div>
        </div>
      </div>

      <div class="lg:hidden fixed bottom-16 right-4 z-40">
        <Button variant="primary" class="rounded-full w-14 h-14 flex items-center justify-center shadow-lg text-2xl" @click="openCreateModal">
          +
        </Button>
      </div>
    </div>

    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" @click.self="showModal = false">
      <div class="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold dark:text-gray-100">{{ editingId ? 'Edit DBL' : 'Buat DBL Baru' }}</h3>
        </div>
        
        <div class="flex-1 overflow-auto p-4 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1 dark:text-gray-300">No. DBL</label>
              <input v-model="form.dbl_number" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100" placeholder="DBL-001" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1 dark:text-gray-300">Tanggal Berangkat</label>
              <input v-model="form.departure_date" type="date" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100" />
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1 dark:text-gray-300">No. Kendaraan</label>
              <input v-model="form.vehicle_number" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100" placeholder="BK 1234 AB" />
            </div>
            <div>
              <DriverAutocomplete v-model="form.driver_name" label="Nama Supir" placeholder="Ketik nama supir..." />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1 dark:text-gray-300">No. HP Supir</label>
            <input v-model="form.driver_phone" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100" placeholder="08xx" />
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <CityAutocomplete v-model="form.origin" label="Asal" placeholder="Kota asal" />
            </div>
            <div>
              <CityAutocomplete v-model="form.destination" label="Tujuan" placeholder="Kota tujuan" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1 dark:text-gray-300">Nama Pengurus</label>
              <input v-model="form.pengurus_name" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100" placeholder="Nama pengurus" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1 dark:text-gray-300">Status</label>
              <select v-model="form.status" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100">
                <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1 dark:text-gray-300">Catatan</label>
            <textarea v-model="form.catatan" rows="2" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100" placeholder="Catatan tambahan..."></textarea>
          </div>
        </div>
        
        <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <Button variant="default" @click="showModal = false">Batal</Button>
          <Button variant="primary" @click="saveDBL">Simpan</Button>
        </div>
      </div>
    </div>

    <div v-if="showShipmentModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" @click.self="showShipmentModal = false">
      <div class="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold dark:text-gray-100">Kelola Resi - {{ selectedDbl?.dbl_number || 'DBL' }}</h3>
        </div>
        
        <div class="flex-1 overflow-auto p-4 space-y-4">
          <div v-if="loadingShipments" class="text-center py-8 text-gray-500">Loading...</div>
          
          <template v-else>
            <div class="mb-4">
              <h4 class="font-medium mb-2 dark:text-gray-200">Resi dalam DBL ini ({{ dblShipments.length }})</h4>
              <div v-if="dblShipments.length === 0" class="text-sm text-gray-500">Belum ada resi</div>
              <div v-else class="space-y-2 max-h-48 overflow-auto">
                <div v-for="s in dblShipments" :key="s.id" class="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded-lg">
                  <div class="text-sm">
                    <div class="font-medium dark:text-gray-200">{{ s.spb_number || s.public_code }}</div>
                    <div class="text-gray-500 text-xs">{{ s.customer_name }} | {{ s.origin }} → {{ s.destination }} | {{ formatRupiah(s.nominal) }}</div>
                  </div>
                  <Button variant="default" class="text-red-600 px-2 py-1 h-7 text-xs" @click="removeShipment(s.id)">Hapus</Button>
                </div>
              </div>
              <div class="text-right mt-2 font-medium dark:text-gray-200">Total: {{ formatRupiah(totalNominal) }}</div>
            </div>
            
            <div>
              <h4 class="font-medium mb-2 dark:text-gray-200">Tambah Resi ({{ availableShipments.length }}/{{ availableShipmentsTotal }} tersedia)</h4>
              <input 
                v-model="shipmentSearchQuery" 
                type="text" 
                placeholder="Cari no SPB, kota, pengirim, penerima, barang..." 
                class="w-full px-3 py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100 text-sm"
              />
              <div v-if="availableShipments.length === 0" class="text-sm text-gray-500 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                Tidak ada resi yang tersedia. Pastikan sudah membuat resi di menu "Barang Keluar" terlebih dahulu.
              </div>
              <div v-else class="space-y-2 max-h-64 overflow-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2">
                <div v-if="availableShipments.length === 0" class="text-sm text-gray-500 p-2 text-center">
                  Tidak ada resi yang cocok dengan pencarian
                </div>
                <label v-for="s in availableShipments" :key="s.id" class="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                  <input type="checkbox" :value="s.id" v-model="selectedShipmentIds" class="rounded" />
                  <div class="text-sm flex-1">
                    <div class="font-medium dark:text-gray-200">{{ s.spb_number || s.public_code || 'RESI-' + s.id }}</div>
                    <div class="text-gray-500 text-xs">
                      {{ s.customer_name || '-' }} | {{ s.origin }} → {{ s.destination }} | {{ s.total_colli || 1 }} colli
                    </div>
                    <div class="text-gray-400 text-xs">{{ formatRupiah(s.nominal || 0) }}</div>
                  </div>
                </label>
              </div>
              <div v-if="availableShipments.length < availableShipmentsTotal" class="flex gap-2 mt-2">
                <Button variant="default" class="flex-1" @click="loadMoreShipments" :disabled="loadingShipments">
                  {{ loadingShipments ? 'Loading...' : `Muat lebih banyak (${availableShipments.length}/${availableShipmentsTotal})` }}
                </Button>
              </div>
              <Button v-if="selectedShipmentIds.length > 0" variant="primary" class="w-full mt-2" @click="addSelectedShipments">
                Tambahkan {{ selectedShipmentIds.length }} Resi
              </Button>
            </div>
          </template>
        </div>
        
        <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <Button variant="default" @click="showShipmentModal = false">Tutup</Button>
        </div>
      </div>
    </div>

    <div v-if="showInvoiceModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" @click.self="showInvoiceModal = false">
      <div class="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 space-y-4">
        <h3 class="text-lg font-semibold dark:text-gray-100">Generate Invoice</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Invoice akan di-generate per customer berdasarkan resi dalam DBL {{ selectedDbl?.dbl_number || '' }}.
        </p>
        
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-300">PPh (%) - Opsional</label>
          <input v-model="pphPercent" type="number" step="0.1" min="0" max="100" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100" placeholder="0" />
          <p class="text-xs text-gray-500 mt-1">Kosongkan atau isi 0 jika tidak ada PPh</p>
        </div>
        
        <div class="flex justify-end gap-2 pt-4">
          <Button variant="default" @click="showInvoiceModal = false">Batal</Button>
          <Button variant="primary" @click="generateInvoices">Generate Invoice</Button>
        </div>
      </div>
    </div>
  </div>
</template>
