<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import Button from '../components/ui/Button.vue';
import Badge from '../components/ui/Badge.vue';
import CityAutocomplete from '../components/CityAutocomplete.vue';
import { useFormatters } from '../composables/useFormatters';
import { useAuth } from '../composables/useAuth';
import { getCompany } from '../lib/company';
import { getCityPlateCode } from '../lib/vehiclePlateCode';
import { Icon } from '@iconify/vue';
import JsBarcode from 'jsbarcode';
const LOGO_URL = '/brand/logo.png';

const { permissions, fetchUser } = useAuth();
const canDelete = computed(() => permissions.value.canDeleteShipment);
const canEdit = computed(() => permissions.value.canEditShipment);

function toInputDate(val: string | null | undefined): string {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const { formatDate } = useFormatters();

type Shipment = {
  id: number;
  spb_number: string | null;
  customer_id: number | null;
  customer_name: string | null;
  customer_address: string | null;
  pengirim_name: string | null;
  penerima_name: string | null;
  penerima_phone: string | null;
  origin: string;
  destination: string;
  eta: string | null;
  status: string;
  total_colli: number;
  qty: number;
  satuan: string | null;
  berat: number;
  macam_barang: string | null;
  nominal: number;
  public_code: string | null;
  vehicle_plate_region: string | null;
  service_type: string | null;
  jenis: string | null;
  dbl_id: number | null;
  invoice_generated: boolean;
  keterangan: string | null;
  created_at: string;
  dbl_number?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  vehicle_plate?: string | null;
};

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
  qty: string;
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

const shipments = ref<Shipment[]>([]);
const loading = ref(true);
const saving = ref(false);
const loadModalContent = ref(false);
const showModal = ref(false);
const showCustomerPicker = ref(false);
const showAddCustomerForm = ref(false);
const customerList = ref<{ id: number; name: string; phone: string | null; address: string | null }[]>([]);
const frequentCustomers = ref<{ id: number; name: string; phone: string | null; address: string | null }[]>([]);
const customerSearch = ref('');
const editingId = ref<number | null>(null);
const searchQuery = ref('');
const newCustomerForm = ref({
  name: '',
  pengirim_name: '',
  phone: '',
  address: ''
});
const isCreatingCustomer = ref(false);
const form = ref<ShipmentForm>({
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
  qty: '1',
  satuan: 'KG',
  berat: '0',
  nominal: '0',
  total_colli: '1',
  keterangan: '',
  vehicle_plate_region: '',
  eta: '',
  status: 'DRAFT',
  service_type: 'CARGO',
  jenis: 'FRANCO',
  regenerate_code: false
});

// validation errors keyed by field name
const validationErrors = ref<Record<string, string>>({});

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
  const jenisOptions = ['TJ', 'LPT', 'LJ', 'FRANCO', 'LB'];
  if (f.jenis && !jenisOptions.includes(String(f.jenis).toUpperCase())) errors.jenis = 'Jenis tidak valid';

  validationErrors.value = errors;
  return { ok: Object.keys(errors).length === 0, errors };
}

watch(() => form.value.destination, (val: string) => {
  if (val && String(val).trim()) {
    delete validationErrors.value.destination;
    autoDetectPlateCode(val);
  }
});

const jenisOptions = [
  { value: 'FRANCO', label: 'FRANCO' },
  { value: 'TJ', label: 'Tagihan Jakarta' },
  { value: 'LPT', label: 'Lunas PT' },
  { value: 'LJ', label: 'Lunas Jakarta' },
  { value: 'LB', label: 'Lunas Bali' }
];

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

const filteredCustomerList = computed(() => {
  const search = customerSearch.value.trim().toLowerCase();
  if (!search) return customerList.value;
  return customerList.value.filter(c =>
    c.name.toLowerCase().includes(search) ||
    (c.phone || '').toLowerCase().includes(search) ||
    (c.address || '').toLowerCase().includes(search)
  );
});

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

const statusOptions = [
  { value: 'LOADING', label: 'Loading', variant: 'warning' },
  { value: 'IN_TRANSIT', label: 'In Transit', variant: 'info' }
];

const allStatusOptions = [
  { value: 'DRAFT', label: 'Draft', variant: 'default' },
  { value: 'READY', label: 'Ready', variant: 'info' },
  { value: 'LOADING', label: 'Loading', variant: 'warning' },
  { value: 'IN_TRANSIT', label: 'In Transit', variant: 'info' },
  { value: 'DELIVERED', label: 'Delivered', variant: 'success' }
];

const selectedShipment = ref<Shipment | null>(null);
const showBarcodeModal = ref(false);
const modalBarcodeValue = ref<string>('');

function autoDetectPlateCode(cityName: string) {
  const code = getCityPlateCode(cityName);
  if (code) {
    form.value.vehicle_plate_region = code;
    delete validationErrors.value.vehicle_plate_region;
  }
}

function viewBarcode(shipment: Shipment) {
  selectedShipment.value = shipment;
  showBarcodeModal.value = true;
  modalBarcodeValue.value = shipment.spb_number || `SPB-${shipment.id}`;
}

async function loadShipments() {
  loading.value = true;
  try {
    const searchParam = searchQuery.value.trim() ? `&search=${encodeURIComponent(searchQuery.value)}` : '';
    const res = await fetch(`/api/shipments?endpoint=list${searchParam}`);
    const data = await res.json();
    shipments.value = data.items || [];
  } catch (e) {
    console.error('Failed to load shipments:', e);
  } finally {
    loading.value = false;
  }
}

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(searchQuery, () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadShipments();
  }, 300);
});

function openCreateModal() {
  editingId.value = null;
  form.value = {
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
    qty: '1',
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
  validationErrors.value = {};
  showModal.value = true;
  loadModalContent.value = true;
}

function openEditModal(shipment: Shipment) {
  editingId.value = shipment.id;
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
    qty: String(shipment.qty || 1),
    satuan: shipment.satuan || 'KG',
    berat: String((shipment as unknown as { berat?: number }).berat || 0),
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
  showModal.value = true;
  loadModalContent.value = true;
  validationErrors.value = {};
}

async function saveShipment() {
  const totalColli = parseInt(form.value.total_colli) || 1;
  const qtyVal = parseInt(form.value.qty) || 1;
  const beratVal = parseFloat(form.value.berat) || 0;
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
    if (editingId.value) {
      const res = await fetch('/api/shipments?endpoint=update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId.value,
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
          qty: qtyVal,
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
          qty: qtyVal,
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
    showModal.value = false;
    loadModalContent.value = false;
    await loadShipments();
  } catch (e) {
    console.error('Save error:', e);
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    alert(`Gagal menyimpan shipment: ${errorMessage}`);
  } finally {
    saving.value = false;
  }
}

async function deleteShipment(id: number) {
  if (!confirm('Yakin ingin menghapus shipment ini?')) return;
  
  try {
    const res = await fetch(`/api/shipments?endpoint=delete&id=${id}`, { method: 'DELETE' });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || errorData.details || 'Delete failed');
    }
    
    await loadShipments();
  } catch (e) {
    console.error('Delete error:', e);
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    alert(`Gagal menghapus shipment: ${errorMessage}`);
  }
}

function getStatusVariant(status: string): 'default' | 'info' | 'warning' | 'success' {
  const opt = allStatusOptions.find(o => o.value === status);
  return (opt?.variant || 'default') as 'default' | 'info' | 'warning' | 'success';
}

const statusLabelMap = computed(() => {
  return allStatusOptions.reduce((map, opt) => {
    map[opt.value] = opt;
    return map;
  }, {} as Record<string, { value: string; label: string; variant: string }>);
});

async function printLabel() {
  if (!selectedShipment.value) return;
  const origin = selectedShipment.value.origin;
  const dest = selectedShipment.value.destination;
  const customerName = selectedShipment.value.customer_name || '';
  const pengirimName = selectedShipment.value.pengirim_name || '';
  const penerimaName = selectedShipment.value.penerima_name || '';
  const penerimaPhone = selectedShipment.value.penerima_phone || '';
  const customerAddress = selectedShipment.value.customer_address || '';
  const colliTotal = selectedShipment.value.total_colli || 0;
  const serviceType = (selectedShipment.value.service_type || 'REG').toUpperCase();
  const spbNumber = selectedShipment.value.spb_number || '';
  const publicCode = selectedShipment.value.public_code || '';
  
  const resiNumber = spbNumber || `SPB-${selectedShipment.value.id}`;
  const barcodeValue = publicCode || `STE-${selectedShipment.value.id}`;

  let barcodeDataUrl: string | null = null;
  try {
    const canvas = document.createElement('canvas');
    const mmToPx = (mm: number) => Math.round(mm * 96 / 25.4);
    const targetW = mmToPx(86);
    const targetH = mmToPx(14);
    const scale = Math.max(1, Math.ceil((window.devicePixelRatio || 1)));
    canvas.width = targetW * scale;
    canvas.height = (targetH + 18) * scale;
    canvas.style.width = String(targetW) + 'px';
    canvas.style.height = String(targetH + 18) + 'px';

    JsBarcode(canvas, barcodeValue, {
      format: 'CODE128',
      displayValue: true,
      fontSize: Math.round(12 * scale),
      margin: 0,
      height: Math.round(targetH * 0.8 * scale),
      textMargin: Math.round(6 * scale),
      background: '#ffffff'
    });

    barcodeDataUrl = canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('Client-side barcode generation failed, falling back to server image', err);
    barcodeDataUrl = null;
  }

  // Use berat from shipment directly, fallback to colli items if not set
  let totalWeight = selectedShipment.value.berat || 0;
  if (totalWeight === 0) {
    try {
      const colliRes = await fetch(`/api/colli?endpoint=list&shipment_id=${selectedShipment.value.id}`);
      if (colliRes.ok) {
        const colliData = await colliRes.json();
        const items = (colliData.items || []) as Array<{ kg_m3?: number | null }>;
        totalWeight = items.reduce((sum, it) => sum + (Number(it.kg_m3) || 0), 0);
      }
    } catch { void 0; }
  }
  const weightDisplay = totalWeight > 0 ? `${totalWeight.toFixed(2)} kg` : '-';

  const company = await getCompany();
  const etaDisplay = selectedShipment.value?.eta ? formatDate(selectedShipment.value.eta) : '';

  const win = window.open('', '_blank');
  if (!win) return;
  const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const addrHtml = esc(customerAddress).replace(/\n/g, '<br />');
  const originEsc = esc(origin);
  const destEsc = esc(dest);
  const customerNameHtml = esc(customerName);
  const penerimaNameHtml = esc(penerimaName);
  const penerimaPhoneHtml = esc(penerimaPhone);

  // Generated timestamp for this printed label (changes every print)
  const printedAt = new Date();
  const printedAtDisplay = `${printedAt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} ${printedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;

  win.document.write(`<!DOCTYPE html><html><head><title>Print Label</title><style>
  @page { size: 100mm 150mm; margin: 0; }
  html,body { height:100%; margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Inter', Arial, sans-serif; -webkit-print-color-adjust: exact; }
  /* Page container that matches canvas */
  .page { width: 100mm; height: 150mm; position: relative; box-sizing: border-box; }
  /* Generated timestamp sits outside the outer border but inside the page (bottom-right) */
  .generated { position: absolute; bottom: 2mm; right: 4mm; font-style: italic; font-size:9px; color:#6b7280; z-index:5; }
      /* Outer wrapper positioned below the generated area.
        Reduce top offset and remove outer border to avoid duplicate borders (we keep the inner border). */
      .wrap { position: absolute; top: 2mm; left: 1mm; right: 1mm; bottom: 1mm; box-sizing: border-box; padding: 1mm; border: none; }
  /* Inner content keeps its subtle border */
  .inner { padding: 2mm; display:flex; flex-direction:column; gap: 1.5mm; border: 1px solid #d1d5db; height: 100%; box-sizing: border-box; position: relative; }
    .header { display:flex; align-items:center; justify-content:space-between; }
    .company { font-weight:800; font-size:12px; letter-spacing:.3px; }
    .logo { width: 9mm; height: 9mm; object-fit: contain; }
    .resi-row { display:flex; align-items:center; gap: 2mm; }
    .resi { flex:1; background:#111827; color:#fff; border-radius:2px; padding:1.5mm 2mm; }
    .resi .label { font-size:7px; opacity:0.8; }
    .resi .code { font-size:11px; font-weight:700; letter-spacing: .4px; margin-top:1mm; word-break:break-all; }
    .qr { width: 18mm; height: 18mm; border:1px solid #e5e7eb; background:#fff; border-radius:2px; }
    .route { background:#e5e7eb; color:#111827; border-radius:2px; padding:1mm 2mm; font-size:10px; font-weight:600; }
    .eta-box { font-size:10px; color:#374151; background:transparent; margin-top:1.5mm; padding:0 1.5mm; }
    .section { border:1px solid #d1d5db; border-radius:2px; padding:1.5mm 2mm; }
    .section .title { font-size:8px; color:#6b7280; text-transform:uppercase; margin-bottom:1mm; }
    .section .value { font-size:10px; line-height:1.25; }
    .info { display:flex; gap:1.5mm; }
    .info .box { flex:1; border:1px solid #d1d5db; border-radius:2px; padding:1.5mm; text-align:center; }
    .info .box .k { font-size:8px; color:#6b7280; text-transform:uppercase; }
    .info .box .v { font-size:11px; font-weight:700; margin-top:1mm; }
    .barcode-wrap { margin-top:auto; display:flex; flex-direction:column; align-items:center; padding-bottom:1mm; }
    .barcode-crop { width: 86mm; height: 18mm; overflow: visible; display:block; }
    .barcode { width: 100%; height: auto; object-fit: contain; display:block; border: none; margin: 0; padding: 0; transform: none; }
  </style></head><body>`);
    win.document.write(`<div class="page"><div class="generated">Generated: ${esc(printedAtDisplay)}</div><div class="wrap"><div class="inner">
    <div class="header">
      <div class="company">${esc(company?.name || 'PERUSAHAAN')}</div>
      <img class="logo" src="${LOGO_URL}" alt="Logo" />
    </div>
    <div class="resi-row">
      <div class="resi"><div class="label">Nomor Resi / Tracking Number</div><div class="code">${esc(resiNumber)}</div></div>
      <img class="qr" src="/api/blob?endpoint=generate&code=${encodeURIComponent(resiNumber)}&type=qr" alt="QR" />
    </div>
    <div class="route">${originEsc} → ${destEsc}</div>
    ${etaDisplay ? `<div class="eta-box">ETA: ${esc(etaDisplay)}</div>` : ''}
    <div class="section"><div class="title">Pengirim / Sender</div><div class="value">${esc(pengirimName) || '-'}</div></div>
    <div class="section"><div class="title">Penerima / Recipient</div><div class="value"><div>${penerimaNameHtml || customerNameHtml}</div>${penerimaPhoneHtml ? `<div style="font-size:9px;color:#6b7280;margin-top:1mm">${penerimaPhoneHtml}</div>` : ''}<div style="margin-top:1mm">${addrHtml}</div></div></div>
    <div class="info">
      <div class="box"><div class="k">Berat</div><div class="v">${esc(weightDisplay)}</div></div>
      <div class="box"><div class="k">Layanan</div><div class="v">${esc(serviceType)}</div></div>
      <div class="box"><div class="k">Koli</div><div class="v">1 / ${esc(String(colliTotal || 0))}</div></div>
    </div>
    <div class="barcode-wrap"><div class="barcode-crop"><img class="barcode" src="${esc(barcodeDataUrl || (`/api/blob?endpoint=generate&code=${encodeURIComponent(barcodeValue)}&type=barcode`))}" alt="Barcode" /></div></div>
  </div></div></div>`);
  win.document.write('</body></html>');
  win.document.close();
  win.focus();
  win.print();
  setTimeout(() => win.close(), 500);
}

onMounted(() => {
  fetchUser();
  loadShipments();
});
</script>

<template>
  <div class="space-y-4 pb-20 lg:pb-0 overflow-x-hidden">
    <div class="w-full max-w-6xl mx-auto min-w-0">
      <div class="hidden lg:flex items-center justify-between flex-wrap gap-3">
        <div class="text-xl font-semibold dark:text-gray-100">
          SPB (Barang Masuk)
        </div>
        <div class="flex gap-2 flex-1 lg:flex-initial min-w-0 max-w-md">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari kode, SPB, DBL, supir, customer, rute..."
            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 dark:border-gray-600"
          >
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
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 sticky top-0">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Kode</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">SPB</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">DBL / Supir</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Penerima</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Rute</th>
                <th class="px-3 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300">Colli</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Status</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-if="shipments.length === 0">
                <td colspan="8" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada shipment</td>
              </tr>
              <tr v-for="ship in shipments" :key="ship.id" class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                <td class="px-2 py-2 text-xs font-medium dark:text-gray-200">
                  {{ ship.public_code }}
                </td>
                <td class="px-2 py-2 text-xs dark:text-gray-300">
                  <span class="inline-block text-[10px] leading-tight bg-black text-white rounded px-1 py-0.5">
                    {{ ship.spb_number || `SPB-${ship.id}` }}
                  </span>
                </td>
                <td class="px-2 py-2 text-xs dark:text-gray-300">
                  <div class="flex flex-col gap-0.5">
                    <div class="text-gray-600 dark:text-gray-400 truncate">
                      <span v-if="ship.dbl_number" class="font-medium">{{ ship.dbl_number }}</span>
                      <span v-else class="text-gray-400">-</span>
                    </div>
                    <div class="text-gray-500 dark:text-gray-400 truncate">
                      {{ ship.driver_name || '-' }}
                    </div>
                  </div>
                </td>
                <td class="px-2 py-2 text-xs dark:text-gray-300">
                  <div class="font-medium truncate">{{ ship.penerima_name || ship.customer_name || '-' }}</div>
                  <div class="text-gray-500 dark:text-gray-400 truncate text-[10px]">{{ ship.penerima_phone || '' }}</div>
                </td>
                <td class="px-2 py-2 text-xs dark:text-gray-300">
                  <div class="truncate">{{ ship.origin }} → {{ ship.destination }}</div>
                </td>
                <td class="px-2 py-2 text-xs text-center dark:text-gray-300">{{ ship.total_colli }}</td>
                <td class="px-2 py-2">
                  <Badge :variant="getStatusVariant(ship.status)" class="text-xs">{{ statusLabelMap[ship.status]?.label || ship.status }}</Badge>
                </td>
                <td class="px-2 py-2 text-right">
                  <div class="flex gap-1 justify-end">
                    <Button variant="success" class="px-2 py-1 h-7 text-xs" @click="viewBarcode(ship)" title="Barcode">Barcode</Button>
                    <Button v-if="canEdit" variant="primary" class="px-2 py-1 h-7 text-xs" @click="openEditModal(ship)" title="Edit">Edit</Button>
                    <Button v-if="canDelete" variant="default" class="px-2 py-1 h-7 text-xs text-red-600 hover:text-red-700 bg-red-50 dark:bg-red-900/20" @click="deleteShipment(ship.id)" title="Delete">Del</Button>
                  </div>
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
        <div class="flex-1 w-full max-w-5xl mx-auto py-4 px-2 lg:px-0 space-y-4">
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="flex-1 min-w-0">
              <input
                v-model="searchQuery"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Cari kode, SPB, DBL, supir, customer, rute, barang..."
              />
            </div>
            <Button variant="primary" @click="openCreateModal" class="ml-2">+ Tambah</Button>
          </div>
          <div class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div v-for="s in shipments" :key="s.id" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3 transition-all duration-200 hover:shadow-md min-w-0 flex flex-col">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-semibold dark:text-gray-100 truncate">{{ s.public_code }}</div>
                    <div class="mt-0.5">
                      <span class="inline-block text-[11px] leading-tight bg-black text-white rounded px-1.5 py-0.5">
                        SPB: {{ s.spb_number || `SPB-${s.id}` }}
                      </span>
                    </div>
                    <div class="flex flex-wrap gap-2 mt-1">
                      <span
                        v-if="s.dbl_number"
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-[11px]"
                      >
                        {{ s.dbl_number }}
                      </span>
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-[11px]">
                        {{ s.driver_name || 'Belum ada supir' }}
                        <span v-if="s.vehicle_plate" class="text-gray-500 dark:text-gray-400">| {{ s.vehicle_plate }}</span>
                      </span>
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{{ s.customer_name || '-' }}</div>
                    <div class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{{ s.customer_address || '' }}</div>
                  </div>
                  <Badge :variant="getStatusVariant(s.status)" class="flex-shrink-0">{{ statusLabelMap[s.status]?.label || s.status }}</Badge>
                </div>
                <div class="text-xs space-y-1.5">
                  <div class="flex items-start gap-2">
                    <Icon icon="mdi:map-marker-outline" class="text-base text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                    <span class="dark:text-gray-300 text-xs leading-tight break-all">{{ s.origin }} → {{ s.destination }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <Icon icon="mdi:archive-outline" class="text-base text-gray-500 dark:text-gray-400 flex-shrink-0" />
                    <span class="dark:text-gray-300 text-xs">{{ s.total_colli }} colli</span>
                  </div>
                  <div v-if="s.eta" class="flex items-center gap-2">
                    <Icon icon="mdi:calendar-outline" class="text-base text-gray-500 dark:text-gray-400 flex-shrink-0" />
                    <span class="dark:text-gray-300 text-xs">{{ formatDate(s.eta) }}</span>
                  </div>
                </div>
                <div class="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700 min-w-0">
                  <Button block variant="success" @click="viewBarcode(s)" title="Barcode">Barcode</Button>
                  <Button v-if="canEdit" block variant="primary" @click="openEditModal(s)" title="Edit">Edit</Button>
                  <Button v-if="canDelete" block variant="default" class="text-red-600 hover:text-red-700 bg-red-50 rounded-lg" @click="deleteShipment(s.id)" title="Hapus">Hapus</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 pt-4 px-4 pb-[60px] lg:p-4" @click.self="showModal = false">
      <div class="bg-white rounded-xl w-full max-w-2xl card flex flex-col h-[calc(100vh-60px)] lg:max-h-[90vh]">
        <div class="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 z-10">
          <h3 class="text-base font-semibold">{{ editingId ? 'Edit SPB' : 'Tambah SPB Baru' }}</h3>
        </div>
        <div v-if="loadModalContent" class="px-4 py-3 overflow-auto flex-1 space-y-1.5">
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
          <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
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
              <label class="block text-sm font-medium mb-1">Qty</label>
              <input
                v-model="form.qty"
                type="number"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="1"
                @focus="($event.target as HTMLInputElement).select()"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Berat (KG)</label>
              <input
                v-model="form.berat"
                type="number"
                step="0.01"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="0"
                @focus="($event.target as HTMLInputElement).select()"
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
            @click="showModal = false"
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
      v-if="showBarcodeModal && selectedShipment"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="showBarcodeModal = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden card">
        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
          <div class="text-lg font-semibold dark:text-gray-100">
            Barcode - {{ modalBarcodeValue }}
          </div>
        </div>
        <div class="p-6 overflow-y-auto flex-1 space-y-4">
          <div class="text-sm text-gray-500 dark:text-gray-400 text-center">
            <div class="font-medium">{{ selectedShipment.customer_name || '-' }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ selectedShipment.customer_address || '-' }}</div>
          </div>
          <div class="text-center">
            <div class="text-sm text-gray-600 dark:text-gray-300 mb-2">
              QR Code
            </div>
            <img
              :src="`/api/blob?endpoint=generate&code=${modalBarcodeValue}&type=qr`"
              alt="QR Code"
              class="mx-auto border border-gray-200 dark:border-gray-600 p-2 rounded"
            >
          </div>
          <div class="text-center">
            <div class="text-sm text-gray-600 dark:text-gray-300 mb-2">
              Barcode (Code 128)
            </div>
            <img
              :src="`/api/blob?endpoint=generate&code=${modalBarcodeValue}&type=barcode`"
              alt="Barcode"
              class="mx-auto border border-gray-200 dark:border-gray-600 p-2 rounded"
            >
          </div>
        </div>
        <div class="flex gap-2 justify-end border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
          <Button
            variant="primary"
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
  </div>
</template>
