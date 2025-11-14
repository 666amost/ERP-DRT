<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Button from '../components/ui/Button.vue';
import Badge from '../components/ui/Badge.vue';
import { useFormatters } from '../composables/useFormatters';

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
const loading = ref(true);

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

function printDeliveryNote(shipment: Shipment) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Popup blocked. Please allow popups for this site.');
    return;
  }

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
      </style>
    </head>
    <body>
      <div class="header">
        <h1>SURAT JALAN</h1>
        <p>Ekspedisi Darat Erwin</p>
        <p>Jl. Contoh No. 123, Jakarta</p>
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
  loadShipments();
});
</script>

<template>
  <div class="space-y-4 pb-20 lg:pb-0">
    <div class="text-xl font-semibold">Surat Jalan</div>

    <div v-if="loading" class="flex items-center justify-center h-64">
      <div class="text-gray-500">Loading...</div>
    </div>

    <div v-else class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden card">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Kode</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Customer</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Rute</th>
            <th class="px-4 py-3 text-center text-xs font-medium text-gray-600 dark:text-gray-300">Colli</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Tanggal</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-if="shipments.length === 0">
            <td colspan="7" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Belum ada surat jalan
            </td>
          </tr>
          <tr v-for="ship in shipments" :key="ship.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
            <td class="px-4 py-3 text-sm font-medium dark:text-gray-100">{{ ship.public_code }}</td>
            <td class="px-4 py-3 text-sm dark:text-gray-100">{{ ship.customer_name || '-' }}</td>
            <td class="px-4 py-3 text-sm dark:text-gray-100">{{ ship.origin }} → {{ ship.destination }}</td>
            <td class="px-4 py-3 text-sm text-center dark:text-gray-100">{{ ship.total_colli }}</td>
            <td class="px-4 py-3">
              <Badge variant="info">{{ ship.status }}</Badge>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ formatDate(ship.created_at) }}</td>
            <td class="px-4 py-3 text-right">
              <Button variant="primary" @click="printDeliveryNote(ship)">
                Print
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
