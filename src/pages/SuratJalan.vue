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
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Surat Jalan - ${shipment.public_code}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #000;
          padding-bottom: 20px;
        }
        .brand { display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:10px; }
        .brand img { height: 48px; width: 48px; object-fit: contain; }
        .brand-name { font-weight: 700; color: #1d4ed8; letter-spacing: .5px; }
        .header h1 {
          margin: 0;
          font-size: 24px;
        }
        .header p {
          margin: 5px 0;
          color: #666;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
        }
        .info-item {
          margin-bottom: 10px;
        }
        .info-label {
          font-weight: bold;
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
        }
        .info-value {
          font-size: 14px;
          margin-top: 2px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 10px;
          text-align: left;
        }
        th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        .signatures {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 20px;
          margin-top: 60px;
        }
        .signature-box {
          text-align: center;
        }
        .signature-line {
          border-top: 1px solid #000;
          margin-top: 80px;
          padding-top: 10px;
        }
        @media print {
          body {
            padding: 20px;
          }
        }
        /* Barcode container and sizing for precise printing */
        .barcode-right { text-align: right; }
        .barcode-right img { width: 320px; max-width: 100%; height: 72px; object-fit: contain; border: 1px solid #e5e7eb; padding: 6px; border-radius: 6px; background: #fff; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand"><img src="${LOGO_URL}" alt="Logo" /><div class="brand-name">SUMBER TRANS EXPRESS</div></div>
        <h1>SURAT JALAN</h1>
        <p>${company.name}</p>
        <p>${company.address}</p>
      </div>

      <div class="barcode-right" style="margin:12px 0 24px;">
        <div style="font-size:12px;color:#374151;margin-bottom:4px;">Barcode</div>
        <!-- Use Code 128 barcode for surat jalan (precision for labels) -->
        <img src="/api/blob?endpoint=generate&code=${shipment.public_code || ''}&type=barcode" alt="Barcode (Code 128)" />
      </div>

      <div class="info-grid">
        <div>
          <div class="info-item">
            <div class="info-label">No. Surat Jalan</div>
            <div class="info-value">${shipment.public_code}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Tanggal</div>
            <div class="info-value">${formatDateLong(shipment.created_at)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Customer</div>
            <div class="info-value">${shipment.customer_name || '-'}</div>
          </div>
        </div>
        <div>
          <div class="info-item">
            <div class="info-label">Origin</div>
            <div class="info-value">${shipment.origin}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Destination</div>
            <div class="info-value">${shipment.destination}</div>
          </div>
          <div class="info-item">
            <div class="info-label">ETA</div>
            <div class="info-value">${shipment.eta ? formatDateLong(shipment.eta) : '-'}</div>
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>No</th>
            <th>Deskripsi</th>
            <th style="text-align: center;">Jumlah Colli</th>
            <th>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>Barang Kiriman</td>
            <td style="text-align: center;">${shipment.total_colli}</td>
            <td>${shipment.status}</td>
          </tr>
        </tbody>
      </table>

      <div class="signatures">
        <div class="signature-box">
          <div>Pengirim</div>
          <div class="signature-line">
            (&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)
          </div>
        </div>
        <div class="signature-box">
          <div>Driver</div>
          <div class="signature-line">
            (&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)
          </div>
        </div>
        <div class="signature-box">
          <div>Penerima</div>
          <div class="signature-line">
            (&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)
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
  <div class="space-y-4 pb-20 lg:pb-0">
    <div class="text-xl font-semibold">
      Surat Jalan
    </div>
    <div class="flex gap-3">
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
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3 transition-all duration-200 hover:shadow-md"
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
            variant="primary"
            class="w-full text-sm"
            @click="printDeliveryNote(ship)"
          >
            Print Surat Jalan
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
