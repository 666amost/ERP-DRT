<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import CustomerAutocomplete from '../components/CustomerAutocomplete.vue';
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
};

type CreateInvoiceForm = {
  customer_name: string;
  customer_id: number | null;
  amount: string;
  status: string;
};

type Item = {
  description: string;
  quantity: number;
  unit_price: number;
  tax_type?: string;
  item_discount?: number;
};

const invoices = ref<Invoice[]>([]);
const loading = ref(true);
const showModal = ref(false);
const editingId = ref<number | null>(null);
const form = ref<CreateInvoiceForm>({
  customer_name: '',
  customer_id: null,
  amount: '',
  status: 'pending'
});

const items = ref<Item[]>([]);
const taxPercent = ref<number>(0);
const discountAmount = ref<number>(0);
const notes = ref<string>('');

async function loadItemsForInvoice(id: number | null): Promise<void> {
  if (!id) {
    items.value = [];
    return;
  }
  try {
    const res = await fetch(`/api/invoices?endpoint=items&invoice_id=${id}`);
    const data = await res.json();
    items.value = (data.items || []) as Item[];
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
      items: items.value,
      tax_percent: taxPercent.value,
      discount_amount: discountAmount.value,
      notes: notes.value || undefined
    })
  });
}

function addItem(): void {
  items.value = [...items.value, { description: '', quantity: 1, unit_price: 0, tax_type: 'include', item_discount: 0 }];
}

function removeItem(index: number): void {
  items.value = items.value.filter((_, i: number) => i !== index);
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
    invoices.value = (data.items || []).map((x: any) => ({
      ...x,
      tax_percent: Number(x.tax_percent || 0),
      discount_amount: Number(x.discount_amount || 0)
    }));
  } catch (e) {
    console.error('Failed to load invoices:', e);
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  editingId.value = null;
  form.value = { customer_name: '', customer_id: null, amount: '', status: 'pending' };
  items.value = [{ description: '', quantity: 1, unit_price: 0, tax_type: 'include', item_discount: 0 }];
  taxPercent.value = 0;
  discountAmount.value = 0;
  notes.value = '';
  showModal.value = true;
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
  const amount = parseFloat(form.value.amount);
  if ((!form.value.customer_name && !form.value.customer_id) || isNaN(amount)) {
    alert('Isi semua field dengan benar');
    return;
  }

  try {
    const recomputed = calcTotal();
    if (!isNaN(recomputed) && recomputed > 0) {
      form.value.amount = String(recomputed);
    }
    if (editingId.value) {
      const res = await fetch('/api/invoices?endpoint=update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId.value,
          customer_name: form.value.customer_name,
          customer_id: form.value.customer_id || undefined,
          amount: recomputed || amount,
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
          amount: recomputed || amount,
          status: form.value.status,
          tax_percent: taxPercent.value,
          discount_amount: discountAmount.value,
          notes: notes.value || undefined
        })
      });
      if (!res.ok) throw new Error('Create failed');
      try {
        const created = await res.json();
        const newId: number | undefined = created?.id ?? created?.invoice?.id;
        if (typeof newId === 'number') {
          await saveItemsForInvoice(newId);
        }
      } catch {
      }
    }
    showModal.value = false;
    loadInvoices();
  } catch (e) {
    console.error('Save error:', e);
    alert('Gagal menyimpan invoice');
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

onMounted(() => {
  loadInvoices();
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
    body { font-family: Arial, sans-serif; padding: 32px; color: #111827; }
    .head { display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #e5e7eb; padding-bottom:16px; margin-bottom:16px; }
    .brand { display:flex; align-items:center; gap:10px; }
    .brand img { height:56px; width:56px; object-fit: contain; }
    .brand-name { font-weight:700; color:#1d4ed8; }
    .meta { text-align:right; font-size:12px; color:#374151; }
    table { width:100%; border-collapse:collapse; margin-top:16px; }
    th, td { border: 1px solid #e5e7eb; padding: 10px; font-size: 13px; }
    th { background:#f9fafb; text-align:left; }
    .right { text-align:right; }
    .totals { margin-top:10px; width:100%; }
    .totals td { border:none; }
    .footer { margin-top:24px; font-size:12px; color:#6b7280; text-align:center; }
    @media print { body { padding: 16px; } }
    /* align QR with totals: inline QR next to totals table */
    .totals-row { display:flex; justify-content:space-between; gap:20px; align-items:center; margin-top:10px; }
    .qr-inline { width:90px; height:90px; border: 1px solid #e5e7eb; padding: 6px; border-radius: 6px; background: #fff; display:flex; align-items:center; justify-content:center; }
    .qr-inline img { width: 100%; height: auto; display:block; }
  </style></head><body>`;
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
        <div style="margin-top:6px;">No. Invoice: <strong>${inv.invoice_number}</strong></div>
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
  `);
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
    <div class="flex items-center justify-between">
      <div class="text-xl font-semibold">Invoice</div>
      <Button variant="primary" @click="openCreateModal">+ Tambah Invoice</Button>
    </div>

    <div v-if="loading" class="flex items-center justify-center h-64">
      <div class="text-gray-500">Loading...</div>
    </div>

    <!-- Desktop Table View -->
    <div v-else class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden card hidden lg:block transition-all duration-200">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600">No. Invoice</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600">Customer</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-600">Amount</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600">Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600">Tanggal</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-if="invoices.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Belum ada invoice
            </td>
          </tr>
          <tr v-for="inv in invoices" :key="inv.id" class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
            <td class="px-4 py-3 text-sm font-medium dark:text-gray-200">{{ inv.invoice_number }}</td>
            <td class="px-4 py-3 text-sm dark:text-gray-300">{{ inv.customer_name }}</td>
            <td class="px-4 py-3 text-sm text-right font-semibold dark:text-gray-100">{{ formatRupiah(inv.amount) }}</td>
            <td class="px-4 py-3">
              <Badge :variant="inv.status === 'paid' ? 'success' : 'warning'">
                {{ inv.status === 'paid' ? 'Paid' : 'Pending' }}
              </Badge>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{{ formatDate(inv.issued_at) }}</td>
            <td class="px-4 py-3 text-right space-x-2">
              <button
                @click="openEditModal(inv)"
                class="text-primary hover:text-primary-dark dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium transition-colors"
              >
                Edit
              </button>
              <button
                @click="printInvoice(inv)"
                class="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 text-sm font-medium transition-colors"
              >
                Print
              </button>
              <button
                @click="deleteInvoice(inv.id)"
                class="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile Card View -->
    <div v-if="!loading" class="lg:hidden space-y-3">
      <div v-if="invoices.length === 0" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
        <p class="text-sm text-gray-500 dark:text-gray-400">Belum ada invoice</p>
      </div>
      <div v-for="inv in invoices" :key="inv.id" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3 transition-all duration-200 hover:shadow-md">
        <div class="flex items-start justify-between">
          <div>
            <div class="text-sm font-semibold dark:text-gray-100">{{ inv.invoice_number }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ inv.customer_name }}</div>
          </div>
          <Badge :variant="inv.status === 'paid' ? 'success' : 'warning'">{{ inv.status === 'paid' ? 'Paid' : 'Pending' }}</Badge>
        </div>
        <div class="text-sm dark:text-gray-300">
          <div class="flex items-center gap-2">
            <Icon icon="mdi:receipt-text-outline" class="text-[18px] text-gray-500 dark:text-gray-400" />
            <div class="flex-1 text-right font-semibold dark:text-gray-100">{{ formatRupiah(inv.amount) }}</div>
          </div>
          <div class="flex items-center gap-2 mt-1">
            <Icon icon="mdi:calendar-outline" class="text-[18px] text-gray-500 dark:text-gray-400" />
            <span class="text-sm">{{ formatDate(inv.issued_at) }}</span>
          </div>
        </div>
        <div class="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <button @click="openEditModal(inv)" class="flex-1 py-2 text-xs font-medium text-primary dark:text-blue-400 bg-primary-light dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">Edit</button>
          <button @click="printInvoice(inv)" class="flex-1 py-2 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">Print</button>
          <button @click="deleteInvoice(inv.id)" class="flex-1 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">Delete</button>
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
              <CustomerAutocomplete v-model="form.customer_name" label="Customer" @selected="(c: { id: number; name: string }) => { form.customer_id = c.id; form.customer_name = c.name; }" />
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
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Status</label>
                <select
                  v-model="form.status"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Item</label>
            <div class="space-y-2">
              <div v-for="(it, idx) in items" :key="idx" class="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input v-model="it.description" class="col-span-1 sm:col-span-4 px-3 py-2 border border-gray-300 rounded-lg" placeholder="Deskripsi" />
                <input v-model.number="it.quantity" type="number" min="0" class="col-span-1 sm:col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-right" placeholder="Qty" />
                <input v-model.number="it.unit_price" type="number" min="0" class="col-span-1 sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-right" placeholder="Harga" />
                <select v-model="it.tax_type" class="col-span-1 sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="include">PPN Incl</option>
                  <option value="exclude">PPN Excl</option>
                  <option value="exempt">Exempt</option>
                </select>
                <input v-model.number="it.item_discount" type="number" min="0" class="col-span-1 sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-right" placeholder="Diskon" />
                <button type="button" @click="removeItem(idx)" class="col-span-1 sm:col-span-1 px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">X</button>
              </div>
              <div class="flex flex-col sm:flex-row justify-between items-center text-sm gap-2">
                <button type="button" @click="addItem" class="px-3 py-2 rounded-lg bg-primary-light text-primary hover:bg-blue-100 w-full sm:w-auto">+ Tambah Item</button>
                <div class="font-semibold">Subtotal: {{ formatRupiah(calcSubtotal()) }} · Total: {{ formatRupiah(calcTotal()) }}</div>
              </div>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium mb-1">PPN (%)</label>
              <input v-model.number="taxPercent" type="number" min="0" step="0.01" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-right" placeholder="11" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Diskon</label>
              <input v-model.number="discountAmount" type="number" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-right" placeholder="0" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Catatan</label>
            <textarea v-model="notes" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Catatan tambahan ditampilkan di bagian bawah invoice"></textarea>
          </div>
          
        </div>
        <div class="flex gap-2 justify-end">
          <Button variant="default" @click="showModal = false">Batal</Button>
          <Button variant="primary" @click="saveInvoice">Simpan</Button>
        </div>
      </div>
    </div>
  </div>
</template>
