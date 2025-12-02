<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'

interface Shipment {
  id: string
  tracking_code: string
  spb_number: string
  sender_name: string
  recipient_name: string
  recipient_address: string
  recipient_phone: string
  origin_city: string
  destination_city: string
  total_colli: number
  total_weight: number
  service_type: string
  description: string
  notes: string
  status: string
  created_at: string
  dbl_id: string | null
}

interface DBLItem {
  id: string
  dbl_number: string
  dbl_date: string
  vehicle_plate: string
  driver_name: string
  destination_city: string
  status: string
  shipment_count: number
  total_colli: number
  total_weight: number
}

const activeTab = ref('spb')
const shipments = ref<Shipment[]>([])
const dblList = ref<DBLItem[]>([])
const searchQuery = ref('')
const dblSearchQuery = ref('')
const loading = ref(false)
const dblLoading = ref(false)

const loadShipments = async (): Promise<void> => {
  loading.value = true
  try {
    const res = await fetch('/api/shipments')
    const data = await res.json()
    if (data.shipments) {
      shipments.value = data.shipments.filter((s: Shipment) => 
        ['IN_TRANSIT', 'DELIVERED'].includes(s.status)
      )
    }
  } catch {
    console.error('Failed to load shipments')
  } finally {
    loading.value = false
  }
}

const loadDBLList = async (): Promise<void> => {
  dblLoading.value = true
  try {
    const res = await fetch('/api/dbl')
    const data = await res.json()
    if (data.dbl_list) {
      dblList.value = data.dbl_list.filter((d: DBLItem) => 
        d.status === 'IN_TRANSIT' || d.shipment_count > 0
      )
    }
  } catch {
    console.error('Failed to load DBL list')
  } finally {
    dblLoading.value = false
  }
}

const filteredShipments = computed(() => {
  if (!searchQuery.value) return shipments.value
  const q = searchQuery.value.toLowerCase()
  return shipments.value.filter(s =>
    s.tracking_code?.toLowerCase().includes(q) ||
    s.spb_number?.toLowerCase().includes(q) ||
    s.sender_name?.toLowerCase().includes(q) ||
    s.recipient_name?.toLowerCase().includes(q) ||
    s.destination_city?.toLowerCase().includes(q)
  )
})

const filteredDBL = computed(() => {
  if (!dblSearchQuery.value) return dblList.value
  const q = dblSearchQuery.value.toLowerCase()
  return dblList.value.filter(d =>
    d.dbl_number?.toLowerCase().includes(q) ||
    d.vehicle_plate?.toLowerCase().includes(q) ||
    d.driver_name?.toLowerCase().includes(q) ||
    d.destination_city?.toLowerCase().includes(q)
  )
})

const getStatusVariant = (status: string): 'default' | 'success' | 'warning' | 'info' => {
  switch (status) {
    case 'DELIVERED': return 'success'
    case 'IN_TRANSIT': return 'info'
    default: return 'default'
  }
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

const printDeliveryNote = (shipment: Shipment): void => {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const content = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Surat Jalan - ${shipment.spb_number || shipment.tracking_code}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .header h1 { font-size: 18px; margin-bottom: 5px; }
        .header p { font-size: 10px; color: #666; }
        .title { text-align: center; font-size: 16px; font-weight: bold; margin: 15px 0; text-decoration: underline; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .info-section { border: 1px solid #ccc; padding: 10px; }
        .info-section h3 { font-size: 12px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 8px; }
        .info-row { display: flex; margin-bottom: 4px; }
        .info-label { width: 100px; font-weight: bold; }
        .info-value { flex: 1; }
        .goods-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        .goods-table th, .goods-table td { border: 1px solid #000; padding: 8px; text-align: left; }
        .goods-table th { background: #f0f0f0; }
        .signature-section { display: flex; justify-content: space-between; margin-top: 40px; }
        .signature-box { text-align: center; width: 150px; }
        .signature-line { border-top: 1px solid #000; margin-top: 60px; padding-top: 5px; }
        .status-badge { 
          display: inline-block; 
          padding: 4px 12px; 
          background: ${shipment.status === 'DELIVERED' ? '#22c55e' : '#3b82f6'}; 
          color: white; 
          font-weight: bold; 
          font-size: 10px;
          border-radius: 4px;
          transform: rotate(-15deg);
          position: absolute;
          top: 15px;
          right: 20px;
        }
        .header-wrapper { position: relative; }
        @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
      </style>
    </head>
    <body>
      <div class="header-wrapper">
        <div class="status-badge">${shipment.status}</div>
        <div class="header">
          <h1>PT. SINAR TERANG EXPRESS</h1>
          <p>Jasa Pengiriman Barang Antar Kota</p>
        </div>
      </div>
      <div class="title">SURAT JALAN</div>
      <div class="info-grid">
        <div class="info-section">
          <h3>PENGIRIM</h3>
          <div class="info-row"><span class="info-label">Nama</span><span class="info-value">: ${shipment.sender_name || '-'}</span></div>
          <div class="info-row"><span class="info-label">Kota Asal</span><span class="info-value">: ${shipment.origin_city || '-'}</span></div>
        </div>
        <div class="info-section">
          <h3>PENERIMA</h3>
          <div class="info-row"><span class="info-label">Nama</span><span class="info-value">: ${shipment.recipient_name || '-'}</span></div>
          <div class="info-row"><span class="info-label">Alamat</span><span class="info-value">: ${shipment.recipient_address || '-'}</span></div>
          <div class="info-row"><span class="info-label">Telepon</span><span class="info-value">: ${shipment.recipient_phone || '-'}</span></div>
          <div class="info-row"><span class="info-label">Kota Tujuan</span><span class="info-value">: ${shipment.destination_city || '-'}</span></div>
        </div>
      </div>
      <table class="goods-table">
        <thead>
          <tr>
            <th>No. SPB</th>
            <th>No. Resi</th>
            <th>Tanggal</th>
            <th>Layanan</th>
            <th>Colli</th>
            <th>Berat (Kg)</th>
            <th>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${shipment.spb_number || '-'}</td>
            <td>${shipment.tracking_code}</td>
            <td>${formatDate(shipment.created_at)}</td>
            <td>${shipment.service_type || 'REGULAR'}</td>
            <td>${shipment.total_colli || 0}</td>
            <td>${shipment.total_weight || 0}</td>
            <td>${shipment.description || '-'}</td>
          </tr>
        </tbody>
      </table>
      <p><strong>Catatan:</strong> ${shipment.notes || '-'}</p>
      <div class="signature-section">
        <div class="signature-box">
          <p>Pengirim</p>
          <div class="signature-line">(${shipment.sender_name || '..................'})</div>
        </div>
        <div class="signature-box">
          <p>Kurir</p>
          <div class="signature-line">(..................)</div>
        </div>
        <div class="signature-box">
          <p>Penerima</p>
          <div class="signature-line">(${shipment.recipient_name || '..................'})</div>
        </div>
      </div>
    </body>
    </html>
  `
  printWindow.document.write(content)
  printWindow.document.close()
  printWindow.print()
}

const printBulkSuratJalan = async (dbl: DBLItem): Promise<void> => {
  try {
    const res = await fetch(`/api/dbl?endpoint=get-shipments&dbl_id=${dbl.id}`)
    const data = await res.json()
    if (!data.shipments || data.shipments.length === 0) {
      alert('Tidak ada SPB dalam DBL ini')
      return
    }

    const dblShipments: Shipment[] = data.shipments
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    let pagesHtml = ''
    dblShipments.forEach((shipment, index) => {
      pagesHtml += `
        <div class="page ${index > 0 ? 'page-break' : ''}">
          <div class="header-wrapper">
            <div class="status-badge">${shipment.status}</div>
            <div class="header">
              <h1>PT. SINAR TERANG EXPRESS</h1>
              <p>Jasa Pengiriman Barang Antar Kota</p>
            </div>
          </div>
          <div class="title">SURAT JALAN</div>
          <div class="dbl-info">DBL: ${dbl.dbl_number} | Kendaraan: ${dbl.vehicle_plate} | Sopir: ${dbl.driver_name}</div>
          <div class="info-grid">
            <div class="info-section">
              <h3>PENGIRIM</h3>
              <div class="info-row"><span class="info-label">Nama</span><span class="info-value">: ${shipment.sender_name || '-'}</span></div>
              <div class="info-row"><span class="info-label">Kota Asal</span><span class="info-value">: ${shipment.origin_city || '-'}</span></div>
            </div>
            <div class="info-section">
              <h3>PENERIMA</h3>
              <div class="info-row"><span class="info-label">Nama</span><span class="info-value">: ${shipment.recipient_name || '-'}</span></div>
              <div class="info-row"><span class="info-label">Alamat</span><span class="info-value">: ${shipment.recipient_address || '-'}</span></div>
              <div class="info-row"><span class="info-label">Telepon</span><span class="info-value">: ${shipment.recipient_phone || '-'}</span></div>
              <div class="info-row"><span class="info-label">Kota Tujuan</span><span class="info-value">: ${shipment.destination_city || '-'}</span></div>
            </div>
          </div>
          <table class="goods-table">
            <thead>
              <tr>
                <th>No. SPB</th>
                <th>No. Resi</th>
                <th>Tanggal</th>
                <th>Layanan</th>
                <th>Colli</th>
                <th>Berat (Kg)</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${shipment.spb_number || '-'}</td>
                <td>${shipment.tracking_code}</td>
                <td>${formatDate(shipment.created_at)}</td>
                <td>${shipment.service_type || 'REGULAR'}</td>
                <td>${shipment.total_colli || 0}</td>
                <td>${shipment.total_weight || 0}</td>
                <td>${shipment.description || '-'}</td>
              </tr>
            </tbody>
          </table>
          <p><strong>Catatan:</strong> ${shipment.notes || '-'}</p>
          <div class="signature-section">
            <div class="signature-box">
              <p>Pengirim</p>
              <div class="signature-line">(${shipment.sender_name || '..................'})</div>
            </div>
            <div class="signature-box">
              <p>Kurir</p>
              <div class="signature-line">(..................)</div>
            </div>
            <div class="signature-box">
              <p>Penerima</p>
              <div class="signature-line">(${shipment.recipient_name || '..................'})</div>
            </div>
          </div>
        </div>
      `
    })

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bulk Surat Jalan - ${dbl.dbl_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 12px; }
          .page { padding: 20px; }
          .page-break { page-break-before: always; }
          .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .header h1 { font-size: 18px; margin-bottom: 5px; }
          .header p { font-size: 10px; color: #666; }
          .title { text-align: center; font-size: 16px; font-weight: bold; margin: 10px 0; text-decoration: underline; }
          .dbl-info { text-align: center; font-size: 11px; color: #444; margin-bottom: 15px; background: #f5f5f5; padding: 5px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
          .info-section { border: 1px solid #ccc; padding: 10px; }
          .info-section h3 { font-size: 11px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 8px; }
          .info-row { display: flex; margin-bottom: 3px; font-size: 11px; }
          .info-label { width: 80px; font-weight: bold; }
          .info-value { flex: 1; }
          .goods-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11px; }
          .goods-table th, .goods-table td { border: 1px solid #000; padding: 6px; text-align: left; }
          .goods-table th { background: #f0f0f0; }
          .signature-section { display: flex; justify-content: space-between; margin-top: 30px; }
          .signature-box { text-align: center; width: 120px; font-size: 10px; }
          .signature-line { border-top: 1px solid #000; margin-top: 50px; padding-top: 5px; }
          .status-badge { 
            display: inline-block; 
            padding: 3px 10px; 
            background: #22c55e; 
            color: white; 
            font-weight: bold; 
            font-size: 9px;
            border-radius: 3px;
            transform: rotate(-15deg);
            position: absolute;
            top: 10px;
            right: 15px;
          }
          .header-wrapper { position: relative; }
          @media print { 
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } 
            .page-break { page-break-before: always; }
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
      </html>
    `
    printWindow.document.write(content)
    printWindow.document.close()
    printWindow.print()
  } catch {
    console.error('Failed to print bulk surat jalan')
  }
}

onMounted(() => {
  loadShipments()
  loadDBLList()
})
</script>

<template>
  <div class="p-4 md:p-6">
    <div class="flex items-center gap-2 mb-6">
      <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      <h1 class="text-2xl font-bold">Surat Jalan</h1>
    </div>

    <div class="grid grid-cols-2 gap-2 mb-4">
      <button
        class="px-4 py-2 rounded-lg font-medium transition-colors"
        :class="activeTab === 'spb' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'"
        @click="activeTab = 'spb'"
      >
        📄 SPB Individual
      </button>
      <button
        class="px-4 py-2 rounded-lg font-medium transition-colors"
        :class="activeTab === 'dbl' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'"
        @click="activeTab = 'dbl'"
      >
        🚚 Per DBL (Bulk)
      </button>
    </div>

    <div v-if="activeTab === 'spb'">
      <div class="mb-4">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari SPB, Resi, Pengirim, Penerima, Tujuan..."
          class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-800 dark:border-gray-600"
        />
      </div>

        <div v-if="loading" class="text-center py-8 text-gray-500 dark:text-gray-400">
          Memuat data...
        </div>

        <div v-else-if="filteredShipments.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
          Tidak ada surat jalan yang tersedia
        </div>

        <div v-else class="hidden md:block">
          <div class="border rounded-lg overflow-hidden dark:border-gray-700">
            <table class="w-full">
              <thead class="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th class="px-4 py-3 text-left text-sm font-medium">No. SPB</th>
                  <th class="px-4 py-3 text-left text-sm font-medium">No. Resi</th>
                  <th class="px-4 py-3 text-left text-sm font-medium">Pengirim</th>
                  <th class="px-4 py-3 text-left text-sm font-medium">Penerima</th>
                  <th class="px-4 py-3 text-left text-sm font-medium">Tujuan</th>
                  <th class="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th class="px-4 py-3 text-center text-sm font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y dark:divide-gray-700">
                <tr v-for="shipment in filteredShipments" :key="shipment.id" class="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td class="px-4 py-3 text-sm font-mono">{{ shipment.spb_number || '-' }}</td>
                  <td class="px-4 py-3 text-sm font-mono">{{ shipment.tracking_code }}</td>
                  <td class="px-4 py-3 text-sm">{{ shipment.sender_name || '-' }}</td>
                  <td class="px-4 py-3 text-sm">{{ shipment.recipient_name || '-' }}</td>
                  <td class="px-4 py-3 text-sm">{{ shipment.destination_city || '-' }}</td>
                  <td class="px-4 py-3">
                    <Badge :variant="getStatusVariant(shipment.status)">
                      {{ shipment.status }}
                    </Badge>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <Button variant="secondary" @click="printDeliveryNote(shipment)">
                      🖨️ Print
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="md:hidden space-y-3">
          <div
            v-for="shipment in filteredShipments"
            :key="shipment.id"
            class="border rounded-lg p-4 space-y-2"
          >
            <div class="flex justify-between items-start">
              <div>
                <p class="font-mono text-sm font-medium">{{ shipment.spb_number || shipment.tracking_code }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ shipment.tracking_code }}</p>
              </div>
              <Badge :variant="getStatusVariant(shipment.status)">
                {{ shipment.status }}
              </Badge>
            </div>
            <div class="text-sm">
              <p><span class="text-gray-500 dark:text-gray-400">Dari:</span> {{ shipment.sender_name || '-' }}</p>
              <p><span class="text-gray-500 dark:text-gray-400">Ke:</span> {{ shipment.recipient_name || '-' }} - {{ shipment.destination_city || '-' }}</p>
            </div>
            <Button variant="secondary" block @click="printDeliveryNote(shipment)">
              🖨️ Print Surat Jalan
            </Button>
          </div>
        </div>
    </div>

    <div v-if="activeTab === 'dbl'">
      <div class="mb-4">
        <input
          v-model="dblSearchQuery"
          type="text"
          placeholder="Cari No. DBL, Plat Kendaraan, Sopir, Tujuan..."
            class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-800 dark:border-gray-600"
          />
        </div>

        <div v-if="dblLoading" class="text-center py-8 text-gray-500 dark:text-gray-400">
          Memuat data DBL...
        </div>

        <div v-else-if="filteredDBL.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
          Tidak ada DBL yang tersedia untuk dicetak
        </div>

        <div v-else class="hidden md:block">
          <div class="border rounded-lg overflow-hidden dark:border-gray-700">
            <table class="w-full">
              <thead class="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th class="px-4 py-3 text-left text-sm font-medium">No. DBL</th>
                  <th class="px-4 py-3 text-left text-sm font-medium">Tanggal</th>
                  <th class="px-4 py-3 text-left text-sm font-medium">Kendaraan</th>
                  <th class="px-4 py-3 text-left text-sm font-medium">Sopir</th>
                  <th class="px-4 py-3 text-left text-sm font-medium">Tujuan</th>
                  <th class="px-4 py-3 text-center text-sm font-medium">Jumlah SPB</th>
                  <th class="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th class="px-4 py-3 text-center text-sm font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y dark:divide-gray-700">
                <tr v-for="dbl in filteredDBL" :key="dbl.id" class="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td class="px-4 py-3 text-sm font-mono font-medium">{{ dbl.dbl_number }}</td>
                  <td class="px-4 py-3 text-sm">{{ formatDate(dbl.dbl_date) }}</td>
                  <td class="px-4 py-3 text-sm font-mono">{{ dbl.vehicle_plate || '-' }}</td>
                  <td class="px-4 py-3 text-sm">{{ dbl.driver_name || '-' }}</td>
                  <td class="px-4 py-3 text-sm">{{ dbl.destination_city || '-' }}</td>
                  <td class="px-4 py-3 text-center">
                    <Badge variant="info">{{ dbl.shipment_count }} SPB</Badge>
                  </td>
                  <td class="px-4 py-3">
                    <Badge :variant="dbl.status === 'IN_TRANSIT' ? 'info' : 'default'">
                      {{ dbl.status }}
                    </Badge>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <Button 
                      variant="primary" 
                      :disabled="dbl.shipment_count === 0"
                      @click="printBulkSuratJalan(dbl)"
                    >
                      🖨️ Print {{ dbl.shipment_count }} SPB
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="md:hidden space-y-3">
          <div
            v-for="dbl in filteredDBL"
            :key="dbl.id"
            class="border rounded-lg p-4 space-y-3"
          >
            <div class="flex justify-between items-start">
              <div>
                <p class="font-mono text-sm font-medium">{{ dbl.dbl_number }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ formatDate(dbl.dbl_date) }}</p>
              </div>
              <Badge :variant="dbl.status === 'IN_TRANSIT' ? 'info' : 'default'">
                {{ dbl.status }}
              </Badge>
            </div>
            <div class="text-sm space-y-1">
              <p><span class="text-gray-500 dark:text-gray-400">Kendaraan:</span> {{ dbl.vehicle_plate || '-' }}</p>
              <p><span class="text-gray-500 dark:text-gray-400">Sopir:</span> {{ dbl.driver_name || '-' }}</p>
              <p><span class="text-gray-500 dark:text-gray-400">Tujuan:</span> {{ dbl.destination_city || '-' }}</p>
            </div>
            <div class="flex items-center justify-between">
              <Badge variant="info">{{ dbl.shipment_count }} SPB</Badge>
              <Button 
                variant="primary" 
                :disabled="dbl.shipment_count === 0"
                @click="printBulkSuratJalan(dbl)"
              >
                🖨️ Print Semua
              </Button>
            </div>
          </div>
        </div>
    </div>
  </div>
</template>
