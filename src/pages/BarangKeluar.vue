<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import Button from '../components/ui/Button.vue';
import Badge from '../components/ui/Badge.vue';
import ShipmentFormModal from '../components/ShipmentFormModal.vue';
import { useFormatters } from '../composables/useFormatters';
import { useAuth } from '../composables/useAuth';
import { getCompany } from '../lib/company';
import { Icon } from '@iconify/vue';
import JsBarcode from 'jsbarcode';
import type { Shipment } from '../types/shipment';
const LOGO_URL = '/brand/logo.png';

const { permissions, fetchUser } = useAuth();
const canDelete = computed(() => permissions.value.canDeleteShipment);
const canEdit = computed(() => permissions.value.canEditShipment);

const { formatDate, formatRupiah } = useFormatters();

const loading = ref(true);
const searchQuery = ref('');
const showFormModal = ref(false);
const activeTab = ref<'unloaded' | 'loaded'>('unloaded');
const selectedRegion = ref('');
const editingShipment = ref<Shipment | null>(null);
const selectedShipment = ref<Shipment | null>(null);
const showBarcodeModal = ref(false);
const modalBarcodeValue = ref<string>('');

const tabOptions = [
  { key: 'unloaded', label: 'Belum dikirim' },
  { key: 'loaded', label: 'Sudah dikirim' }
] as const;

const regionOptions = [
  { value: '', label: 'Semua Wilayah' },
  { value: 'BALI', label: 'Bali' },
  { value: 'KALIMANTAN', label: 'Kalimantan' },
  { value: 'SUMATERA', label: 'Sumatera' },
  { value: 'SULAWESI', label: 'Sulawesi' },
  { value: 'PAPUA', label: 'Papua' },
  { value: 'JAWA_TENGAH', label: 'Jawa Tengah' },
  { value: 'JAWA_TIMUR', label: 'Jawa Timur' },
  { value: 'SUMBAWA', label: 'Sumbawa' },
  { value: 'LOMBOK', label: 'Lombok' },
  { value: 'NTT', label: 'NTT' },
  { value: 'MALUKU', label: 'Maluku' }
];

const allStatusOptions = [
  { value: 'DRAFT', label: 'Draft', variant: 'default' },
  { value: 'READY', label: 'Ready', variant: 'info' },
  { value: 'LOADING', label: 'Loading', variant: 'warning' },
  { value: 'IN_TRANSIT', label: 'In Transit', variant: 'info' },
  { value: 'DELIVERED', label: 'Delivered', variant: 'success' }
];

function viewBarcode(shipment: Shipment) {
  selectedShipment.value = shipment;
  showBarcodeModal.value = true;
  modalBarcodeValue.value = shipment.spb_number || `SPB-${shipment.id}`;
}

function formatPublicCode(code: string | null | undefined): string {
  const val = String(code || '').trim();
  if (!val) return '-';
  const idx = val.indexOf('-');
  if (idx < 0) return val;
  return `${val.slice(0, idx + 1)}\n${val.slice(idx + 1)}`;
}

function getRegionFromDestination(destination: string): string {
  const dest = (destination || '').toUpperCase();
  if (dest.includes('BALI') || dest.includes('DENPASAR') || dest.includes('SINGARAJA') || dest.includes('GIANYAR') || dest.includes('TABANAN') || dest.includes('KLUNGKUNG') || dest.includes('KARANGASEM') || dest.includes('BULELENG') || dest.includes('BADUNG') || dest.includes('JEMBRANA') || dest.includes('BANGLI')) return 'BALI';
  if (dest.includes('KALIMANTAN') || dest.includes('BANJARMASIN') || dest.includes('PONTIANAK') || dest.includes('BALIKPAPAN') || dest.includes('SAMARINDA') || dest.includes('PALANGKARAYA') || dest.includes('TARAKAN') || dest.includes('BONTANG') || dest.includes('KALTIM') || dest.includes('KALSEL') || dest.includes('KALBAR') || dest.includes('KALTENG') || dest.includes('KALTARA')) return 'KALIMANTAN';
  if (dest.includes('SUMATERA') || dest.includes('SUMATRA') || dest.includes('MEDAN') || dest.includes('PALEMBANG') || dest.includes('PADANG') || dest.includes('PEKANBARU') || dest.includes('LAMPUNG') || dest.includes('JAMBI') || dest.includes('BENGKULU') || dest.includes('ACEH') || dest.includes('BANGKA') || dest.includes('BELITUNG') || dest.includes('RIAU') || dest.includes('SIBOLGA')) return 'SUMATERA';
  if (dest.includes('SULAWESI') || dest.includes('MAKASSAR') || dest.includes('MANADO') || dest.includes('PALU') || dest.includes('KENDARI') || dest.includes('GORONTALO') || dest.includes('MAMUJU')) return 'SULAWESI';
  if (dest.includes('PAPUA') || dest.includes('JAYAPURA') || dest.includes('SORONG') || dest.includes('MERAUKE') || dest.includes('TIMIKA') || dest.includes('MANOKWARI') || dest.includes('BIAK')) return 'PAPUA';
  if (dest.includes('SEMARANG') || dest.includes('SOLO') || dest.includes('SURAKARTA') || dest.includes('KUDUS') || dest.includes('PEKALONGAN') || dest.includes('TEGAL') || dest.includes('MAGELANG') || dest.includes('PURWOKERTO') || dest.includes('CILACAP') || dest.includes('SALATIGA')) return 'JAWA_TENGAH';
  if (dest.includes('SURABAYA') || dest.includes('MALANG') || dest.includes('SIDOARJO') || dest.includes('JEMBER') || dest.includes('KEDIRI') || dest.includes('BLITAR') || dest.includes('PASURUAN') || dest.includes('MADIUN') || dest.includes('MOJOKERTO') || dest.includes('PROBOLINGGO') || dest.includes('BANYUWANGI') || dest.includes('GRESIK') || dest.includes('TUBAN') || dest.includes('LAMONGAN')) return 'JAWA_TIMUR';
  if (dest.includes('SUMBAWA') || dest.includes('BIMA') || dest.includes('DOMPU')) return 'SUMBAWA';
  if (dest.includes('LOMBOK') || dest.includes('MATARAM') || dest.includes('PRAYA')) return 'LOMBOK';
  if (dest.includes('KUPANG') || dest.includes('FLORES') || dest.includes('ENDE') || dest.includes('MAUMERE') || dest.includes('LABUAN BAJO') || dest.includes('RUTENG') || dest.includes('SUMBA') || dest.includes('WAINGAPU') || dest.includes('ATAMBUA') || dest.includes('ALOR') || dest.includes('LEMBATA') || dest.includes('ROTE')) return 'NTT';
  if (dest.includes('MALUKU') || dest.includes('AMBON') || dest.includes('TERNATE') || dest.includes('TUAL')) return 'MALUKU';
  return '';
}

function getRegionLabelFromDestination(destination: string): string {
  const key = getRegionFromDestination(destination);
  return regionOptions.find((o) => o.value === key)?.label || '';
}

const unloadedShipments = ref<Shipment[]>([]);
const loadedShipments = ref<Shipment[]>([]);

const filteredUnloadedShipments = computed(() => {
  let result = unloadedShipments.value;
  if (selectedRegion.value) {
    result = result.filter((s) => getRegionFromDestination(s.destination) === selectedRegion.value);
  }
  return result;
});

const filteredLoadedShipments = computed(() => {
  let result = loadedShipments.value;
  if (selectedRegion.value) {
    result = result.filter((s) => getRegionFromDestination(s.destination) === selectedRegion.value);
  }
  return result;
});

const filteredShipments = computed(() => {
  return activeTab.value === 'loaded' ? filteredLoadedShipments.value : filteredUnloadedShipments.value;
});

const loadedCount = computed(() => filteredLoadedShipments.value.length);
const unloadedCount = computed(() => filteredUnloadedShipments.value.length);

const totalNominal = computed(() => {
  return filteredShipments.value.reduce((sum, s) => sum + (Number(s.nominal) || 0), 0);
});

async function loadTabShipments(tab: 'unloaded' | 'loaded') {
  const shouldToggleLoading = tab === activeTab.value;
  const requestId = ++loadTabShipments.requestSeq[tab];
  if (shouldToggleLoading) {
    loading.value = true;
  }
  try {
    const params = new URLSearchParams({ endpoint: 'list' });
    const q = searchQuery.value.trim();
    const hasSearch = q.length > 0;
    if (hasSearch) params.set('search', q);

    if (tab === 'loaded') {
      // If searching, don't restrict by recent days.
      if (!hasSearch) params.set('days', '1');
      params.set('dbl', 'loaded');
      params.set('limit', hasSearch ? '500' : '500');
    } else {
      params.set('dbl', 'unloaded');
      params.set('limit', hasSearch ? '500' : '5000');
    }

    const res = await fetch(`/api/shipments?${params.toString()}`);
    const raw = (await res.json().catch(() => null)) as unknown;
    const data = (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}) as Record<string, unknown>;
    if (!res.ok) {
      const msg =
        (typeof data.error === 'string' && data.error) ||
        (typeof data.details === 'string' && data.details) ||
        `HTTP ${res.status}`;
      throw new Error(msg);
    }
    const itemsRaw = Array.isArray(data.items) ? data.items : [];
    const items: Shipment[] = itemsRaw as Shipment[];
    if (requestId !== loadTabShipments.requestSeq[tab]) return;
    if (tab === 'loaded') {
      loadedShipments.value = items.filter((s) => Boolean(s.dbl_id || s.dbl_number));
    } else {
      unloadedShipments.value = items.filter((s) => !s.dbl_id && !s.dbl_number);
    }
  } catch (e) {
    console.error('Failed to load shipments:', e);
    if (requestId === loadTabShipments.requestSeq[tab]) {
      if (tab === 'loaded') loadedShipments.value = [];
      else unloadedShipments.value = [];
    }
  } finally {
    if (shouldToggleLoading && requestId === loadTabShipments.requestSeq[tab] && tab === activeTab.value) {
      loading.value = false;
    }
  }
}
loadTabShipments.requestSeq = { unloaded: 0, loaded: 0 } as Record<'unloaded' | 'loaded', number>;

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let previousHadSearch = false;

watch(searchQuery, () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    const hasSearch = searchQuery.value.trim().length > 0;
    // Keep both tab counts in sync during search, even if the other tab isn't opened.
    if (hasSearch || previousHadSearch) {
      loadTabShipments('unloaded');
      loadTabShipments('loaded');
    } else {
      loadTabShipments(activeTab.value);
    }
    previousHadSearch = hasSearch;
  }, 300);
});

watch(activeTab, () => {
  loadTabShipments(activeTab.value);
});

function openCreateModal() {
  editingShipment.value = null;
  showFormModal.value = true;
}

function openEditModal(shipment: Shipment) {
  editingShipment.value = shipment;
  showFormModal.value = true;
}

function closeFormModal() {
  showFormModal.value = false;
  editingShipment.value = null;
}

async function handleShipmentSaved() {
  await loadTabShipments(activeTab.value);
  closeFormModal();
}

async function deleteShipment(shipment: Shipment) {
  const spbNumber = shipment.spb_number || `SPB-${shipment.id}`;
  const deleteMsg = `Ingin menghapus SPB "${spbNumber}"?\n\nCustomer: ${shipment.customer_name || '-'}\nPenerima: ${shipment.penerima_name || '-'}`;

  if (!confirm(deleteMsg)) return;
  
  try {
    const res = await fetch(`/api/shipments?endpoint=delete&id=${shipment.id}`, { method: 'DELETE' });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || errorData.details || 'Delete failed');
    }
    
    await loadTabShipments(activeTab.value);
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
  loadTabShipments('unloaded');
  loadTabShipments('loaded');
});
</script>

<template>
  <div class="space-y-4 pb-20 lg:pb-0 overflow-x-auto">
    <div class="w-full min-w-0">
      <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 px-4 lg:px-0">
        <div class="min-w-0">
          <div class="text-xl font-semibold dark:text-gray-100">
            SPB (Barang Masuk)
          </div>
          <div class="flex flex-wrap items-center gap-2 mt-2">
            <button
              v-for="tab in tabOptions"
              :key="tab.key"
              type="button"
              class="px-3 py-2 rounded-lg text-sm border transition-colors"
              :class="tab.key === activeTab
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600'"
              @click="activeTab = tab.key"
            >
              <span>{{ tab.label }}</span>
              <span
                class="ml-2 text-xs px-2 py-0.5 rounded-full"
                :class="tab.key === activeTab
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-100'"
              >
                {{ tab.key === 'unloaded' ? unloadedCount : loadedCount }}
              </span>
            </button>
          </div>
        </div>
        <div class="flex gap-2 w-full lg:w-auto">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari kode, SPB, DBL, supir, customer, rute..."
            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 dark:border-gray-600 text-sm"
          >
          <select
            v-model="selectedRegion"
            class="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 dark:border-gray-600 text-sm"
          >
            <option v-for="opt in regionOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <Button
            variant="primary"
            class="flex-shrink-0 text-sm px-3"
            @click="openCreateModal"
          >
            + Tambah
          </Button>
        </div>
      </div>

      <div
        v-if="!loading"
        class="px-4 lg:px-0 text-sm text-gray-600 dark:text-gray-300"
      >
        Total nominal: <span class="font-semibold text-gray-900 dark:text-gray-100">{{ formatRupiah(totalNominal) }}</span>
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
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden card transition-all duration-200"
      >
        <div class="overflow-x-auto w-full">
          <table class="w-full text-sm border-collapse">
            <thead class="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 sticky top-0">
              <tr>
                <th class="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap min-w-[90px]">Kode / SPB</th>
                <th class="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap min-w-[120px]">DBL / Supir</th>
                <th class="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap min-w-[150px]">Penerima</th>
                <th class="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap min-w-[180px]">Rute</th>
                <th class="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap min-w-[110px]">Wilayah</th>
                <th class="px-3 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap min-w-[120px]">Nominal</th>
                <th class="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">Colli</th>
                <th class="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">Status</th>
                <th class="px-3 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-if="filteredShipments.length === 0">
                <td colspan="9" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {{ activeTab === 'unloaded' ? 'Belum ada shipment belum dikirim' : 'Belum ada shipment sudah dikirim' }}
                </td>
              </tr>
              <tr v-for="ship in filteredShipments" :key="ship.id" class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150 border-b border-gray-100 dark:border-gray-700">
                <td class="px-3 py-3 text-xs dark:text-gray-300">
                  <div class="flex flex-col gap-1">
                    <div class="text-[10px] font-medium dark:text-gray-200 whitespace-pre-line leading-tight max-w-[90px]">
                      {{ formatPublicCode(ship.public_code) }}
                    </div>
                    <span class="inline-block text-[10px] leading-tight bg-black text-white rounded px-2 py-1 font-medium whitespace-nowrap">
                      {{ ship.spb_number || `SPB-${ship.id}` }}
                    </span>
                  </div>
                </td>
                <td class="px-3 py-3 text-xs dark:text-gray-300">
                  <div class="flex flex-col gap-1">
                    <div class="font-medium whitespace-nowrap">
                      <span v-if="ship.dbl_number">{{ ship.dbl_number }}</span>
                      <span v-else class="text-gray-400">-</span>
                    </div>
                    <div class="text-gray-500 dark:text-gray-400 whitespace-nowrap text-[11px]">
                      {{ ship.driver_name || '-' }}
                    </div>
                  </div>
                </td>
                <td class="px-3 py-3 text-xs dark:text-gray-300 min-w-[150px]">
                  <div class="font-medium">{{ ship.penerima_name || ship.customer_name || '-' }}</div>
                  <div class="text-gray-500 dark:text-gray-400 text-[10px]">{{ ship.penerima_phone || '' }}</div>
                </td>
                <td class="px-3 py-3 text-xs dark:text-gray-300 whitespace-normal break-words max-w-[240px]">
                  <div class="font-medium line-clamp-2 whitespace-normal break-words">{{ ship.origin }} → {{ ship.destination }}</div>
                </td>
                <td class="px-3 py-3 text-xs text-center dark:text-gray-300 font-medium whitespace-nowrap">
                  <span :title="ship.vehicle_plate_region || ''">
                    {{ getRegionLabelFromDestination(ship.destination) || '-' }}
                  </span>
                </td>
                <td class="px-3 py-3 text-xs text-right dark:text-gray-300 font-medium whitespace-nowrap tabular-nums">
                  {{ formatRupiah(ship.nominal || 0) }}
                </td>
                <td class="px-3 py-3 text-xs text-center dark:text-gray-300 font-medium whitespace-nowrap">
                  {{ ship.total_colli }}
                </td>
                <td class="px-3 py-3">
                  <Badge :variant="getStatusVariant(ship.status)" class="text-xs inline-block whitespace-nowrap">{{ statusLabelMap[ship.status]?.label || ship.status }}</Badge>
                </td>
                <td class="px-3 py-3 text-right">
                  <div class="flex gap-1 justify-end flex-wrap">
                    <Button variant="success" class="px-2 py-1 h-7 text-xs whitespace-nowrap" @click="viewBarcode(ship)" title="Barcode">Barcode</Button>
                    <Button v-if="canEdit" variant="primary" class="px-2 py-1 h-7 text-xs whitespace-nowrap" @click="openEditModal(ship)" title="Edit">Edit</Button>
                    <Button v-if="canDelete" variant="default" class="px-2 py-1 h-7 text-xs text-red-600 hover:text-red-700 bg-red-50 dark:bg-red-900/20 whitespace-nowrap" @click="deleteShipment(ship)" title="Delete">Del</Button>
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
        class="lg:hidden space-y-3 px-4 lg:px-0"
      >
        <div
          v-if="filteredShipments.length === 0"
          class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center"
        >
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ activeTab === 'unloaded' ? 'Belum ada shipment belum dikirim' : 'Belum ada shipment sudah dikirim' }}
          </p>
        </div>
        <div v-else class="space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div v-for="s in filteredShipments" :key="s.id" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3 transition-all duration-200 hover:shadow-md flex flex-col">
              <div class="flex items-start justify-between gap-2">
                <div class="flex-1">
                  <div class="text-xs font-semibold dark:text-gray-100 whitespace-pre-line leading-tight">{{ formatPublicCode(s.public_code) }}</div>
                  <div class="mt-0.5">
                    <span class="inline-block text-[10px] leading-tight bg-black text-white rounded px-1.5 py-0.5 font-medium">
                      {{ s.spb_number || `SPB-${s.id}` }}
                    </span>
                  </div>
                  <div class="flex flex-wrap gap-1 mt-2">
                    <span
                      v-if="s.dbl_number"
                      class="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-700 text-[10px]"
                    >
                      {{ s.dbl_number }}
                    </span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-[10px]">
                      {{ s.driver_name || '-' }}
                    </span>
                  </div>
                  <div class="text-xs text-gray-600 dark:text-gray-400 mt-2 font-medium">{{ s.penerima_name || s.customer_name || '-' }}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-500 truncate">{{ s.penerima_phone || '' }}</div>
                </div>
                <Badge :variant="getStatusVariant(s.status)" class="flex-shrink-0 text-xs">{{ statusLabelMap[s.status]?.label || s.status }}</Badge>
              </div>
              <div class="border-t border-gray-100 dark:border-gray-700 pt-2 space-y-1.5 text-xs">
                <div class="flex items-start gap-2">
                  <Icon icon="mdi:map-marker-outline" class="text-base text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
                  <span class="dark:text-gray-300 line-clamp-2 whitespace-normal break-words">{{ s.origin }} → {{ s.destination }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <Icon icon="mdi:map-outline" class="text-base text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <span class="dark:text-gray-300">
                    Wilayah: {{ getRegionLabelFromDestination(s.destination) || '-' }}
                    <span v-if="s.vehicle_plate_region" class="text-gray-400">({{ s.vehicle_plate_region }})</span>
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <Icon icon="mdi:archive-outline" class="text-base text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <span class="dark:text-gray-300">{{ s.total_colli }} colli</span>
                </div>
                <div class="flex items-center gap-2">
                  <Icon icon="mdi:cash" class="text-base text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <span class="dark:text-gray-300">Nominal: {{ formatRupiah(s.nominal || 0) }}</span>
                </div>
                <div v-if="s.eta" class="flex items-center gap-2">
                  <Icon icon="mdi:calendar-outline" class="text-base text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <span class="dark:text-gray-300">{{ formatDate(s.eta) }}</span>
                </div>
              </div>
              <div class="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <Button block variant="success" size="sm" @click="viewBarcode(s)" class="text-xs">Barcode</Button>
                <Button v-if="canEdit" block variant="primary" size="sm" @click="openEditModal(s)" class="text-xs">Edit</Button>
                <Button v-if="canDelete" block variant="default" size="sm" class="text-red-600 hover:text-red-700 bg-red-50 dark:bg-red-900/20 text-xs" @click="deleteShipment(s)">Hapus</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ShipmentFormModal
      v-if="showFormModal"
      :shipment="editingShipment"
      @close="closeFormModal"
      @saved="handleShipmentSaved"
    />

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
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
