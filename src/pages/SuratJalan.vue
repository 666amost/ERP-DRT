<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import { getCompany } from '../lib/company'
import { useFormatters } from '../composables/useFormatters'

const LOGO_URL = '/brand/logo.png'
const { formatRupiah } = useFormatters()

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
  nominal: number
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
    const res = await fetch('/api/shipments?endpoint=list&limit=100')
    const data = await res.json()
    if (data.items) {
      shipments.value = data.items
        .filter((s: Shipment) => ['IN_TRANSIT', 'DELIVERED'].includes(s.status))
        .map((s: Record<string, unknown>) => ({
          id: String(s.id),
          tracking_code: s.public_code as string || '',
          spb_number: s.spb_number as string || '',
          sender_name: s.sender_name as string || s.customer_name as string || '',
          recipient_name: s.penerima_name as string || '',
          recipient_address: s.shipping_address as string || '',
          recipient_phone: s.penerima_phone as string || '',
          origin_city: s.origin as string || '',
          destination_city: s.destination as string || '',
          total_colli: Number(s.total_colli) || 0,
          total_weight: Number(s.berat) || 0,
          service_type: s.service_type as string || 'CARGO',
          description: s.macam_barang as string || '',
          notes: s.keterangan as string || '',
          status: s.status as string || '',
          created_at: s.created_at as string || '',
          dbl_id: s.dbl_id as string | null,
          nominal: Number(s.nominal) || 0
        }))
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
    const res = await fetch('/api/dbl?endpoint=list&limit=100')
    const data = await res.json()
    if (data.items) {
      dblList.value = data.items
        .filter((d: DBLItem) => d.status === 'IN_TRANSIT' || d.status === 'READY' || (d.shipment_count && d.shipment_count > 0))
        .map((d: Record<string, unknown>) => ({
          id: String(d.id),
          dbl_number: d.dbl_number as string || '',
          dbl_date: d.dbl_date as string || '',
          vehicle_plate: d.vehicle_plate as string || '',
          driver_name: d.driver_name as string || '',
          destination_city: d.destination as string || '',
          status: d.status as string || '',
          shipment_count: Number(d.shipment_count) || 0,
          total_colli: 0,
          total_weight: 0
        }))
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

const formatDateLong = (dateStr: string): string => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}

const printDeliveryNote = async (shipment: Shipment): Promise<void> => {
  const company = await getCompany()
  const publicCode = shipment.tracking_code || ''
  
  await new Promise<void>((resolve) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = `/api/blob?endpoint=generate&code=${publicCode}&type=barcode`
  })

  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Popup blocked. Please allow popups for this site.')
    return
  }
  
  const deliveredStamp = shipment.status === 'DELIVERED' ? `
    <div class="delivered-stamp">DELIVERED</div>
  ` : ''

  const spbNumber = shipment.spb_number || '-'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Surat Jalan - ${spbNumber}</title>
      <meta charset="utf-8" />
      <style>
        @page { size: 9.5in 11in portrait; margin: 0; }
        :root { --ink:#000; --line:#000; --muted:#000; --paper:#fff; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; font-family: 'Courier New', Courier, monospace; font-size: 12px; color: var(--ink); }
        body { margin: 0; padding: 0; }
        .sheet { width: 9.5in; height: 11in; max-width: 9.5in; background: var(--paper); padding: 18px 24px; position: relative; }
        .top { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 12px; }
        .brand { display: flex; gap: 10px; align-items: center; }
        .brand img { width: 48px; height: 48px; object-fit: contain; }
        .brand-title { font-weight: 800; font-size: 14px; letter-spacing: .4px; }
        .brand-sub { font-size: 11px; color: #000; margin-top: 2px; }
        .addr { font-size: 10px; color: #000; margin-top: 6px; white-space: pre-line; line-height: 1.4; }
        .right-box { margin-left: auto; border: 2px solid #000; padding: 8px 12px; text-align: center; min-width: 240px; }
        .right-box .title { font-weight: 800; font-size: 13px; letter-spacing: .5px; }
        .right-box .spb { margin-top: 6px; font-size: 12px; font-weight: 700; }
        .right-box .code { margin-top: 4px; font-size: 11px; }

        .barcode { text-align: right; margin: 10px 0 14px; }
        .barcode img { width: 320px; height: 80px; object-fit: contain; border: 2px solid #000; padding: 6px; background: #fff; }

        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 10px; }
        .field { border: 2px solid #000; padding: 8px 10px; min-height: 50px; }
        .label { font-size: 10px; font-weight: 700; color: #000; margin-bottom: 4px; text-transform: uppercase; }
        .value { font-size: 12px; font-weight: 600; }

        table { width: 100%; border-collapse: collapse; margin-top: 14px; }
        th, td { border: 2px solid #000; font-size: 11px; padding: 8px 10px; }
        thead th { background: #fff; font-weight: 700; }

        .bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 14px; align-items: start; }
        .tnc { border: 2px solid #000; padding: 10px; font-size: 9px; line-height: 1.5; color: #000; }
        .tnc h4 { margin: 0 0 6px; font-size: 10px; font-weight: 700; }
        .badge-note { display: inline-block; border: 2px solid #000; padding: 6px 10px; font-weight: 700; margin-top: 8px; font-size: 9px; }

        .sign-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 24px; }
        .sign { text-align: center; font-size: 11px; font-weight: 600; }
        .line { border-top: 2px solid #000; margin-top: 60px; padding-top: 4px; }

        .right-summary { text-align: right; font-size: 11px; font-weight: 600; }
        .right-summary .date { margin-top: 8px; }

        .delivered-stamp {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-15deg);
          font-size: 48px;
          font-weight: 900;
          color: rgba(0, 0, 0, 0.15);
          border: 6px solid rgba(0, 0, 0, 0.15);
          padding: 12px 28px;
          text-transform: uppercase;
          letter-spacing: 4px;
          pointer-events: none;
        }

        @media print {
          html, body { width: 9.5in; height: 11in; }
          body { padding: 0; }
          .sheet { border: 0; width: 9.5in; height: 11in; max-width: none; padding: 18mm 20mm; page-break-after: always; }
          .delivered-stamp { color: rgba(0, 0, 0, 0.2); border-color: rgba(0, 0, 0, 0.2); }
        }
      </style>
    </head>
    <body>
      <div class="sheet">
        ${deliveredStamp}
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
            <div class="spb">No. SPB: ${spbNumber}</div>
            <div class="code">Kode: ${publicCode}</div>
          </div>
        </div>

        <div class="barcode">
          <img src="/api/blob?endpoint=generate&code=${publicCode}&type=barcode" alt="Barcode" />
        </div>

        <div class="row">
          <div class="field">
            <div class="label">Pengirim</div>
            <div class="value">${shipment.sender_name || '-'}</div>
          </div>
          <div class="field">
            <div class="label">Kepada Yth</div>
            <div class="value">${shipment.recipient_name || '-'}</div>
          </div>
        </div>
        <div class="row" style="margin-top:10px;">
          <div class="field">
            <div class="label">Dari</div>
            <div class="value">${shipment.origin_city}</div>
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
              <th style="width:18%">Ongkos Kirim</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${shipment.total_colli}</td>
              <td>${shipment.description || 'Barang kiriman'}</td>
              <td>${shipment.total_weight || ''}</td>
              <td>${formatRupiah(shipment.nominal)}</td>
            </tr>
          </tbody>
        </table>

        <div class="bottom">
          <div>
            <div class="tnc">
              <h4>Persyaratan Pengiriman</h4>
              <div>
                1) Pengirim menjamin isi barang sesuai dengan keterangan.<br/>
                2) Kerusakan/kehilangan akibat force majeure tidak menjadi tanggung jawab pengangkut.<br/>
                3) Barang mudah pecah/cepat rusak harus diberi pengaman memadai.<br/>
                4) Klaim disertai bukti sah dan diajukan selambat-lambatnya 3x24 jam setelah diterima.<br/>
                5) Perhitungan berat berdasarkan Kg/M3 yang lebih besar.
              </div>
              <div class="badge-note">Isi dalam tidak diperiksa</div>
            </div>
          </div>
          <div class="right-summary">
            <div><strong>Jumlah</strong></div>
            <div class="date">${shipment.destination_city}, ${formatDate(shipment.created_at)}</div>
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
  `
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
  }, 250)
}

const printBulkSuratJalan = async (dbl: DBLItem): Promise<void> => {
  try {
    const res = await fetch(`/api/dbl?endpoint=items&id=${dbl.id}`)
    const data = await res.json()
    if (!data.items || data.items.length === 0) {
      alert('Tidak ada SPB dalam DBL ini')
      return
    }

    const company = await getCompany()
    
    const barcodePromises = data.items.map((s: Record<string, unknown>) => {
      const publicCode = s.public_code as string || ''
      return new Promise<void>((resolve) => {
        const img = new Image()
        img.onload = () => resolve()
        img.onerror = () => resolve()
        img.src = `/api/blob?endpoint=generate&code=${publicCode}&type=barcode`
      })
    })
    await Promise.all(barcodePromises)

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Popup blocked. Please allow popups for this site.')
      return
    }

    let pagesHtml = ''
    data.items.forEach((s: Record<string, unknown>, index: number) => {
      const spbNumber = s.spb_number as string || '-'
      const publicCode = s.public_code as string || ''
      const shipment = {
        spb_number: spbNumber,
        tracking_code: publicCode,
        sender_name: s.pengirim_name as string || s.customer_name as string || '',
        recipient_name: s.penerima_name as string || '',
        origin_city: s.origin as string || '',
        destination_city: s.destination as string || '',
        total_colli: Number(s.total_colli) || 0,
        total_weight: Number(s.berat) || 0,
        description: s.macam_barang as string || '',
        status: s.status as string || '',
        created_at: s.created_at as string || '',
        nominal: Number(s.nominal) || 0
      }
      const deliveredStamp = shipment.status === 'DELIVERED' ? `<div class="delivered-stamp">DELIVERED</div>` : ''
      
      pagesHtml += `
        <div class="sheet ${index > 0 ? 'page-break' : ''}">
          ${deliveredStamp}
          <div class="dbl-banner">DBL: ${dbl.dbl_number} | Kendaraan: ${dbl.vehicle_plate} | Sopir: ${dbl.driver_name}</div>
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
              <div class="spb">No. SPB: ${spbNumber}</div>
              <div class="code">Kode: ${publicCode}</div>
            </div>
          </div>

          <div class="barcode">
            <img src="/api/blob?endpoint=generate&code=${publicCode}&type=barcode" alt="Barcode" />
          </div>

          <div class="row">
            <div class="field">
              <div class="label">Pengirim</div>
              <div class="value">${shipment.sender_name || '-'}</div>
            </div>
            <div class="field">
              <div class="label">Kepada Yth</div>
              <div class="value">${shipment.recipient_name || '-'}</div>
            </div>
          </div>
          <div class="row" style="margin-top:10px;">
            <div class="field">
              <div class="label">Dari</div>
              <div class="value">${shipment.origin_city}</div>
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
                <th style="width:18%">Ongkos Kirim</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${shipment.total_colli}</td>
                <td>${shipment.description || 'Barang kiriman'}</td>
                <td>${shipment.total_weight || ''}</td>
                <td>${formatRupiah(shipment.nominal)}</td>
              </tr>
            </tbody>
          </table>

          <div class="bottom">
            <div>
              <div class="tnc">
                <h4>Persyaratan Pengiriman</h4>
                <div>
                  1) Pengirim menjamin isi barang sesuai dengan keterangan.<br/>
                  2) Kerusakan/kehilangan akibat force majeure tidak menjadi tanggung jawab pengangkut.<br/>
                  3) Barang mudah pecah/cepat rusak harus diberi pengaman memadai.<br/>
                  4) Klaim disertai bukti sah dan diajukan selambat-lambatnya 3x24 jam setelah diterima.<br/>
                  5) Perhitungan berat berdasarkan Kg/M3 yang lebih besar.
                </div>
                <div class="badge-note">Isi dalam tidak diperiksa</div>
              </div>
            </div>
            <div class="right-summary">
              <div><strong>Jumlah</strong></div>
              <div class="date">${shipment.destination_city}, ${formatDate(shipment.created_at)}</div>
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
      `
    })

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bulk Surat Jalan - ${dbl.dbl_number}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: 9.5in 11in portrait; margin: 0; }
          :root { --ink:#000; --line:#000; --muted:#000; --paper:#fff; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { height: 100%; font-family: 'Courier New', Courier, monospace; font-size: 12px; color: var(--ink); }
          body { margin: 0; padding: 0; }
          .sheet { width: 9.5in; height: 11in; max-width: 9.5in; background: var(--paper); padding: 18px 24px; position: relative; }
          .page-break { page-break-before: always; }
          .dbl-banner { background: #000; color: #fff; text-align: center; padding: 6px 10px; font-size: 11px; font-weight: 700; margin-bottom: 10px; }
          .top { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 12px; }
          .brand { display: flex; gap: 10px; align-items: center; }
          .brand img { width: 48px; height: 48px; object-fit: contain; }
          .brand-title { font-weight: 800; font-size: 14px; letter-spacing: .4px; }
          .brand-sub { font-size: 11px; color: #000; margin-top: 2px; }
          .addr { font-size: 10px; color: #000; margin-top: 6px; white-space: pre-line; line-height: 1.4; }
          .right-box { margin-left: auto; border: 2px solid #000; padding: 8px 12px; text-align: center; min-width: 240px; }
          .right-box .title { font-weight: 800; font-size: 13px; letter-spacing: .5px; }
          .right-box .spb { margin-top: 6px; font-size: 12px; font-weight: 700; }
          .right-box .code { margin-top: 4px; font-size: 11px; }

          .barcode { text-align: right; margin: 10px 0 14px; }
          .barcode img { width: 320px; height: 80px; object-fit: contain; border: 2px solid #000; padding: 6px; background: #fff; }

          .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 10px; }
          .field { border: 2px solid #000; padding: 8px 10px; min-height: 50px; }
          .label { font-size: 10px; font-weight: 700; color: #000; margin-bottom: 4px; text-transform: uppercase; }
          .value { font-size: 12px; font-weight: 600; }

          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th, td { border: 2px solid #000; font-size: 11px; padding: 8px 10px; }
          thead th { background: #fff; font-weight: 700; }

          .bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 14px; align-items: start; }
          .tnc { border: 2px solid #000; padding: 10px; font-size: 9px; line-height: 1.5; color: #000; }
          .tnc h4 { margin: 0 0 6px; font-size: 10px; font-weight: 700; }
          .badge-note { display: inline-block; border: 2px solid #000; padding: 6px 10px; font-weight: 700; margin-top: 8px; font-size: 9px; }

          .sign-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 24px; }
          .sign { text-align: center; font-size: 11px; font-weight: 600; }
          .line { border-top: 2px solid #000; margin-top: 60px; padding-top: 4px; }

          .right-summary { text-align: right; font-size: 11px; font-weight: 600; }
          .right-summary .date { margin-top: 8px; }

          .delivered-stamp {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-15deg);
            font-size: 48px;
            font-weight: 900;
            color: rgba(0, 0, 0, 0.15);
            border: 6px solid rgba(0, 0, 0, 0.15);
            padding: 12px 28px;
            text-transform: uppercase;
            letter-spacing: 4px;
            pointer-events: none;
          }

          @media print {
            html, body { width: 9.5in; height: 11in; }
            body { padding: 0; }
            .sheet { border: 0; width: 9.5in; height: 11in; max-width: none; padding: 18mm 20mm; margin-bottom: 0; page-break-after: always; }
            .page-break { page-break-before: always; }
            .delivered-stamp { color: rgba(0, 0, 0, 0.2); border-color: rgba(0, 0, 0, 0.2); }
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
      </html>
    `
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 250)
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
  <div class="p-4 md:p-6 max-w-7xl mx-auto">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-primary/10 rounded-lg">
            <svg class="h-7 w-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <div>
            <h1 class="text-2xl font-bold">Surat Jalan</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400">Cetak dokumen pengiriman</p>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
      <div class="grid grid-cols-2 gap-0 border-b dark:border-gray-700">
        <button
          class="px-6 py-4 font-medium transition-all relative"
          :class="activeTab === 'spb' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'"
          @click="activeTab = 'spb'"
        >
          <span class="flex items-center gap-2">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span>SPB Individual</span>
          </span>
        </button>
        <button
          class="px-6 py-4 font-medium transition-all relative"
          :class="activeTab === 'dbl' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'"
          @click="activeTab = 'dbl'"
        >
          <span class="flex items-center gap-2">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            <span>Per DBL (Bulk)</span>
          </span>
        </button>
      </div>

      <div v-if="activeTab === 'spb'" class="p-6">
        <div class="mb-6">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Cari SPB, Resi, Pengirim, Penerima, Tujuan..."
              class="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
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
                  <th class="px-4 py-3 text-left text-sm font-medium">Kode</th>
                  <th class="px-4 py-3 text-left text-sm font-medium">Pengirim</th>
                  <th class="px-4 py-3 text-left text-sm font-medium">Penerima</th>
                  <th class="px-4 py-3 text-left text-sm font-medium">Tujuan</th>
                  <th class="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th class="px-4 py-3 text-center text-sm font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y dark:divide-gray-700 bg-white dark:bg-gray-800">
                <tr v-for="shipment in filteredShipments" :key="shipment.id" class="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
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
                    <Button variant="primary" @click="printDeliveryNote(shipment)">
                      <svg class="h-4 w-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                      Print
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
            class="bg-white dark:bg-gray-800 border rounded-lg p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow"
          >
            <div class="flex justify-between items-start">
              <div>
                <p class="font-mono text-sm font-medium">SPB: {{ shipment.spb_number || '-' }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 font-mono">{{ shipment.tracking_code }}</p>
              </div>
              <Badge :variant="getStatusVariant(shipment.status)">
                {{ shipment.status }}
              </Badge>
            </div>
            <div class="text-sm">
              <p><span class="text-gray-500 dark:text-gray-400">Dari:</span> {{ shipment.sender_name || '-' }}</p>
              <p><span class="text-gray-500 dark:text-gray-400">Ke:</span> {{ shipment.recipient_name || '-' }} - {{ shipment.destination_city || '-' }}</p>
            </div>
            <Button variant="primary" block @click="printDeliveryNote(shipment)">
              <svg class="h-4 w-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print Surat Jalan
            </Button>
          </div>
        </div>
    </div>

      <div v-if="activeTab === 'dbl'" class="p-6">
        <div class="mb-6">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              v-model="dblSearchQuery"
              type="text"
              placeholder="Cari No. DBL, Plat Kendaraan, Sopir, Tujuan..."
              class="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>        <div v-if="dblLoading" class="text-center py-8 text-gray-500 dark:text-gray-400">
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
              <tbody class="divide-y dark:divide-gray-700 bg-white dark:bg-gray-800">
                <tr v-for="dbl in filteredDBL" :key="dbl.id" class="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
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
                      <svg class="h-4 w-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                      Print {{ dbl.shipment_count }} SPB
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
            class="bg-white dark:bg-gray-800 border rounded-lg p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow"
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
                <svg class="h-4 w-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Print Semua
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
