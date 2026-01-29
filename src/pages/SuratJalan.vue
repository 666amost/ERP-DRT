<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
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
  dbl_number?: string
  driver_name?: string
  vehicle_plate?: string
  dbl_date?: string | null
  recipient_name: string
  recipient_address: string
  recipient_phone: string
  origin_city: string
  origin_province: string | null
  destination_city: string
  destination_province: string | null
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
const shipmentsById = ref<Record<string, Shipment>>({})
const dblList = ref<DBLItem[]>([])
const searchQuery = ref('')
const dblSearchQuery = ref('')
const loading = ref(false)
const dblLoading = ref(false)
const selectedShipments = ref<Set<string>>(new Set())
const selectedDBLs = ref<Set<string>>(new Set())
const selectAllSPB = ref(false)
const selectAllDBL = ref(false)

const upsertShipmentsById = (items: Shipment[]): void => {
  if (items.length === 0) return
  const next: Record<string, Shipment> = { ...shipmentsById.value }
  for (const item of items) {
    next[item.id] = item
  }
  shipmentsById.value = next
}

const shipmentsRequestId = ref(0)
const loadShipments = async (opts: { search?: string } = {}): Promise<void> => {
  const requestId = ++shipmentsRequestId.value
  loading.value = true
  try {
    const search = (opts.search ?? '').trim()
    const limit = search ? 5000 : 100
    const params = new URLSearchParams({ endpoint: 'list', limit: String(limit) })
    if (search) params.set('search', search)

    const res = await fetch(`/api/shipments?${params.toString()}`)
    if (!res.ok) throw new Error('Failed to load shipments')
    const data = await res.json()
    if (data.items && requestId === shipmentsRequestId.value) {
      const normalized: Shipment[] = data.items
        .filter((s: Shipment) => s.status !== 'DRAFT')
        .map((s: Record<string, unknown>) => ({
          id: String(s.id),
          tracking_code: s.public_code as string || '',
          spb_number: s.spb_number as string || '',
          sender_name: s.pengirim_name as string || s.customer_name as string || '',
          dbl_number: (s as Record<string, string>).dbl_number || (s as Record<string, string>).dbl,
          driver_name: (s as Record<string, string>).driver_name || (s as Record<string, string>).driver || (s as Record<string, string>).supir,
          vehicle_plate: (s as Record<string, string>).vehicle_plate || (s as Record<string, string>).plat || (s as Record<string, string>).license_plate,
          dbl_date: (s as Record<string, string>).dbl_date || null,
          recipient_name: s.penerima_name as string || '',
          recipient_address: s.shipping_address as string || '',
          recipient_phone: s.penerima_phone as string || '',
          origin_city: s.origin as string || '',
          origin_province: s.origin_province as string | null,
          destination_city: s.destination as string || '',
          destination_province: s.destination_province as string | null,
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

      shipments.value = normalized
      upsertShipmentsById(normalized)
      selectAllSPB.value = false
    }
  } catch {
    console.error('Failed to load shipments')
  } finally {
    if (requestId === shipmentsRequestId.value) {
      loading.value = false
    }
  }
}

const loadDBLList = async (): Promise<void> => {
  dblLoading.value = true
  try {
    const res = await fetch('/api/dbl?endpoint=list&limit=100')
    const data = await res.json()
    if (data.items) {
      dblList.value = data.items.map((d: Record<string, unknown>) => ({
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

const filteredShipments = computed(() => shipments.value)

let shipmentSearchTimer: ReturnType<typeof setTimeout> | undefined
watch([searchQuery, activeTab], ([query, tab]) => {
  if (tab !== 'spb') return
  if (shipmentSearchTimer) clearTimeout(shipmentSearchTimer)
  shipmentSearchTimer = setTimeout(() => {
    void loadShipments({ search: query })
  }, 350)
})

const filteredDBL = computed(() => {
  const activeList = dblList.value.filter(d =>
    d.status === 'IN_TRANSIT' || d.status === 'READY' || (d.shipment_count && d.shipment_count > 0)
  )
  if (!dblSearchQuery.value) return activeList
  const q = dblSearchQuery.value.toLowerCase()
  return activeList.filter(d =>
    d.dbl_number?.toLowerCase().includes(q) ||
    d.vehicle_plate?.toLowerCase().includes(q) ||
    d.driver_name?.toLowerCase().includes(q) ||
    d.destination_city?.toLowerCase().includes(q)
  )
})

const getDBLInfo = (dblId: string | null): DBLItem | null => {
  if (!dblId) return null
  return dblList.value.find(d => d.id === dblId) || null
}

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

const formatDestination = (city: string, province: string | null): string => {
  const cityStr = city || ''
  const provinceStr = province || ''
  if (cityStr && provinceStr) {
    return `${cityStr}, ${provinceStr}`
  }
  return cityStr || '-'
}

const fetchDblById = async (dblId: string | null): Promise<DBLItem | null> => {
  if (!dblId) return null
  try {
    const res = await fetch(`/api/dbl?endpoint=get&id=${dblId}`)
    if (!res.ok) return null
    const data = await res.json()
    if (!data || !data.id) return null
    return {
      id: String(data.id),
      dbl_number: data.dbl_number as string || '',
      dbl_date: data.dbl_date as string || '',
      vehicle_plate: data.vehicle_plate as string || '',
      driver_name: data.driver_name as string || '',
      destination_city: data.destination as string || '',
      status: data.status as string || '',
      shipment_count: Number(data.shipment_count) || 0,
      total_colli: 0,
      total_weight: 0
    }
  } catch {
    return null
  }
}

const resolveShipmentDblMeta = async (shipment: Shipment): Promise<{ dblNumber: string; driverName: string; dblDate: string }> => {
  let dblNumber = shipment.dbl_number || '-'
  let driverName = shipment.driver_name || '-'
  let dblDate = formatDate(shipment.dbl_date || '')

  const localDbl = shipment.dbl_id ? getDBLInfo(shipment.dbl_id) : null
  if (localDbl) {
    dblNumber = localDbl.dbl_number || dblNumber
    driverName = localDbl.driver_name || driverName
    dblDate = formatDate(localDbl.dbl_date)
  } else if (shipment.dbl_id) {
    const fetched = await fetchDblById(shipment.dbl_id)
    if (fetched) {
      dblNumber = fetched.dbl_number || dblNumber
      driverName = fetched.driver_name || driverName
      dblDate = formatDate(fetched.dbl_date)
    }
  }

  return { dblNumber, driverName, dblDate }
}

const toggleShipmentSelection = (id: string): void => {
  if (selectedShipments.value.has(id)) {
    selectedShipments.value.delete(id)
  } else {
    selectedShipments.value.add(id)
  }
}

const toggleAllShipments = (): void => {
  if (selectAllSPB.value) {
    selectedShipments.value.clear()
    selectAllSPB.value = false
  } else {
    filteredShipments.value.forEach(s => {
      selectedShipments.value.add(s.id)
    })
    selectAllSPB.value = true
  }
}

const toggleDBLSelection = (id: string): void => {
  if (selectedDBLs.value.has(id)) {
    selectedDBLs.value.delete(id)
  } else {
    selectedDBLs.value.add(id)
  }
}

const toggleAllDBLs = (): void => {
  if (selectAllDBL.value) {
    selectedDBLs.value.clear()
    selectAllDBL.value = false
  } else {
    filteredDBL.value.forEach(d => {
      selectedDBLs.value.add(d.id)
    })
    selectAllDBL.value = true
  }
}

const printDeliveryNote = async (shipment: Shipment): Promise<void> => {
  const company = await getCompany()
  const publicCode = shipment.tracking_code || ''
  const { dblNumber, driverName, dblDate } = await resolveShipmentDblMeta(shipment)
  
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
        @page { size: 11in 9.5in landscape; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { font-family: Arial, sans-serif; color: #000; }
        body { margin: 0; padding: 8mm 10mm; background: #fff; }
        .sheet { width: 100%; background: #fff; position: relative; }
        
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px solid #000; }
        .brand { display: flex; gap: 6px; align-items: center; }
        .brand img { width: 40px; height: 40px; object-fit: contain; }
        .brand-title { font-weight: bold; font-size: 16px; line-height: 1.2; }
        .brand-sub { font-size: 9px; margin-top: 1px; }
        .addr { font-size: 10px; margin-top: 3px; line-height: 1.3; font-weight: 500; }
        .right-box { border: 1px solid #000; padding: 4px 8px; text-align: center; min-width: 180px; margin-top: 12px; }
        .right-box .spb { font-size: 16px; font-weight: bold; }

        .meta-row { display: grid; grid-template-columns: 1fr auto; align-items: stretch; gap: 6px; margin: 2px 0 4px 0; }
        .meta-fields { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; }
        .meta-box { border: 1px solid #000; padding: 3px 6px; min-height: 28px; }
        .meta-label { font-size: 10px; margin-bottom: 2px; text-transform: uppercase; }
        .meta-value { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: bold; min-height: 16px; }
        .meta-main { display: inline-block; }
        .meta-date { font-size: 14px; font-weight: bold; line-height: 1.1; }

        .barcode-section { text-align: right; padding-right: 2px; display: flex; align-items: center; justify-content: flex-end; }
        .barcode-section img { width: 150px; height: 32px; border: 1px solid #000; padding: 1px; }

        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 6px 0; }
        .info-box { border: 1px solid #000; padding: 5px; min-height: 45px; }
        .info-label { font-size: 10px; margin-bottom: 2px; text-transform: uppercase; }
        .info-value { font-size: 16px; font-weight: bold; }

        .table-wrapper { margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 5px 4px; text-align: left; vertical-align: top; white-space: pre-wrap; word-wrap: break-word; }
        th { background: #fff; font-size: 10px; }
        td { font-size: 14px; font-weight: bold; min-height: 60px; height: 60px; }

        .sign-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 12px; }
        .sign { text-align: center; }
        .sign-label { font-size: 11px; font-weight: bold; margin-bottom: 20px; }
        .sign-line { border-top: 1px solid #000; padding-top: 3px; font-size: 11px; font-weight: bold; }

        .delivered-stamp {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-15deg);
          font-size: 60px;
          font-weight: 900;
          color: rgba(0, 0, 0, 0.08);
          border: 6px solid rgba(0, 0, 0, 0.08);
          padding: 15px 30px;
          text-transform: uppercase;
          letter-spacing: 5px;
          pointer-events: none;
        }

        @media print {
          body { padding: 6mm 8mm; }
          .delivered-stamp { color: rgba(0, 0, 0, 0.12); border-color: rgba(0, 0, 0, 0.12); }
        }
      </style>
    </head>
    <body>
      <div class="sheet">
        ${deliveredStamp}
        
        <div class="header">
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
            <div class="spb">${spbNumber}</div>
          </div>
        </div>

        <div class="meta-row">
            <div class="meta-fields">
              <div class="meta-box">
                <div class="meta-label">No. DBL</div>
                <div class="meta-value">
                  <span class="meta-main">${dblNumber}</span>
                  ${dblDate && dblDate !== '-' ? `<span class="meta-date">${dblDate}</span>` : ''}
                </div>
              </div>
              <div class="meta-box">
                <div class="meta-label">Supir</div>
                <div class="meta-value">${driverName}</div>
              </div>
          </div>
          <div class="barcode-section">
            <img src="/api/blob?endpoint=generate&code=${publicCode}&type=barcode&hideText=1" alt="Barcode" />
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <div class="info-label">Pengirim</div>
            <div class="info-value">${shipment.sender_name || '-'}</div>
          </div>
          <div class="info-box">
            <div class="info-label">Penerima</div>
            <div class="info-value">${shipment.recipient_name || '-'}</div>
          </div>
          <div class="info-box">
            <div class="info-label">ALAMAT PENGIRIM</div>
            <div class="info-value">${shipment.origin_city}</div>
          </div>
          <div class="info-box">
            <div class="info-label">No. Telp Penerima</div>
            <div class="info-value">${shipment.recipient_phone || '-'}</div>
          </div>
          <div class="info-box">
            <div class="info-label">Banyaknya</div>
            <div class="info-value">${shipment.total_colli} Koli</div>
          </div>
          <div class="info-box">
            <div class="info-label">Tujuan Pengiriman</div>
            <div class="info-value">${formatDestination(shipment.destination_city, shipment.destination_province)}</div>
          </div>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style="width:12%">Kg/M3</th>
                <th>Nama Barang</th>
                <th style="width:30%">Ongkos Kirim</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${shipment.total_weight || '-'}</td>
                <td>${(shipment.description || 'Barang kiriman').split(', ').join('\n')}</td>
                <td>${formatRupiah(shipment.nominal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="sign-row">
          <div class="sign">
            <div class="sign-label">Pengirim</div>
            <div class="sign-line">( ${shipment.sender_name || '................................'} )</div>
          </div>
          <div class="sign">
            <div class="sign-label">Yang Menerima</div>
            <div class="sign-line">( ................................ )</div>
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

    const printWindowRef = window.open('', '_blank')
    if (!printWindowRef) {
      alert('Popup blocked. Please allow popups for this site.')
      return
    }

    let pagesHtml = ''
    data.items.forEach((s: Record<string, unknown>, index: number) => {
      const spbNumber = s.spb_number as string || '-'
      const publicCode = s.tracking_code as string || s.public_code as string || ''
      const dblNumber = dbl.dbl_number || '-'
      const dblDate = formatDate(dbl.dbl_date)
      const driverName = dbl.driver_name || '-'
      const shipment = {
        spb_number: spbNumber,
        tracking_code: publicCode,
        sender_name: s.sender_name as string || s.pengirim_name as string || s.customer_name as string || '',
        recipient_name: s.recipient_name as string || s.penerima_name as string || '',
        recipient_phone: s.recipient_phone as string || s.penerima_phone as string || '',
        origin_city: s.origin_city as string || s.origin as string || '',
        origin_province: s.origin_province as string | null,
        destination_city: s.destination_city as string || s.destination as string || '',
        destination_province: s.destination_province as string | null,
        total_colli: Number(s.total_colli) || 0,
        total_weight: Number(s.total_weight) || Number(s.berat) || 0,
        description: s.description as string || s.macam_barang as string || '',
        notes: s.keterangan as string || '',
        status: s.status as string || '',
        created_at: s.created_at as string || '',
        nominal: Number(s.nominal) || 0
      }
      const deliveredStamp = shipment.status === 'DELIVERED' ? `<div class="delivered-stamp">DELIVERED</div>` : ''
      
      pagesHtml += `
        <div class="sheet ${index > 0 ? 'page-break' : ''}">
          ${deliveredStamp}
          <div class="dbl-banner">DBL: ${dbl.dbl_number} | Kendaraan: ${dbl.vehicle_plate} | Sopir: ${dbl.driver_name}</div>
          
          <div class="header">
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
            <div class="spb">${spbNumber}</div>
          </div>
        </div>

          <div class="meta-row">
            <div class="meta-fields">
              <div class="meta-box">
                <div class="meta-label">No. DBL</div>
                <div class="meta-value">
                  <span class="meta-main">${dblNumber}</span>
                  ${dblDate && dblDate !== '-' ? `<span class="meta-date">${dblDate}</span>` : ''}
                </div>
              </div>
              <div class="meta-box">
                <div class="meta-label">Supir</div>
                <div class="meta-value">${driverName}</div>
              </div>
            </div>
            <div class="barcode-section">
              <img src="/api/blob?endpoint=generate&code=${publicCode}&type=barcode&hideText=1" alt="Barcode" />
            </div>
          </div>

          <div class="info-grid">
            <div class="info-box">
              <div class="info-label">Pengirim</div>
              <div class="info-value">${shipment.sender_name || '-'}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Penerima</div>
              <div class="info-value">${shipment.recipient_name || '-'}</div>
            </div>
            <div class="info-box">
              <div class="info-label">ALAMAT PENGIRIM</div>
              <div class="info-value">${shipment.origin_city}</div>
            </div>
            <div class="info-box">
              <div class="info-label">No. Telp Penerima</div>
              <div class="info-value">${shipment.recipient_phone || '-'}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Banyaknya</div>
              <div class="info-value">${shipment.total_colli} Koli</div>
            </div>
            <div class="info-box">
              <div class="info-label">TUJUAN</div>
              <div class="info-value">${formatDestination(shipment.destination_city, shipment.destination_province)}</div>
            </div>
          </div>

          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style="width:12%">Kg/M3</th>
                  <th>Nama Barang</th>
                  <th style="width:30%">Ongkos Kirim</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${shipment.total_weight || '-'}</td>
                  <td>${(shipment.description || 'Barang kiriman').split(', ').join('\n')}</td>
                  <td>${formatRupiah(shipment.nominal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="sign-row">
            <div class="sign">
              <div class="sign-label">Pengirim</div>
              <div class="sign-line">( ${shipment.sender_name || '................................'} )</div>
            </div>
            <div class="sign">
              <div class="sign-label">Yang Menerima</div>
              <div class="sign-line">( ................................ )</div>
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
          @page { size: 11in 9.5in landscape; margin: 0; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { font-family: Arial, sans-serif; color: #000; }
          body { margin: 0; padding: 8mm 10mm; background: #fff; }
          .sheet { width: 100%; background: #fff; position: relative; }
          .page-break { page-break-before: always; }
          .dbl-banner { background: #000; color: #fff; text-align: center; padding: 3px 6px; font-size: 9px; font-weight: bold; margin-bottom: 4px; }
          
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px solid #000; }
          .brand { display: flex; gap: 6px; align-items: center; }
          .brand img { width: 40px; height: 40px; object-fit: contain; }
          .brand-title { font-weight: bold; font-size: 16px; line-height: 1.2; }
          .brand-sub { font-size: 9px; margin-top: 1px; }
          .addr { font-size: 10px; margin-top: 3px; line-height: 1.3; font-weight: 500; }
          .right-box { border: 1px solid #000; padding: 4px 8px; text-align: center; min-width: 180px; margin-top: 12px; }
          .right-box .spb { font-size: 16px; font-weight: bold; }

          .meta-row { display: grid; grid-template-columns: 1fr auto; align-items: stretch; gap: 6px; margin: 2px 0 4px 0; }
          .meta-fields { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; }
          .meta-box { border: 1px solid #000; padding: 3px 6px; min-height: 28px; }
          .meta-label { font-size: 10px; margin-bottom: 2px; text-transform: uppercase; }
          .meta-value { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: bold; min-height: 16px; }
          .meta-main { display: inline-block; }
          .meta-date { font-size: 14px; font-weight: bold; line-height: 1.1; }

          .barcode-section { text-align: right; padding-right: 2px; display: flex; align-items: center; justify-content: flex-end; }
          .barcode-section img { width: 150px; height: 32px; border: 1px solid #000; padding: 1px; }

          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 6px 0; }
          .info-box { border: 1px solid #000; padding: 5px; min-height: 45px; }
          .info-label { font-size: 10px; margin-bottom: 2px; text-transform: uppercase; }
          .info-value { font-size: 16px; font-weight: bold; }

          .table-wrapper { margin: 6px 0; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 5px 4px; text-align: left; vertical-align: top; white-space: pre-wrap; word-wrap: break-word; }
          th { background: #fff; font-size: 10px; }
          td { font-size: 14px; font-weight: bold; min-height: 60px; height: 60px; }

          .sign-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 12px; }
          .sign { text-align: center; }
          .sign-label { font-size: 11px; font-weight: bold; margin-bottom: 20px; }
          .sign-line { border-top: 1px solid #000; padding-top: 3px; font-size: 11px; font-weight: bold; }

          .delivered-stamp {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-15deg);
            font-size: 60px;
            font-weight: 900;
            color: rgba(0, 0, 0, 0.08);
            border: 6px solid rgba(0, 0, 0, 0.08);
            padding: 15px 30px;
            text-transform: uppercase;
            letter-spacing: 5px;
            pointer-events: none;
          }

          @media print {
            body { padding: 0; }
            .sheet { padding: 6mm 8mm; }
            .delivered-stamp { color: rgba(0, 0, 0, 0.12); border-color: rgba(0, 0, 0, 0.12); }
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
      </html>
    `
    printWindowRef.document.write(html)
    printWindowRef.document.close()
    printWindowRef.focus()
    setTimeout(() => {
      printWindowRef.print()
    }, 250)
  } catch {
    console.error('Failed to print bulk surat jalan')
  }
}

const printSelectedShipments = async (): Promise<void> => {
  if (selectedShipments.value.size === 0) {
    alert('Silakan pilih minimal 1 SPB untuk dicetak')
    return
  }

  const selected = Array.from(selectedShipments.value)
    .map(id => shipmentsById.value[id])
    .filter((s): s is Shipment => Boolean(s))

  if (selected.length !== selectedShipments.value.size) {
    alert('Sebagian SPB terpilih belum termuat. Silakan cari ulang SPB tersebut lalu coba cetak lagi.')
    return
  }

  const company = await getCompany()
  
  const barcodePromises = selected.map(s => {
    const publicCode = s.tracking_code || ''
    return new Promise<void>((resolve) => {
      const img = new Image()
      img.onload = () => resolve()
      img.onerror = () => resolve()
      img.src = `/api/blob?endpoint=generate&code=${publicCode}&type=barcode`
    })
  })
  await Promise.all(barcodePromises)

  const printWindowRef = window.open('', '_blank')
  if (!printWindowRef) {
    alert('Popup blocked. Please allow popups for this site.')
    return
  }

  let pagesHtml = ''
  let index = 0
  for (const shipment of selected) {
    const spbNumber = shipment.spb_number || '-'
    const publicCode = shipment.tracking_code || ''
    const deliveredStamp = shipment.status === 'DELIVERED' ? `<div class="delivered-stamp">DELIVERED</div>` : ''
    const { dblNumber, driverName, dblDate } = await resolveShipmentDblMeta(shipment)
    
    pagesHtml += `
      <div class="sheet ${index > 0 ? 'page-break' : ''}">
        ${deliveredStamp}
        
        <div class="header">
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
            <div class="spb">${spbNumber}</div>
          </div>
        </div>

        <div class="meta-row">
          <div class="meta-fields">
            <div class="meta-box">
              <div class="meta-label">No. DBL</div>
              <div class="meta-value">
                <span class="meta-main">${dblNumber}</span>
                ${dblDate && dblDate !== '-' ? `<span class="meta-date">${dblDate}</span>` : ''}
              </div>
            </div>
            <div class="meta-box">
              <div class="meta-label">Supir</div>
              <div class="meta-value">${driverName}</div>
            </div>
          </div>
          <div class="barcode-section">
            <img src="/api/blob?endpoint=generate&code=${publicCode}&type=barcode&hideText=1" alt="Barcode" />
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <div class="info-label">Pengirim</div>
            <div class="info-value">${shipment.sender_name || '-'}</div>
          </div>
          <div class="info-box">
            <div class="info-label">Penerima</div>
            <div class="info-value">${shipment.recipient_name || '-'}</div>
          </div>
          <div class="info-box">
            <div class="info-label">ALAMAT PENGIRIM</div>
            <div class="info-value">${shipment.origin_city}</div>
          </div>
          <div class="info-box">
            <div class="info-label">No. Telp Penerima</div>
            <div class="info-value">${shipment.recipient_phone || '-'}</div>
          </div>
          <div class="info-box">
            <div class="info-label">Banyaknya</div>
            <div class="info-value">${shipment.total_colli} Koli</div>
          </div>
          <div class="info-box">
            <div class="info-label">TUJUAN</div>
            <div class="info-value">${formatDestination(shipment.destination_city, shipment.destination_province)}</div>
          </div>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style="width:12%">Kg/M3</th>
                <th>Nama Barang</th>
                <th style="width:30%">Ongkos Kirim</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${shipment.total_weight || '-'}</td>
                <td>${(shipment.description || 'Barang kiriman').split(', ').join('\n')}</td>
                <td>${formatRupiah(shipment.nominal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="sign-row">
          <div class="sign">
            <div class="sign-label">Pengirim</div>
            <div class="sign-line">( ${shipment.sender_name || '................................'} )</div>
          </div>
          <div class="sign">
            <div class="sign-label">Yang Menerima</div>
            <div class="sign-line">( ................................ )</div>
          </div>
        </div>
      </div>
    `
    index += 1
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bulk Surat Jalan</title>
      <meta charset="utf-8" />
      <style>
        @page { size: 11in 9.5in landscape; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { font-family: Arial, sans-serif; color: #000; }
        body { margin: 0; padding: 8mm 10mm; background: #fff; }
        .sheet { width: 100%; background: #fff; position: relative; }
        .page-break { page-break-before: always; }
        
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px solid #000; }
        .brand { display: flex; gap: 6px; align-items: center; }
        .brand img { width: 40px; height: 40px; object-fit: contain; }
        .brand-title { font-weight: bold; font-size: 16px; line-height: 1.2; }
        .brand-sub { font-size: 9px; margin-top: 1px; }
        .addr { font-size: 10px; margin-top: 3px; line-height: 1.3; font-weight: 500; }
        .right-box { border: 1px solid #000; padding: 4px 8px; text-align: center; min-width: 180px; margin-top: 12px; }
        .right-box .spb { font-size: 16px; font-weight: bold; }

        .meta-row { display: grid; grid-template-columns: 1fr auto; align-items: stretch; gap: 6px; margin: 2px 0 4px 0; }
        .meta-fields { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; }
        .meta-box { border: 1px solid #000; padding: 3px 6px; min-height: 28px; }
        .meta-label { font-size: 10px; margin-bottom: 2px; text-transform: uppercase; }
        .meta-value { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: bold; min-height: 16px; }
        .meta-main { display: inline-block; }
        .meta-date { font-size: 14px; font-weight: bold; line-height: 1.1; }

        .barcode-section { text-align: right; padding-right: 2px; display: flex; align-items: center; justify-content: flex-end; }
        .barcode-section img { width: 150px; height: 32px; border: 1px solid #000; padding: 1px; }

        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 6px 0; }
        .info-box { border: 1px solid #000; padding: 5px; min-height: 45px; }
        .info-label { font-size: 10px; margin-bottom: 2px; text-transform: uppercase; }
        .info-value { font-size: 16px; font-weight: bold; }

        .table-wrapper { margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 5px 4px; text-align: left; vertical-align: top; white-space: pre-wrap; word-wrap: break-word; }
        th { background: #fff; font-size: 10px; }
        td { font-size: 14px; font-weight: bold; min-height: 60px; height: 60px; }

        .sign-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 12px; }
        .sign { text-align: center; }
        .sign-label { font-size: 11px; font-weight: bold; margin-bottom: 20px; }
        .sign-line { border-top: 1px solid #000; padding-top: 3px; font-size: 11px; font-weight: bold; }

        .delivered-stamp {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-15deg);
          font-size: 60px;
          font-weight: 900;
          color: rgba(0, 0, 0, 0.08);
          border: 6px solid rgba(0, 0, 0, 0.08);
          padding: 15px 30px;
          text-transform: uppercase;
          letter-spacing: 5px;
          pointer-events: none;
        }

        @media print {
          body { padding: 0; }
          .sheet { padding: 6mm 8mm; }
          .delivered-stamp { color: rgba(0, 0, 0, 0.12); border-color: rgba(0, 0, 0, 0.12); }
        }
      </style>
    </head>
    <body>
      ${pagesHtml}
    </body>
    </html>
  `
  printWindowRef.document.write(html)
  printWindowRef.document.close()
  printWindowRef.focus()
  setTimeout(() => {
    printWindowRef.print()
  }, 250)
}

const printSelectedDBLs = async (): Promise<void> => {
  if (selectedDBLs.value.size === 0) {
    alert('Silakan pilih minimal 1 DBL untuk dicetak')
    return
  }

  const selected = dblList.value.filter(d => selectedDBLs.value.has(d.id))
  const company = await getCompany()

  const allItems: Array<Record<string, unknown>> = []
  const dblMap = new Map<string, DBLItem>()

  for (const dbl of selected) {
    dblMap.set(dbl.id, dbl)
    const res = await fetch(`/api/dbl?endpoint=items&id=${dbl.id}`)
    const data = await res.json()
    if (data.items) {
      allItems.push(...data.items.map((item: Record<string, unknown>) => ({
        ...item,
        dbl_id: dbl.id
      })))
    }
  }

  if (allItems.length === 0) {
    alert('Tidak ada SPB dalam DBL yang dipilih')
    return
  }

  const barcodePromises = allItems.map((s: Record<string, unknown>) => {
    const publicCode = s.public_code as string || ''
    return new Promise<void>((resolve) => {
      const img = new Image()
      img.onload = () => resolve()
      img.onerror = () => resolve()
      img.src = `/api/blob?endpoint=generate&code=${publicCode}&type=barcode`
    })
  })
  await Promise.all(barcodePromises)

  const printWindowRef = window.open('', '_blank')
  if (!printWindowRef) {
    alert('Popup blocked. Please allow popups for this site.')
    return
  }

  let pagesHtml = ''
  allItems.forEach((s: Record<string, unknown>, index: number) => {
    const dbl = dblMap.get(s.dbl_id as string)
    const spbNumber = s.spb_number as string || '-'
    const publicCode = s.tracking_code as string || s.public_code as string || ''
    const dblNumber = dbl?.dbl_number || (s.dbl_number as string) || '-'
    const dblDate = dbl?.dbl_date ? formatDate(dbl.dbl_date) : formatDate((s.dbl_date as string) || '')
    const driverName = dbl?.driver_name || (s.driver_name as string) || '-'
    const shipment = {
      spb_number: spbNumber,
      tracking_code: publicCode,
      sender_name: s.sender_name as string || s.pengirim_name as string || s.customer_name as string || '',
      recipient_name: s.recipient_name as string || s.penerima_name as string || '',
      recipient_phone: s.recipient_phone as string || s.penerima_phone as string || '',
      origin_city: s.origin_city as string || s.origin as string || '',
      origin_province: s.origin_province as string | null,
      destination_city: s.destination_city as string || s.destination as string || '',
      destination_province: s.destination_province as string | null,
      total_colli: Number(s.total_colli) || 0,
      total_weight: Number(s.total_weight) || Number(s.berat) || 0,
      description: s.description as string || s.macam_barang as string || '',
      notes: s.keterangan as string || '',
      status: s.status as string || '',
      created_at: s.created_at as string || '',
      nominal: Number(s.nominal) || 0
    }
    const deliveredStamp = shipment.status === 'DELIVERED' ? `<div class="delivered-stamp">DELIVERED</div>` : ''
    
    pagesHtml += `
      <div class="sheet ${index > 0 ? 'page-break' : ''}">
        ${deliveredStamp}
        <div class="dbl-banner">DBL: ${dbl?.dbl_number} | Kendaraan: ${dbl?.vehicle_plate} | Sopir: ${dbl?.driver_name}</div>
        
        <div class="header">
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
          <div class="spb">${spbNumber}</div>
        </div>
      </div>

        <div class="meta-row">
          <div class="meta-fields">
            <div class="meta-box">
              <div class="meta-label">No. DBL</div>
              <div class="meta-value">
                <span class="meta-main">${dblNumber}</span>
                ${dblDate && dblDate !== '-' ? `<span class="meta-date">${dblDate}</span>` : ''}
              </div>
            </div>
            <div class="meta-box">
              <div class="meta-label">Supir</div>
              <div class="meta-value">${driverName}</div>
            </div>
          </div>
          <div class="barcode-section">
            <img src="/api/blob?endpoint=generate&code=${publicCode}&type=barcode&hideText=1" alt="Barcode" />
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <div class="info-label">Pengirim</div>
            <div class="info-value">${shipment.sender_name || '-'}</div>
          </div>
          <div class="info-box">
            <div class="info-label">Penerima</div>
            <div class="info-value">${shipment.recipient_name || '-'}</div>
          </div>
          <div class="info-box">
            <div class="info-label">ALAMAT PENGIRIM</div>
            <div class="info-value">${shipment.origin_city}</div>
          </div>
          <div class="info-box">
            <div class="info-label">No. Telp Penerima</div>
            <div class="info-value">${shipment.recipient_phone || '-'}</div>
          </div>
          <div class="info-box">
            <div class="info-label">Banyaknya</div>
            <div class="info-value">${shipment.total_colli} Koli</div>
          </div>
          <div class="info-box">
            <div class="info-label">TUJUAN</div>
            <div class="info-value">${formatDestination(shipment.destination_city, shipment.destination_province)}</div>
          </div>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style="width:12%">Kg/M3</th>
                <th>Nama Barang</th>
                <th style="width:30%">Ongkos Kirim</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${shipment.total_weight || '-'}</td>
                <td>${(shipment.description || 'Barang kiriman').split(', ').join('\n')}</td>
                <td>${formatRupiah(shipment.nominal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="sign-row">
          <div class="sign">
            <div class="sign-label">Pengirim</div>
            <div class="sign-line">( ${shipment.sender_name || '................................'} )</div>
          </div>
          <div class="sign">
            <div class="sign-label">Yang Menerima</div>
            <div class="sign-line">( ................................ )</div>
          </div>
        </div>
      </div>
    `
  })

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bulk Surat Jalan</title>
      <meta charset="utf-8" />
      <style>
        @page { size: 11in 9.5in landscape; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { font-family: Arial, sans-serif; color: #000; }
          body { margin: 0; padding: 8mm 10mm; background: #fff; }
          .sheet { width: 100%; background: #fff; position: relative; }
          .page-break { page-break-before: always; }
          .dbl-banner { background: #000; color: #fff; text-align: center; padding: 3px 6px; font-size: 9px; font-weight: bold; margin-bottom: 4px; }
          
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px solid #000; }
          .brand { display: flex; gap: 6px; align-items: center; }
          .brand img { width: 40px; height: 40px; object-fit: contain; }
          .brand-title { font-weight: bold; font-size: 16px; line-height: 1.2; }
          .brand-sub { font-size: 9px; margin-top: 1px; }
          .addr { font-size: 10px; margin-top: 3px; line-height: 1.3; font-weight: 500; }
          .right-box { border: 1px solid #000; padding: 4px 8px; text-align: center; min-width: 180px; margin-top: 12px; }
          .right-box .spb { font-size: 16px; font-weight: bold; }

          .meta-row { display: grid; grid-template-columns: 1fr auto; align-items: stretch; gap: 6px; margin: 2px 0 4px 0; }
          .meta-fields { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; }
          .meta-box { border: 1px solid #000; padding: 3px 6px; min-height: 28px; }
          .meta-label { font-size: 10px; margin-bottom: 2px; text-transform: uppercase; }
          .meta-value { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: bold; min-height: 16px; }
          .meta-main { display: inline-block; }
          .meta-date { font-size: 14px; font-weight: bold; line-height: 1.1; }

          .barcode-section { text-align: right; padding-right: 2px; display: flex; align-items: center; justify-content: flex-end; }
          .barcode-section img { width: 150px; height: 32px; border: 1px solid #000; padding: 1px; }

        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 6px 0; }
        .info-box { border: 1px solid #000; padding: 5px; min-height: 45px; }
        .info-label { font-size: 10px; margin-bottom: 2px; text-transform: uppercase; }
        .info-value { font-size: 16px; font-weight: bold; }

        .table-wrapper { margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 5px 4px; text-align: left; vertical-align: top; white-space: pre-wrap; word-wrap: break-word; }
        th { background: #fff; font-size: 10px; }
        td { font-size: 14px; font-weight: bold; min-height: 60px; height: 60px; }

        .sign-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 12px; }
        .sign { text-align: center; }
        .sign-label { font-size: 11px; font-weight: bold; margin-bottom: 20px; }
        .sign-line { border-top: 1px solid #000; padding-top: 3px; font-size: 11px; font-weight: bold; }

        .delivered-stamp {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-15deg);
          font-size: 60px;
          font-weight: 900;
          color: rgba(0, 0, 0, 0.08);
          border: 6px solid rgba(0, 0, 0, 0.08);
          padding: 15px 30px;
          text-transform: uppercase;
          letter-spacing: 5px;
          pointer-events: none;
        }

        @media print {
          body { padding: 0; }
          .sheet { padding: 6mm 8mm; }
          .delivered-stamp { color: rgba(0, 0, 0, 0.12); border-color: rgba(0, 0, 0, 0.12); }
        }
      </style>
    </head>
    <body>
      ${pagesHtml}
    </body>
    </html>
  `
  printWindowRef.document.write(html)
  printWindowRef.document.close()
  printWindowRef.focus()
  setTimeout(() => {
    printWindowRef.print()
  }, 250)
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
        <div class="mb-6 space-y-3">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Cari SPB, Resi, Pengirim, Penerima, Tujuan..."
              class="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div v-if="filteredShipments.length > 0" class="flex gap-3 items-center">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                v-model="selectAllSPB"
                @change="toggleAllShipments"
                class="w-4 h-4 rounded border-gray-300 text-primary"
              />
              <span class="text-sm font-medium">Uncheck Semua</span>
            </label>
            <div class="text-sm text-gray-500">
              {{ selectedShipments.size }} dari {{ filteredShipments.length }} dipilih
            </div>
            <Button 
              v-if="selectedShipments.size > 0"
              variant="success"
              @click="printSelectedShipments"
              class="ml-auto"
            >
              <svg class="h-4 w-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print {{ selectedShipments.size }} SPB
            </Button>
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
                  <th class="px-4 py-3 text-left text-sm font-medium w-12">
                    <input
                      type="checkbox"
                      v-model="selectAllSPB"
                      @change="toggleAllShipments"
                      class="w-4 h-4 rounded border-gray-300 text-primary"
                    />
                  </th>
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
                  <td class="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      :checked="selectedShipments.has(shipment.id)"
                      @change="toggleShipmentSelection(shipment.id)"
                      class="w-4 h-4 rounded border-gray-300 text-primary"
                    />
                  </td>
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
              <div class="flex gap-3 items-start flex-1">
                <input
                  type="checkbox"
                  :checked="selectedShipments.has(shipment.id)"
                  @change="toggleShipmentSelection(shipment.id)"
                  class="w-4 h-4 rounded border-gray-300 text-primary mt-1"
                />
                <div>
                  <p class="font-mono text-sm font-medium">SPB: {{ shipment.spb_number || '-' }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 font-mono">{{ shipment.tracking_code }}</p>
                </div>
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
        <div class="mb-6 space-y-3">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              v-model="dblSearchQuery"
              type="text"
              placeholder="Cari No. DBL, Plat Kendaraan, Sopir, Tujuan..."
              class="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div v-if="filteredDBL.length > 0" class="flex gap-3 items-center">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                v-model="selectAllDBL"
                @change="toggleAllDBLs"
                class="w-4 h-4 rounded border-gray-300 text-primary"
              />
              <span class="text-sm font-medium">Uncheck Semua</span>
            </label>
            <div class="text-sm text-gray-500">
              {{ selectedDBLs.size }} dari {{ filteredDBL.length }} dipilih
            </div>
            <Button 
              v-if="selectedDBLs.size > 0"
              variant="success"
              @click="printSelectedDBLs"
              class="ml-auto"
            >
              <svg class="h-4 w-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print {{ selectedDBLs.size }} DBL
            </Button>
          </div>
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
                  <th class="px-4 py-3 text-left text-sm font-medium w-12">
                    <input
                      type="checkbox"
                      v-model="selectAllDBL"
                      @change="toggleAllDBLs"
                      class="w-4 h-4 rounded border-gray-300 text-primary"
                    />
                  </th>
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
                  <td class="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      :checked="selectedDBLs.has(dbl.id)"
                      @change="toggleDBLSelection(dbl.id)"
                      class="w-4 h-4 rounded border-gray-300 text-primary"
                    />
                  </td>
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
              <div class="flex gap-3 items-start flex-1">
                <input
                  type="checkbox"
                  :checked="selectedDBLs.has(dbl.id)"
                  @change="toggleDBLSelection(dbl.id)"
                  class="w-4 h-4 rounded border-gray-300 text-primary mt-1"
                />
                <div>
                  <p class="font-mono text-sm font-medium">{{ dbl.dbl_number }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ formatDate(dbl.dbl_date) }}</p>
                </div>
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
