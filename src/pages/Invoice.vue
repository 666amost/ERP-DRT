<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from '../components/ui/Button.vue';
import Badge from '../components/ui/Badge.vue';
import { useFormatters } from '../composables/useFormatters';
import { Icon } from '@iconify/vue';
import { getCompany } from '../lib/company';
const LOGO_URL = '/brand/logo.png';

const { formatRupiah, formatDate } = useFormatters();

type Invoice = {
  id: number;
  shipment_id: number | null;
  invoice_number: string;
  customer_name: string;
  customer_id: number | null;
  amount: number;
  status: string;
  issued_at: string;
  paid_at: string | null;
  tax_percent?: number;
  discount_amount?: number;
  notes?: string | null;
  subtotal?: number;
  pph_percent?: number;
  pph_amount?: number;
  paid_amount?: number;
  remaining_amount?: number;
  dbl_id?: number | null;
};

type InvoicePayment = {
  id: number;
  invoice_id: number;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
};

type CreateInvoiceForm = {
  customer_name: string;
  customer_id: number | null;
  amount: string;
  status: string;
};

type Item = {
  shipment_id?: number;
  spb_number?: string;
  tracking_code?: string;
  description: string;
  weight?: number;
  unit?: string;
  quantity: number;
  recipient_name?: string;
  destination_city?: string;
  unit_price: number;
  pph_rate?: number;
  tax_type?: string;
  item_discount?: number;
  _unit_price_display?: string;
  customer_name?: string;
  customer_id?: number | null;
};

type UnpaidShipment = {
  id: number;
  spb_number: string;
  tracking_code: string;
  customer_id: number | null;
  customer_name: string | null;
  description: string;
  weight: number;
  qty: number;
  unit: string;
  total_colli: number;
  recipient_name: string;
  recipient_address: string;
  destination_city: string;
  amount: number;
  created_at: string;
  status: string;
};

const invoices = ref<Invoice[]>([]);
const filteredInvoices = ref<Invoice[]>([]);
const searchQuery = ref('');
const route = useRoute();
const router = useRouter();
const loading = ref(true);
const showModal = ref(false);
const editingId = ref<number | null>(null);

const showPaymentModal = ref(false);
const selectedInvoice = ref<Invoice | null>(null);
const invoicePayments = ref<InvoicePayment[]>([]);
const loadingPayments = ref(false);
const paymentForm = ref({
  amount: '',
  payment_date: '',
  payment_method: 'TRANSFER',
  reference_number: '',
  notes: ''
});

const showPphModal = ref(false);
const pphFormPercent = ref<string>('0');

const form = ref<CreateInvoiceForm>({
  customer_name: '',
  customer_id: null,
  amount: '',
  status: 'pending'
});

const items = ref<Item[]>([]);
const allUnpaidShipments = ref<Item[]>([]);
const selectedShipmentIds = ref<Set<number>>(new Set());
const taxPercent = ref<number>(0);
const discountAmount = ref<number>(0);
const notes = ref<string>('');
const pphPercent = ref<number>(0.5);
const loadingUnpaidShipments = ref(false);

const uniqueCustomerNames = computed(() => {
  const names = new Set<string>();
  allUnpaidShipments.value.forEach(s => {
    if (s.customer_name && s.customer_name !== '-') {
      names.add(s.customer_name);
    }
  });
  return Array.from(names).sort();
});

async function loadAllUnpaidShipments(): Promise<void> {
  loadingUnpaidShipments.value = true;
  try {
    const res = await fetch('/api/shipments?endpoint=all-unpaid');
    const data = await res.json();
    
    if (data.shipments && data.shipments.length > 0) {
      allUnpaidShipments.value = data.shipments.map((s: UnpaidShipment) => ({
        shipment_id: s.id,
        spb_number: s.spb_number,
        tracking_code: s.tracking_code,
        customer_name: s.customer_name || '-',
        customer_id: s.customer_id,
        description: s.description || '-',
        weight: s.weight || 0,
        unit: s.unit || 'Kg',
        quantity: s.total_colli || 0,
        recipient_name: s.recipient_name || '-',
        destination_city: s.destination_city || '-',
        unit_price: s.amount || 0,
        pph_rate: pphPercent.value,
        tax_type: 'include',
        item_discount: 0,
        _unit_price_display: formatRupiah(s.amount || 0)
      }));
    } else {
      allUnpaidShipments.value = [];
    }
  } catch (e) {
    console.error('Failed to load unpaid shipments:', e);
    allUnpaidShipments.value = [];
  } finally {
    loadingUnpaidShipments.value = false;
  }
}

function getFilteredUnpaidShipments(): Item[] {
  if (!form.value.customer_name) {
    return allUnpaidShipments.value;
  }
  const customerName = form.value.customer_name.toLowerCase();
  return allUnpaidShipments.value.filter(s => {
    return s.customer_name?.toLowerCase() === customerName;
  });
}

function toggleShipmentSelection(shipmentId: number): void {
  if (selectedShipmentIds.value.has(shipmentId)) {
    selectedShipmentIds.value.delete(shipmentId);
  } else {
    selectedShipmentIds.value.add(shipmentId);
  }
  selectedShipmentIds.value = new Set(selectedShipmentIds.value);
  updateItemsFromSelection();
}

function selectAllFiltered(): void {
  const filtered = getFilteredUnpaidShipments();
  filtered.forEach(s => {
    if (s.shipment_id) selectedShipmentIds.value.add(s.shipment_id);
  });
  selectedShipmentIds.value = new Set(selectedShipmentIds.value);
  updateItemsFromSelection();
}

function deselectAll(): void {
  selectedShipmentIds.value.clear();
  selectedShipmentIds.value = new Set(selectedShipmentIds.value);
  updateItemsFromSelection();
}

function updateItemsFromSelection(): void {
  items.value = allUnpaidShipments.value.filter(s => s.shipment_id && selectedShipmentIds.value.has(s.shipment_id));
  const subtotal = items.value.reduce((sum, it) => sum + (it.unit_price || 0), 0);
  form.value.amount = String(subtotal);
}

function onCustomerChange(): void {
  const filtered = getFilteredUnpaidShipments();
  selectedShipmentIds.value.clear();
  filtered.forEach(s => {
    if (s.shipment_id) selectedShipmentIds.value.add(s.shipment_id);
  });
  selectedShipmentIds.value = new Set(selectedShipmentIds.value);
  updateItemsFromSelection();
}

async function loadItemsForInvoice(id: number | null): Promise<void> {
  if (!id) {
    items.value = [];
    return;
  }
  try {
    const res = await fetch(`/api/invoices?endpoint=items&invoice_id=${id}`);
    const data = await res.json();
    items.value = (data.items || []).map((i: { unit_price?: number; description?: string; quantity?: number; tax_type?: string; item_discount?: number }) => ({ ...i, _unit_price_display: i.unit_price ? formatRupiah(i.unit_price) : '' }));
  } catch {
    items.value = [];
  }
}

async function saveItemsForInvoice(invoiceId: number): Promise<void> {
  await fetch('/api/invoices?endpoint=set-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoice_id: invoiceId,
      items: items.value.map((it) => ({ description: it.description, quantity: it.quantity, unit_price: it.unit_price, tax_type: it.tax_type, item_discount: it.item_discount })),
      tax_percent: taxPercent.value,
      discount_amount: discountAmount.value,
      notes: notes.value || undefined
    })
  });
}

function calcSubtotal(): number {
  return items.value.reduce((acc: number, it: Item) => {
    const lineTotal = (it.quantity || 0) * (it.unit_price || 0);
    const line = Math.max(0, lineTotal - (it.item_discount || 0));
    return acc + line;
  }, 0);
}

function calcTotal(): number {
  const subtotal = calcSubtotal();
  const tax = (taxPercent.value || 0) * subtotal / 100;
  const total = subtotal + tax - (discountAmount.value || 0);
  return Math.max(0, total);
}

async function loadInvoices() {
  loading.value = true;
  try {
    const res = await fetch('/api/invoices?endpoint=list');
    const data = await res.json();
    invoices.value = (data.items || []).map((x: Partial<Invoice>) => ({
      ...x,
      tax_percent: Number(x.tax_percent || 0),
      discount_amount: Number(x.discount_amount || 0)
    }));
    // initialize filtered
    filterInvoices();
  } catch (e) {
    console.error('Failed to load invoices:', e);
  } finally {
    loading.value = false;
  }
}

function filterInvoices() {
  if (!searchQuery.value.trim()) {
    filteredInvoices.value = invoices.value;
  } else {
    const q = searchQuery.value.toLowerCase();
    filteredInvoices.value = invoices.value.filter(i =>
      String(i.invoice_number).toLowerCase().includes(q) ||
      String(i.customer_name || '').toLowerCase().includes(q)
    );
  }
}

function openCreateModal(): void {
  editingId.value = null;
  form.value = { customer_name: '', customer_id: null, amount: '', status: 'pending' };
  items.value = [];
  allUnpaidShipments.value = [];
  selectedShipmentIds.value = new Set();
  taxPercent.value = 0;
  discountAmount.value = 0;
  notes.value = '';
  showModal.value = true;
  loadAllUnpaidShipments();
}

async function openEditModal(invoice: Invoice) {
  editingId.value = invoice.id;
  form.value = {
    customer_name: invoice.customer_name,
    customer_id: invoice.customer_id,
    amount: String(invoice.amount),
    status: invoice.status
  };
  taxPercent.value = invoice.tax_percent || 0;
  discountAmount.value = invoice.discount_amount || 0;
  notes.value = invoice.notes || '';
  await loadItemsForInvoice(invoice.id);
  if (items.value.length === 0) {
    items.value = [{ description: 'Jasa pengiriman', quantity: 1, unit_price: invoice.amount, tax_type: 'include', item_discount: 0 }];
  }
  showModal.value = true;
}

async function saveInvoice() {
  const amount = parseFloat(form.value.amount) || 0;
  if (!form.value.customer_name && !form.value.customer_id) {
    alert('Pilih customer terlebih dahulu');
    return;
  }

  try {
    const recomputed = calcTotal();
    const finalAmount = !isNaN(recomputed) && recomputed > 0 ? recomputed : amount;
    if (editingId.value) {
      const res = await fetch('/api/invoices?endpoint=update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId.value,
          customer_name: form.value.customer_name,
          customer_id: form.value.customer_id || undefined,
          amount: finalAmount,
          status: form.value.status,
          tax_percent: taxPercent.value,
          discount_amount: discountAmount.value,
          notes: notes.value || undefined
        })
      });
      if (!res.ok) throw new Error('Update failed');
      await saveItemsForInvoice(editingId.value);
    } else {
      const res = await fetch('/api/invoices?endpoint=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: form.value.customer_name,
          customer_id: form.value.customer_id || undefined,
          amount: finalAmount,
          status: form.value.status,
          tax_percent: taxPercent.value,
          discount_amount: discountAmount.value,
          notes: notes.value || undefined
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Create failed');
      }
      try {
        const created = await res.json();
        const newId: number | undefined = created?.id ?? created?.invoice?.id;
        if (typeof newId === 'number') {
          await saveItemsForInvoice(newId);
        }
      } catch (err) {
        console.warn('Create invoice parse error', err);
      }
    }
    showModal.value = false;
    loadInvoices();
  } catch (e) {
    console.error('Save error:', e);
    alert(e instanceof Error ? e.message : 'Gagal menyimpan invoice');
  }
}

async function deleteInvoice(id: number) {
  if (!confirm('Yakin ingin menghapus invoice ini?')) return;
  
  try {
    const res = await fetch(`/api/invoices?endpoint=delete&id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    loadInvoices();
  } catch (e) {
    console.error('Delete error:', e);
    alert('Gagal menghapus invoice');
  }
}

async function openPaymentModal(inv: Invoice) {
  selectedInvoice.value = inv;
  loadingPayments.value = true;
  showPaymentModal.value = true;
  paymentForm.value = {
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'TRANSFER',
    reference_number: '',
    notes: ''
  };
  
  try {
    const res = await fetch(`/api/invoices?endpoint=payments&invoice_id=${inv.id}`);
    if (res.ok) {
      const data = await res.json();
      invoicePayments.value = data.payments || [];
    }
  } catch (e) {
    console.error('Failed to load payments:', e);
  } finally {
    loadingPayments.value = false;
  }
}

async function addPayment() {
  if (!selectedInvoice.value) return;
  
  const amount = parseFloat(paymentForm.value.amount);
  if (isNaN(amount) || amount <= 0) {
    alert('Masukkan jumlah pembayaran yang valid');
    return;
  }
  
  try {
    const res = await fetch('/api/invoices?endpoint=add-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_id: selectedInvoice.value.id,
        amount,
        payment_date: paymentForm.value.payment_date || null,
        payment_method: paymentForm.value.payment_method || null,
        reference_number: paymentForm.value.reference_number || null,
        notes: paymentForm.value.notes || null
      })
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Add payment failed');
    }
    
    await openPaymentModal(selectedInvoice.value);
    loadInvoices();
  } catch (e) {
    console.error('Add payment error:', e);
    alert('Gagal menambahkan pembayaran: ' + (e instanceof Error ? e.message : 'Unknown error'));
  }
}

async function deletePayment(paymentId: number) {
  if (!selectedInvoice.value) return;
  if (!confirm('Hapus pembayaran ini?')) return;
  
  try {
    await fetch(`/api/invoices?endpoint=delete-payment&payment_id=${paymentId}`, {
      method: 'DELETE'
    });
    await openPaymentModal(selectedInvoice.value);
    loadInvoices();
  } catch (e) {
    console.error('Delete payment error:', e);
    alert('Gagal menghapus pembayaran');
  }
}

function openPphModal(inv: Invoice) {
  selectedInvoice.value = inv;
  pphFormPercent.value = String(inv.pph_percent || 0);
  showPphModal.value = true;
}

async function updatePph() {
  if (!selectedInvoice.value) return;
  
  const pph = parseFloat(pphFormPercent.value) || 0;
  
  try {
    const res = await fetch('/api/invoices?endpoint=update-pph', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_id: selectedInvoice.value.id,
        pph_percent: pph
      })
    });
    
    if (!res.ok) throw new Error('Update PPh failed');
    
    showPphModal.value = false;
    loadInvoices();
  } catch (e) {
    console.error('Update PPh error:', e);
    alert('Gagal update PPh');
  }
}

function getPaymentStatus(inv: Invoice): { label: string; variant: 'default' | 'warning' | 'success' } {
  const remaining = inv.remaining_amount ?? inv.amount;
  const paid = inv.paid_amount ?? 0;
  
  if (remaining <= 0 || inv.status === 'paid') {
    return { label: 'Lunas', variant: 'success' };
  } else if (paid > 0) {
    return { label: 'Cicilan', variant: 'warning' };
  }
  return { label: 'Belum Bayar', variant: 'default' };
}

onMounted(() => {
  if (route.query.q) {
    searchQuery.value = String(route.query.q || '');
  }
  loadInvoices();
  if (route.query.create) {
    openCreateModal();
  }
});

watch([invoices, searchQuery], () => {
  filterInvoices();
});
// react to route changes when header triggers a new query
watch(() => route.query.q, (val) => {
  const v = val ? String(val) : '';
  if (v !== searchQuery.value) searchQuery.value = v;
});

// Open modal if route has create flag
watch(() => route.query.create, (val) => {
  if (val) {
    openCreateModal();
  }
});

// Clear create query when modal closed
watch(() => showModal.value, (val) => {
  if (!val && route.query.create) {
    const newQuery = { ...route.query } as Record<string, unknown>;
    delete (newQuery as Record<string, unknown>)['create'];
    router.replace({ name: 'invoice', query: newQuery as Record<string, unknown> });
  }
});

async function printInvoice(inv: Invoice): Promise<void> {
  let invItems: Item[] = [];
  try {
    const res = await fetch(`/api/invoices?endpoint=items&invoice_id=${inv.id}`);
    const data = await res.json();
    invItems = (data.items || []) as Item[];
  } catch {
    invItems = [];
  }
  const subtotal = invItems.reduce((acc: number, it: Item) => {
    const line = (it.quantity || 0) * (it.unit_price || 0) - (it.item_discount || 0);
    return acc + line;
  }, 0);
  const tax = ((inv.tax_percent || 0) * subtotal) / 100;
  const grand = subtotal + tax - (inv.discount_amount || 0);
  const company = await getCompany();
  const html = `<!DOCTYPE html><html><head><title>Invoice ${inv.invoice_number}</title><style>
    @page { size: 9.5in 5.5in; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; font-family: 'Courier New', Courier, monospace; font-size: 9px; color: #111827; }
    body { margin: 0; padding: 4px; }
    .sheet { width: 9.5in; height: 5.5in; max-width: 9.5in; background: #fff; padding: 5px 8px; position: relative; overflow: hidden; }
    .head { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 4px; }
    .brand { display: flex; align-items: center; gap: 6px; }
    .brand img { height: 24px; width: 24px; object-fit: contain; }
    .brand-name { font-weight: 700; font-size: 10px; }
    .meta { text-align: right; font-size: 8px; color: #374151; }
    .meta strong { font-size: 9px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th, td { border: 1px solid #000; padding: 2px 4px; font-size: 8px; }
    th { background: #f9fafb; text-align: left; font-size: 7px; }
    .right { text-align: right; }
    .totals { margin-top: 4px; width: 100%; }
    .totals td { border: none; font-size: 8px; padding: 1px 4px; }
    .footer { margin-top: 6px; font-size: 7px; color: #6b7280; text-align: center; }
    .totals-row { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; margin-top: 4px; }
    .qr-inline { width: 50px; height: 50px; border: 1px solid #e5e7eb; padding: 2px; background: #fff; display: flex; align-items: center; justify-content: center; }
    .qr-inline img { width: 100%; height: auto; display: block; }
    @media print {
      html, body { width: 9.5in; height: 5.5in; }
      body { padding: 0; }
      .sheet { border: 0; width: 9.5in; height: 5.5in; max-width: none; padding: 4mm 6mm; page-break-after: always; }
    }
  </style></head><body><div class="sheet">`;
  const rows = invItems.map((it: Item, idx: number) => `<tr>
      <td>${idx + 1}</td>
      <td>${(it.description || '').replace(/</g,'&lt;')}</td>
      <td class="right">${it.quantity}</td>
      <td class="right">${formatRupiah(it.unit_price)}</td>
      <td class="right">${formatRupiah(it.item_discount || 0)}</td>
      <td class="right">${formatRupiah((it.quantity || 0) * (it.unit_price || 0) - (it.item_discount || 0))}</td>
    </tr>`).join('');
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.write(`
    <div class="head">
        <div class="brand"><img src="${LOGO_URL}" alt="Logo" /><div class="brand-name">${company.name}</div></div>
      <div class="meta">
        <div><strong>${company.name}</strong></div>
        <div>${company.address}</div>
        <div>${[company.phone, company.email].filter(Boolean).join(' · ')}</div>
        <div style="margin-top:3px;">No. Invoice: <strong>${inv.invoice_number}</strong></div>
        <div>Tanggal: ${formatDate(inv.issued_at)}</div>
        <div>Customer: ${inv.customer_name}</div>
      </div>
    </div>
    <table>
      <thead><tr><th>No</th><th>Deskripsi</th><th class="right">Qty</th><th class="right">Harga</th><th class="right">Diskon</th><th class="right">Subtotal</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#6b7280;">Tidak ada item</td></tr>'}</tbody>
    </table>
    <div class="totals-row">
      <div class="qr-inline" title="QR Code">
        <img src="/api/blob?endpoint=generate&code=${inv.invoice_number}&type=qr" alt="QR" />
      </div>
      <table class="totals">
      <tr>
        <td style="width:70%;"></td>
        <td class="right" style="width:15%;">Subtotal</td>
        <td class="right" style="width:15%;">${formatRupiah(subtotal)}</td>
      </tr>
      <tr>
        <td></td>
        <td class="right">PPN (${inv.tax_percent || 0}%)</td>
        <td class="right">${formatRupiah(tax)}</td>
      </tr>
      <tr>
        <td></td>
        <td class="right">Diskon</td>
        <td class="right">-${formatRupiah(inv.discount_amount || 0)}</td>
      </tr>
      <tr>
        <td></td>
        <td class="right" style="font-weight:600;">Total</td>
        <td class="right" style="font-weight:700;">${formatRupiah(grand || inv.amount)}</td>
      </tr>
      </table>
    </div>
    <div class="footer">${(inv.notes || '').replace(/</g,'&lt;') || 'Terima kasih. Pembayaran sesuai ketentuan yang berlaku.'}</div>
  </div>`);
  win.document.write('</body></html>');
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 250);
}

watch([items, taxPercent, discountAmount], () => {
  const total = calcTotal();
  if (!isNaN(total)) {
    form.value.amount = String(total);
  }
}, { deep: true });
</script>

<template>
  <div class="space-y-4 pb-20 lg:pb-0">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="text-xl font-semibold dark:text-gray-100">
          Invoice
        </div>
      <div class="flex gap-2 flex-1 lg:flex-initial min-w-0">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari nomor invoice, customer..."
          class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 dark:border-gray-600"
        >
      </div>
      <Button
        variant="primary"
        class="flex-shrink-0 text-sm px-3 lg:px-4"
        @click="openCreateModal"
      >
        <Icon
          icon="mdi:plus"
          class="text-base lg:text-lg"
        />
        <span class="hidden sm:inline">Tambah</span>
      </Button>
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
      class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden card hidden lg:block transition-all duration-200"
    >
      <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600">
              No. Invoice
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600">
              Customer
            </th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-600">
              Amount
            </th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-600">
              Dibayar
            </th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-600">
              Sisa
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600">
              Status
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600">
              Tanggal
            </th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-600">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-if="filteredInvoices.length === 0">
            <td
              colspan="8"
              class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
            >
              Belum ada invoice
            </td>
          </tr>
          <tr
            v-for="inv in filteredInvoices"
            :key="inv.id"
            class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
          >
            <td class="px-4 py-3 text-sm font-medium dark:text-gray-200">
              {{ inv.invoice_number }}
            </td>
            <td class="px-4 py-3 text-sm dark:text-gray-300">
              {{ inv.customer_name }}
            </td>
            <td class="px-4 py-3 text-sm text-right font-semibold dark:text-gray-100">
              {{ formatRupiah(inv.amount) }}
              <div v-if="inv.pph_percent && inv.pph_percent > 0" class="text-xs text-gray-500">
                PPh {{ inv.pph_percent }}%: -{{ formatRupiah(inv.pph_amount || 0) }}
              </div>
            </td>
            <td class="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">
              {{ formatRupiah(inv.paid_amount || 0) }}
            </td>
            <td class="px-4 py-3 text-sm text-right text-orange-600 dark:text-orange-400">
              {{ formatRupiah(inv.remaining_amount ?? inv.amount) }}
            </td>
            <td class="px-4 py-3">
              <Badge :variant="getPaymentStatus(inv).variant">
                {{ getPaymentStatus(inv).label }}
              </Badge>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              {{ formatDate(inv.issued_at) }}
            </td>
            <td class="px-4 py-3 text-right space-x-1">
              <button
                class="text-blue-600 hover:text-blue-700 text-xs font-medium"
                @click="openPaymentModal(inv)"
              >
                Bayar
              </button>
              <button
                class="text-purple-600 hover:text-purple-700 text-xs font-medium"
                @click="openPphModal(inv)"
              >
                PPh
              </button>
              <button
                class="text-primary hover:text-primary-dark dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium transition-colors"
                @click="openEditModal(inv)"
              >
                Edit
              </button>
              <button
                class="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 text-xs font-medium transition-colors"
                @click="printInvoice(inv)"
              >
                Print
              </button>
              <button
                class="text-red-600 hover:text-red-700 text-xs font-medium"
                @click="deleteInvoice(inv.id)"
              >
                Hapus
              </button>
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
        v-if="filteredInvoices.length === 0"
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center"
      >
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Belum ada invoice
        </p>
      </div>
      <div
        v-for="inv in filteredInvoices"
        :key="inv.id"
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3 transition-all duration-200 hover:shadow-md min-w-0"
      >
        <div class="flex items-start justify-between">
          <div>
            <div class="text-sm font-semibold dark:text-gray-100">
              {{ inv.invoice_number }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {{ inv.customer_name }}
            </div>
          </div>
          <Badge :variant="inv.status === 'paid' ? 'success' : 'warning'">
            {{ inv.status === 'paid' ? 'Paid' : 'Pending' }}
          </Badge>
        </div>
        <div class="text-sm dark:text-gray-300">
          <div class="flex items-center gap-2">
            <Icon
              icon="mdi:receipt-text-outline"
              class="text-[18px] text-gray-500 dark:text-gray-400"
            />
            <div class="flex-1 text-right font-semibold dark:text-gray-100">
              {{ formatRupiah(inv.amount) }}
            </div>
          </div>
          <div class="flex items-center gap-2 mt-1">
            <Icon
              icon="mdi:calendar-outline"
              class="text-[18px] text-gray-500 dark:text-gray-400"
            />
            <span class="text-sm">{{ formatDate(inv.issued_at) }}</span>
          </div>
        </div>
        <div class="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700 min-w-0">
          <Button
            block
            variant="primary"
            @click="openEditModal(inv)"
          >
            Edit
          </Button>
          <Button
            block
            variant="success"
            @click="printInvoice(inv)"
          >
            Print
          </Button>
          <Button
            block
            variant="default"
            class="text-red-600 hover:text-red-700 bg-red-50 dark:bg-red-900/20"
            @click="deleteInvoice(inv.id)"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>

    <div
      v-if="showModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="showModal = false"
    >
      <div class="bg-white rounded-xl p-6 w-full max-w-4xl space-y-4 card overflow-auto max-h-[85vh]">
        <div class="text-lg font-semibold">
          {{ editingId ? 'Edit Invoice' : 'Tambah Invoice' }}
        </div>
        <div class="space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div class="sm:col-span-2">
              <label class="block text-sm font-medium mb-1">Customer</label>
              <select
                v-model="form.customer_name"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                @change="onCustomerChange"
                :disabled="loadingUnpaidShipments"
              >
                <option value="">-- Pilih Customer --</option>
                <option v-for="name in uniqueCustomerNames" :key="name" :value="name">
                  {{ name }}
                </option>
              </select>
              <div v-if="loadingUnpaidShipments" class="text-xs text-gray-500 mt-1">
                🔄 Memuat SPB yang belum dibayar...
              </div>
              <div v-if="!editingId && allUnpaidShipments.length > 0" class="text-xs text-gray-500 mt-1">
                Total {{ allUnpaidShipments.length }} SPB belum dibayar.
                <span v-if="form.customer_name">Filter: {{ getFilteredUnpaidShipments().length }} SPB untuk "{{ form.customer_name }}"</span>
              </div>
            </div>
            <div class="flex flex-col gap-3">
              <div>
                <label class="block text-sm font-medium mb-1">Amount</label>
                <input
                  v-model="form.amount"
                  type="number"
                  min="0"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  readonly
                  inputmode="numeric"
                  placeholder="1000000"
                >
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Status</label>
                <select
                  v-model="form.status"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="pending">
                    Pending
                  </option>
                  <option value="paid">
                    Paid
                  </option>
                  <option value="cancelled">
                    Cancelled
                  </option>
                </select>
              </div>
            </div>
          </div>
          <div v-if="!editingId">
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium">Daftar SPB yang belum dibayar</label>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs"
                  @click="selectAllFiltered"
                  :disabled="getFilteredUnpaidShipments().length === 0"
                >
                  ✓ Pilih Semua ({{ getFilteredUnpaidShipments().length }})
                </button>
                <button
                  type="button"
                  class="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs"
                  @click="deselectAll"
                  :disabled="selectedShipmentIds.size === 0"
                >
                  ✕ Hapus Semua ({{ selectedShipmentIds.size }})
                </button>
              </div>
            </div>
            <div v-if="loadingUnpaidShipments" class="text-center py-4 text-gray-500">
              <span class="animate-pulse">🔄 Memuat SPB yang belum dibayar...</span>
            </div>
            <div v-else-if="allUnpaidShipments.length === 0" class="text-center py-4 text-gray-400">
              Tidak ada SPB yang belum dibayar
            </div>
            <div v-else-if="form.customer_name && getFilteredUnpaidShipments().length === 0" class="text-center py-4 text-gray-400">
              Tidak ada SPB belum dibayar untuk customer ini
            </div>
            <div v-else class="overflow-x-auto max-h-60 overflow-y-auto">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 sticky top-0">
                  <tr>
                    <th class="px-2 py-2 text-center text-xs font-medium w-10">✓</th>
                    <th class="px-2 py-2 text-left text-xs font-medium">No. SPB / RESI</th>
                    <th class="px-2 py-2 text-left text-xs font-medium">Customer</th>
                    <th class="px-2 py-2 text-left text-xs font-medium">Nama Barang</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">QTY</th>
                    <th class="px-2 py-2 text-left text-xs font-medium">Penerima</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">Tagihan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="it in getFilteredUnpaidShipments()"
                    :key="it.shipment_id"
                    class="border-t hover:bg-gray-50 cursor-pointer"
                    :class="{ 'bg-blue-50': selectedShipmentIds.has(it.shipment_id!) }"
                    @click="toggleShipmentSelection(it.shipment_id!)"
                  >
                    <td class="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        :checked="selectedShipmentIds.has(it.shipment_id!)"
                        @click.stop="toggleShipmentSelection(it.shipment_id!)"
                        class="h-4 w-4"
                      />
                    </td>
                    <td class="px-2 py-2">
                      <div class="text-xs font-mono">
                        <div>{{ it.spb_number || '-' }}</div>
                        <div class="text-gray-500">{{ it.tracking_code || '-' }}</div>
                      </div>
                    </td>
                    <td class="px-2 py-2">
                      <div class="text-xs">{{ it.customer_name || '-' }}</div>
                    </td>
                    <td class="px-2 py-2 text-xs">{{ it.description || '-' }}</td>
                    <td class="px-2 py-2 text-right text-xs">{{ it.quantity || 0 }}</td>
                    <td class="px-2 py-2">
                      <div class="text-xs">
                        <div>{{ it.recipient_name || '-' }}</div>
                        <div class="text-gray-500">{{ it.destination_city || '-' }}</div>
                      </div>
                    </td>
                    <td class="px-2 py-2 text-right text-xs font-semibold">
                      {{ formatRupiah(it.unit_price || 0) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div v-if="!editingId && items.length > 0">
            <label class="block text-sm font-medium mb-2">SPB Terpilih ({{ items.length }})</label>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-green-50">
                  <tr>
                    <th class="px-2 py-2 text-left text-xs font-medium">No. SPB / RESI</th>
                    <th class="px-2 py-2 text-left text-xs font-medium">Customer</th>
                    <th class="px-2 py-2 text-left text-xs font-medium">Nama Barang</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">Berat</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">QTY</th>
                    <th class="px-2 py-2 text-left text-xs font-medium">Penerima</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">Tagihan</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">PPh ({{ pphPercent }}%)</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="it in items"
                    :key="it.shipment_id"
                    class="border-t"
                  >
                    <td class="px-2 py-2">
                      <div class="text-xs font-mono">
                        <div>{{ it.spb_number || '-' }}</div>
                        <div class="text-gray-500">{{ it.tracking_code || '-' }}</div>
                      </div>
                    </td>
                    <td class="px-2 py-2 text-xs">{{ it.customer_name || '-' }}</td>
                    <td class="px-2 py-2 text-xs">{{ it.description || '-' }}</td>
                    <td class="px-2 py-2 text-right text-xs">{{ it.weight || 0 }} {{ it.unit || 'Kg' }}</td>
                    <td class="px-2 py-2 text-right text-xs">{{ it.quantity || 0 }}</td>
                    <td class="px-2 py-2">
                      <div class="text-xs">
                        <div>{{ it.recipient_name || '-' }}</div>
                        <div class="text-gray-500">{{ it.destination_city || '-' }}</div>
                      </div>
                    </td>
                    <td class="px-2 py-2 text-right text-xs font-semibold">
                      {{ formatRupiah(it.unit_price || 0) }}
                    </td>
                    <td class="px-2 py-2 text-right text-xs text-red-600">
                      -{{ formatRupiah((it.unit_price || 0) * (pphPercent / 100)) }}
                    </td>
                    <td class="px-2 py-2 text-right text-xs font-semibold">
                      {{ formatRupiah((it.unit_price || 0) * (1 - pphPercent / 100)) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div v-if="editingId">
            <label class="block text-sm font-medium mb-2">Daftar SPB</label>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-2 py-2 text-left text-xs font-medium">No. SPB / RESI</th>
                    <th class="px-2 py-2 text-left text-xs font-medium">Customer</th>
                    <th class="px-2 py-2 text-left text-xs font-medium">Nama Barang</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">Berat</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">QTY</th>
                    <th class="px-2 py-2 text-left text-xs font-medium">Penerima</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">Tagihan</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">PPh ({{ pphPercent }}%)</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="it in items"
                    :key="it.shipment_id"
                    class="border-t"
                  >
                    <td class="px-2 py-2">
                      <div class="text-xs font-mono">
                        <div>{{ it.spb_number || '-' }}</div>
                        <div class="text-gray-500">{{ it.tracking_code || '-' }}</div>
                      </div>
                    </td>
                    <td class="px-2 py-2 text-xs">{{ it.customer_name || '-' }}</td>
                    <td class="px-2 py-2 text-xs">{{ it.description || '-' }}</td>
                    <td class="px-2 py-2 text-right text-xs">{{ it.weight || 0 }} {{ it.unit || 'Kg' }}</td>
                    <td class="px-2 py-2 text-right text-xs">{{ it.quantity || 0 }}</td>
                    <td class="px-2 py-2">
                      <div class="text-xs">
                        <div>{{ it.recipient_name || '-' }}</div>
                        <div class="text-gray-500">{{ it.destination_city || '-' }}</div>
                      </div>
                    </td>
                    <td class="px-2 py-2 text-right text-xs font-semibold">
                      {{ formatRupiah(it.unit_price || 0) }}
                    </td>
                    <td class="px-2 py-2 text-right text-xs text-red-600">
                      -{{ formatRupiah((it.unit_price || 0) * (pphPercent / 100)) }}
                    </td>
                    <td class="px-2 py-2 text-right text-xs font-semibold">
                      {{ formatRupiah((it.unit_price || 0) * (1 - pphPercent / 100)) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label class="block text-sm font-medium mb-1">PPh Rate (%)</label>
              <input
                v-model.number="pphPercent"
                type="number"
                step="0.1"
                min="0"
                max="100"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Catatan</label>
              <textarea
                v-model="notes"
                rows="2"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Catatan tambahan..."
              ></textarea>
            </div>
          </div>

          <div class="bg-gray-50 p-4 rounded-lg space-y-2">
            <div class="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span class="font-semibold">{{ formatRupiah(calcSubtotal()) }}</span>
            </div>
            <div class="flex justify-between text-sm text-red-600">
              <span>PPh ({{ pphPercent }}%):</span>
              <span class="font-semibold">-{{ formatRupiah(calcSubtotal() * (pphPercent / 100)) }}</span>
            </div>
            <div class="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total Tagihan:</span>
              <span>{{ formatRupiah(calcSubtotal() * (1 - pphPercent / 100)) }}</span>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" @click="showModal = false">
              Batal
            </Button>
            <Button variant="primary" @click="saveInvoice">
              {{ editingId ? 'Update' : 'Simpan' }} Invoice
            </Button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showPaymentModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" @click.self="showPaymentModal = false">
      <div class="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold dark:text-gray-100">Pembayaran - {{ selectedInvoice?.invoice_number }}</h3>
          <div class="text-sm text-gray-500 mt-1">
            Total: {{ formatRupiah(selectedInvoice?.amount || 0) }} |
            Dibayar: {{ formatRupiah(selectedInvoice?.paid_amount || 0) }} |
            Sisa: {{ formatRupiah(selectedInvoice?.remaining_amount ?? selectedInvoice?.amount ?? 0) }}
          </div>
        </div>
        
        <div class="flex-1 overflow-auto p-4 space-y-4">
          <div v-if="loadingPayments" class="text-center py-4 text-gray-500">Loading...</div>
          
          <template v-else>
            <div>
              <h4 class="font-medium mb-2 dark:text-gray-200">Riwayat Pembayaran</h4>
              <div v-if="invoicePayments.length === 0" class="text-sm text-gray-500">Belum ada pembayaran</div>
              <div v-else class="space-y-2 max-h-32 overflow-auto">
                <div v-for="p in invoicePayments" :key="p.id" class="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded-lg text-sm">
                  <div>
                    <div class="font-medium text-green-600">{{ formatRupiah(p.amount) }}</div>
                    <div class="text-xs text-gray-500">{{ formatDate(p.payment_date) }} - {{ p.payment_method || 'N/A' }}</div>
                    <div v-if="p.reference_number" class="text-xs text-gray-400">Ref: {{ p.reference_number }}</div>
                  </div>
                  <button class="text-red-500 text-xs" @click="deletePayment(p.id)">Hapus</button>
                </div>
              </div>
            </div>
            
            <div class="border-t border-gray-200 dark:border-gray-600 pt-4">
              <h4 class="font-medium mb-2 dark:text-gray-200">Tambah Pembayaran</h4>
              <div class="space-y-3">
                <div>
                  <label class="block text-sm font-medium mb-1 dark:text-gray-300">Jumlah (Rp)</label>
                  <input v-model="paymentForm.amount" type="number" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100" placeholder="0" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-sm font-medium mb-1 dark:text-gray-300">Tanggal</label>
                    <input v-model="paymentForm.payment_date" type="date" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium mb-1 dark:text-gray-300">Metode</label>
                    <select v-model="paymentForm.payment_method" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100">
                      <option value="TRANSFER">Transfer</option>
                      <option value="CASH">Cash</option>
                      <option value="GIRO">Giro</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1 dark:text-gray-300">No. Referensi</label>
                  <input v-model="paymentForm.reference_number" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100" placeholder="No. transfer/giro" />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1 dark:text-gray-300">Catatan</label>
                  <input v-model="paymentForm.notes" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100" placeholder="Catatan pembayaran" />
                </div>
              </div>
            </div>
          </template>
        </div>
        
        <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <Button variant="default" @click="showPaymentModal = false">Tutup</Button>
          <Button variant="primary" @click="addPayment">Tambah Pembayaran</Button>
        </div>
      </div>
    </div>

    <div v-if="showPphModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" @click.self="showPphModal = false">
      <div class="bg-white dark:bg-gray-800 rounded-xl w-full max-w-sm p-6 space-y-4">
        <h3 class="text-lg font-semibold dark:text-gray-100">Update PPh</h3>
        <p class="text-sm text-gray-500">Invoice: {{ selectedInvoice?.invoice_number }}</p>
        
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-300">PPh (%) - Opsional</label>
          <input v-model="pphFormPercent" type="number" step="0.1" min="0" max="100" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100" placeholder="0" />
          <p class="text-xs text-gray-500 mt-1">PPh akan dipotong dari total invoice</p>
        </div>
        
        <div class="flex justify-end gap-2 pt-2">
          <Button variant="default" @click="showPphModal = false">Batal</Button>
          <Button variant="primary" @click="updatePph">Simpan</Button>
        </div>
      </div>
    </div>
  </div>
</template>
