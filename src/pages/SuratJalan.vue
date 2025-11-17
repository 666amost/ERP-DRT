<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import Button from '../components/ui/Button.vue';
import Badge from '../components/ui/Badge.vue';
import { useFormatters } from '../composables/useFormatters';
import { getCompany } from '../lib/company';
const LOGO_URL = '/brand/logo.png';

const { formatDate, formatDateLong } = useFormatters();

type Shipment = {
  id: number;
  customer_id: number | null;
  customer_name: string | null;
  sender_name: string | null;
  sender_address: string | null;
  origin: string;
  destination: string;
  eta: string | null;
  status: string;
  total_colli: number;
  public_code: string | null;
  created_at: string;
};

const shipments = ref<Shipment[]>([]);
const filteredShipments = ref<Shipment[]>([]);
const searchQuery = ref('');
const loading = ref(true);
const route = useRoute();

async function loadShipments() {
  loading.value = true;
  try {
    const res = await fetch('/api/shipments?endpoint=list');
    const data = await res.json();
    shipments.value = data.items || [];
    // initialize filtered results
    filterShipments();
  } catch (e) {
    console.error('Failed to load shipments:', e);
  } finally {
    loading.value = false;
  }
}

function filterShipments() {
  if (!searchQuery.value.trim()) {
    filteredShipments.value = shipments.value;
  } else {
    const q = searchQuery.value.toLowerCase();
    filteredShipments.value = shipments.value.filter(s =>
      String(s.public_code || '').toLowerCase().includes(q) ||
      s.origin.toLowerCase().includes(q) ||
      s.destination.toLowerCase().includes(q) ||
      String(s.customer_name || '').toLowerCase().includes(q)
    );
  }
}

async function printDeliveryNote(shipment: Shipment) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Popup blocked. Please allow popups for this site.');
    return;
  }

  const company = await getCompany();
  // Try to fetch item (colli) details for this shipment if available
  let collis: Array<{ id: number; shipment_id: number; code?: string; description?: string; quantity?: number; kg_m3?: number; unit_price?: number; amount?: number }> = [];
  try {
    const resColli = await fetch(`/api/colli?endpoint=list&shipment_id=${shipment.id}`);
    if (resColli.ok) {
      const data = await resColli.json();
      // Expecting { items: [] }
      collis = data.items || [];
    }
  } catch (err) {
    console.warn('Failed to fetch collis for shipment', err);
  }
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Surat Jalan - ${shipment.public_code ?? ''}</title>
      <meta charset="utf-8" />
      <style>
        :root { --ink:#0e0e0e; --line:#1f2937; --muted:#6b7280; --paper:#fffbe6; }
        * { box-sizing: border-box; }
        html, body { height: 100%; }
        body { font-family: Arial, Helvetica, sans-serif; color: var(--ink); margin:0; padding:24px; }
        .sheet { width: 210mm; max-width: 210mm; margin:0 auto; background: var(--paper); border: 1px solid var(--line); padding: 18px 18px 14px; }
        .top { display:flex; align-items:flex-start; gap:16px; }
        .brand { display:flex; gap:10px; align-items:center; }
        .brand img { width:48px; height:48px; object-fit:contain; }
        .brand-title { font-weight:800; letter-spacing:.4px; }
        .brand-sub { font-size:12px; color:#1f2937; margin-top:2px; }
        .addr { font-size:11px; color: var(--muted); margin-top:6px; white-space:pre-line; }
        .right-box { margin-left:auto; border:1px solid var(--line); padding:8px 10px; text-align:center; min-width:230px; }
        .right-box .title { font-weight:800; font-size:13px; letter-spacing:.5px; }
        .right-box .code { margin-top:6px; font-size:12px; }

        .barcode { text-align:right; margin:8px 0 10px; }
        .barcode img { width:300px; height:72px; object-fit:contain; border:1px solid #e5e7eb; padding:6px; border-radius:4px; background:#fff; }

        .row { display:grid; grid-template-columns: 1fr 1fr; gap:14px; margin-top:10px; }
        .field { border:1px solid var(--line); padding:8px; min-height:44px; }
        .label { font-size:11px; color:var(--muted); margin-bottom:4px; text-transform:uppercase; }
        .value { font-size:13px; }

        table { width:100%; border-collapse:collapse; margin-top:12px; }
        th, td { border:1px solid #000; font-size:12px; padding:6px 8px; }
        thead th { background:#f7f7f7; }

        .bottom { display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-top:12px; align-items:start; }
        .tnc { border:1px solid var(--line); padding:10px; font-size:10px; line-height:1.35; color:#111827; }
        .tnc h4 { margin:0 0 6px; font-size:11px; }
        .badge-note { display:inline-block; border:1px solid var(--line); padding:6px 10px; font-weight:700; margin-top:8px; border-radius:4px; }

        .sign-row { display:grid; grid-template-columns: repeat(3,1fr); gap:18px; margin-top:22px; }
        .sign { text-align:center; font-size:12px; }
        .line { border-top:1px solid #000; margin-top:60px; padding-top:4px; }

        .right-summary { text-align:right; font-size:12px; }
        .right-summary .date { margin-top:8px; }

        @media print {
          body { padding:0; }
          .sheet { border:0; width:auto; max-width:none; padding:16mm; }
        }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="top">
          <div>
            <div class="brand">
              <img src="${LOGO_URL}" alt="Logo" />
              <div>
                <div class="brand-title">${company?.name ?? 'PERUSAHAAN LOGISTIK'}</div>
                <div class="brand-sub">Melayani: Pengiriman ke Seluruh Indonesia</div>
              </div>
            </div>
            <div class="addr">${company?.address ?? ''}</div>
          </div>
          <div class="right-box">
            <div class="title">SURAT PENGANTAR BARANG</div>
            <div class="code">No.S ${shipment.public_code ?? ''}</div>
          </div>
        </div>

        <div class="barcode">
          <img src="/api/blob?endpoint=generate&code=${shipment.public_code ?? ''}&type=barcode" alt="Barcode" />
        </div>

        <div class="row">
          <div class="field">
            <div class="label">Pengirim</div>
            <div class="value">${shipment.sender_name ?? '-'}</div>
          </div>
          <div class="field">
            <div class="label">Kepada Yth</div>
            <div class="value">${shipment.customer_name ?? '-'}</div>
          </div>
        </div>
        <div class="row" style="margin-top:8px;">
          <div class="field">
            <div class="label">Dari</div>
            <div class="value">${shipment.origin}</div>
          </div>
          <div class="field">
            <div class="label">Tanggal</div>
            <div class="value">${formatDateLong(shipment.created_at)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:12%">Banyaknya</th>
              <th>Nama barang menurut keterangan pengirim</th>
              <th style="width:14%">Berat Barang</th>
              <th style="width:16%">Ongkos Kirim</th>
            </tr>
          </thead>
          <tbody>
${(collis.length ? collis.map((c) => `            <tr>
              <td>${c.quantity ?? 1}</td>
              <td>${(c.description ?? 'Barang kiriman').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td>
              <td>${c.kg_m3 ?? ''}</td>
              <td>${c.amount !== undefined ? Number(c.amount).toFixed(2) : ''}</td>
            </tr>`).join('\n') : `            <tr>
              <td>${shipment.total_colli}</td>
              <td>Barang kiriman</td>
              <td></td>
              <td></td>
            </tr>`)}
          </tbody>
        </table>

        <div class="bottom">
          <div>
            <div class="tnc">
              <h4>Persyaratan Pengiriman</h4>
              <div>
                1) Pengirim menjamin isi barang sesuai dengan keterangan.\n
                2) Kerusakan/kehilangan akibat force majeure tidak menjadi tanggung jawab pengangkut.\n
                3) Barang mudah pecah/cepat rusak harus diberi pengaman memadai.\n
                4) Klaim disertai bukti sah dan diajukan selambat-lambatnya 3x24 jam setelah diterima.\n
                5) Perhitungan berat berdasarkan Kg/M3 yang lebih besar.
              </div>
              <div class="badge-note">Isi dalam tidak diperiksa</div>
            </div>
          </div>
          <div class="right-summary">
            <div><strong>Jumlah</strong></div>
            <div class="date">Jakarta, ${formatDate(shipment.created_at)}</div>
          </div>
        </div>

        <div class="sign-row">
          <div class="sign">
            <div>Pengirim</div>
            <div class="line">(..............................)</div>
          </div>
          <div class="sign">
            <div>Yang Menerima</div>
            <div class="line">(..............................)</div>
          </div>
          <div class="sign">
            <div>Hormat kami</div>
            <div class="line">(..............................)</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

onMounted(() => {
  if (route.query.q) searchQuery.value = String(route.query.q || '');
  loadShipments();
});

watch([shipments, searchQuery], () => {
  filterShipments();
});
watch(() => route.query.q, (val) => {
  const v = val ? String(val) : '';
  if (v !== searchQuery.value) searchQuery.value = v;
});
</script>

<template>
  <div class="space-y-4 pb-20 lg:pb-0 overflow-x-hidden">
    <div class="text-xl font-semibold">
      Surat Jalan
    </div>
    <div class="flex gap-3 min-w-0">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Cari kode surat jalan, customer, rute..."
        class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 dark:border-gray-600"
      >
    </div>

    <div
      v-if="loading"
      class="flex items-center justify-center h-64"
    >
      <div class="text-gray-500">
        Loading...
      </div>
    </div>

    <!-- Desktop Table View -->
    <div
      v-else
      class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden card hidden lg:block"
    >
      <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
              Kode
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
              Customer
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
              Rute
            </th>
            <th class="px-4 py-3 text-center text-xs font-medium text-gray-600 dark:text-gray-300">
              Colli
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
              Status
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
              Tanggal
            </th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-if="filteredShipments.length === 0">
            <td
              colspan="7"
              class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
            >
              Belum ada surat jalan
            </td>
          </tr>
          <tr
            v-for="ship in filteredShipments"
            :key="ship.id"
            class="hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <td class="px-4 py-3 text-sm font-medium dark:text-gray-100">
              {{ ship.public_code }}
            </td>
            <td class="px-4 py-3 text-sm dark:text-gray-100">
              {{ ship.customer_name || '-' }}
            </td>
            <td class="px-4 py-3 text-sm dark:text-gray-100">
              {{ ship.origin }} → {{ ship.destination }}
            </td>
            <td class="px-4 py-3 text-sm text-center dark:text-gray-100">
              {{ ship.total_colli }}
            </td>
            <td class="px-4 py-3">
              <Badge variant="info">
                {{ ship.status }}
              </Badge>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
              {{ formatDate(ship.created_at) }}
            </td>
            <td class="px-4 py-3 text-right">
              <Button
                variant="primary"
                @click="printDeliveryNote(ship)"
              >
                Print
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
        v-if="filteredShipments.length === 0"
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center"
      >
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Belum ada surat jalan
        </p>
      </div>
      <div
        v-for="ship in filteredShipments"
        :key="ship.id"
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3 transition-all duration-200 hover:shadow-md min-w-0"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm truncate">
              {{ ship.public_code }}
            </div>
            <div class="text-xs text-gray-600 dark:text-gray-400 truncate">
              {{ ship.customer_name || '-' }}
            </div>
          </div>
          <Badge variant="info" class="flex-shrink-0">
            {{ ship.status }}
          </Badge>
        </div>
        <div class="text-sm space-y-1">
          <div class="flex items-start gap-2">
            <span class="text-gray-500 dark:text-gray-400 text-xs flex-shrink-0">Rute:</span>
            <span class="dark:text-gray-100 text-xs break-words">{{ ship.origin }} → {{ ship.destination }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-gray-500 dark:text-gray-400 text-xs">Colli:</span>
            <span class="dark:text-gray-100 text-xs">{{ ship.total_colli }}</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="text-gray-500 dark:text-gray-400 text-xs flex-shrink-0">Tanggal:</span>
            <span class="dark:text-gray-100 text-xs">{{ formatDate(ship.created_at) }}</span>
          </div>
        </div>
        <div class="pt-2 border-t border-gray-100 dark:border-gray-700">
          <Button
            block
            variant="primary"
            class="text-sm"
            @click="printDeliveryNote(ship)"
          >
            Print Surat Jalan
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
