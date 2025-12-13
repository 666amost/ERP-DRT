<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from '../components/ui/Button.vue';
import Badge from '../components/ui/Badge.vue';
import { useFormatters } from '../composables/useFormatters';
import { Icon } from '@iconify/vue';
import { getCompany } from '../lib/company';
import { useAuth } from '../composables/useAuth';
const LOGO_URL = '/brand/logo.png';

const { formatRupiah, formatDate } = useFormatters();

type Invoice = {
  id: number;
  shipment_id: number | null;
  invoice_number: string;
  spb_number?: string | null;
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
  shipment_count?: number;
  sj_returned_count?: number;
  sj_pending_count?: number;
  sj_all_returned?: boolean | null;
};

type InvoicePayment = {
  id: number;
  invoice_id: number;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  reference_no: string | null;
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
  id?: number;
  shipment_id?: number | null;
  dbl_id?: number | null;
  spb_number?: string;
  tracking_code?: string;
  description: string;
  weight?: number;
  unit?: string;
  quantity: number;
  recipient_name?: string;
  destination_city?: string;
  unit_price: number;
  colli?: number | null;
  qty?: number | null;
  other_fee?: number;
  pph_rate?: number;
  tax_type?: string;
  item_discount?: number;
  _unit_price_display?: string;
  customer_name?: string;
  pengirim_name?: string | null;
  customer_id?: number | null;
  dbl_number?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  vehicle_plate?: string | null;
  dbl_date?: string | null;
  sj_returned?: boolean;
};

type LoadedInvoiceItem = {
  id?: number;
  shipment_id?: number | null;
  spb_number?: string;
  tracking_code?: string;
  unit_price?: number;
  description?: string;
  quantity?: number;
  tax_type?: string;
  item_discount?: number;
  sj_returned?: boolean;
  other_fee?: number | null;
  colli?: number | null;
  qty?: number | null;
  recipient_name?: string | null;
  penerima_name?: string | null;
  recipient?: string | null;
};

type UnpaidShipment = {
  id: number;
  spb_number: string;
  tracking_code: string;
  customer_id: number | null;
  customer_name: string | null;
  pengirim_name?: string | null;
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
  dbl_id?: number | null;
  dbl_number?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  vehicle_plate?: string | null;
  dbl_date?: string | null;
  sj_returned?: boolean;
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
  payment_date: new Date().toISOString().split('T')[0]!,
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
  status: 'paid'
});

const items = ref<Item[]>([]);
const allUnpaidShipments = ref<Item[]>([]);
const selectedShipmentIds = ref<Set<number>>(new Set());
const selectedDblNumber = ref<string>('');
const spbSearch = ref('');
const showUnreturnedOnly = ref(false);
const taxPercent = ref<number>(0);
const discountAmount = ref<number>(0);
const notes = ref<string>('');
const pphPercent = ref<number>(0);
const loadingUnpaidShipments = ref(false);
const manualAmountMode = ref(false);
const existingPaidAmount = ref<number>(0);
const editingCustomerName = ref<string>('');
const invoiceFilterType = ref<'pengirim' | 'penerima'>('penerima');

const uniqueCustomerNames = computed(() => {
  const names = new Set<string>();
  if (editingCustomerName.value) {
    names.add(editingCustomerName.value);
  }
  allUnpaidShipments.value.forEach(s => {
    if (s.customer_name && s.customer_name !== '-') {
      names.add(s.customer_name);
    }
  });
  return Array.from(names).sort();
});

const uniqueDblNumbers = computed(() => {
  const nums = new Set<string>();
  allUnpaidShipments.value.forEach(s => {
    if (s.dbl_number) {
      nums.add(s.dbl_number);
    }
  });
  return Array.from(nums).sort();
});

const hasUnassignedDbl = computed(() => allUnpaidShipments.value.some(s => !s.dbl_number));

async function loadAllUnpaidShipments(): Promise<void> {
  loadingUnpaidShipments.value = true;
  try {
    const res = await fetch(`/api/shipments?endpoint=all-unpaid&filter_type=${invoiceFilterType.value}`);
    const data = await res.json();
    
    if (data.shipments && data.shipments.length > 0) {
      allUnpaidShipments.value = data.shipments.map((s: UnpaidShipment) => ({
        shipment_id: s.id,
        dbl_id: s.dbl_id ?? null,
        spb_number: s.spb_number,
        tracking_code: s.tracking_code,
        customer_name: s.customer_name || '-',
        pengirim_name: s.pengirim_name || null,
        customer_id: s.customer_id,
        description: s.description || '-',
        weight: s.weight || 0,
        unit: s.unit || 'Kg',
        quantity: s.total_colli || 0,
        recipient_name: s.recipient_name || '-',
        destination_city: s.destination_city || '-',
        unit_price: s.amount || 0,
        other_fee: 0,
        dbl_number: s.dbl_number || null,
        driver_name: s.driver_name || null,
        driver_phone: s.driver_phone || null,
        vehicle_plate: s.vehicle_plate || null,
        dbl_date: s.dbl_date || null,
        sj_returned: Boolean(s.sj_returned),
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
  let result = allUnpaidShipments.value;
  
  if (form.value.customer_name) {
    const customerName = form.value.customer_name.toLowerCase();
    result = result.filter(s => {
      const shipmentCustomerName = (s.customer_name || '').toLowerCase();
      return shipmentCustomerName === customerName;
    });
  }
  
  if (selectedDblNumber.value === '__no_dbl') {
    result = result.filter(s => !s.dbl_number);
  } else if (selectedDblNumber.value) {
    result = result.filter(s => s.dbl_number === selectedDblNumber.value);
  }
  
  if (spbSearch.value.trim()) {
    const q = spbSearch.value.trim().toLowerCase();
    result = result.filter(s =>
      (s.spb_number || '').toLowerCase().includes(q) ||
      (s.tracking_code || '').toLowerCase().includes(q) ||
      (s.destination_city || '').toLowerCase().includes(q) ||
      (s.recipient_name || '').toLowerCase().includes(q) ||
      (s.pengirim_name || '').toLowerCase().includes(q)
    );
  }
  
  if (showUnreturnedOnly.value) {
    result = result.filter(s => !s.sj_returned);
  }
  
  return result;
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

function setShipmentReturnStatus(shipmentId: number, value: boolean): void {
  allUnpaidShipments.value = allUnpaidShipments.value.map(s => {
    if (!s.shipment_id || s.shipment_id !== shipmentId) return s;
    return { ...s, sj_returned: value };
  });
  items.value = items.value.map(it => {
    if (!it.shipment_id || it.shipment_id !== shipmentId) return it;
    return { ...it, sj_returned: value };
  });
}

function toggleSjReturned(shipmentId?: number | null): void {
  if (!shipmentId) return;
  const target = allUnpaidShipments.value.find(s => s.shipment_id === shipmentId) || items.value.find(i => i.shipment_id === shipmentId);
  const current = target?.sj_returned || false;
  setShipmentReturnStatus(shipmentId, !current);
}

function updateItemsFromSelection(): void {
  items.value = allUnpaidShipments.value.filter(s => s.shipment_id && selectedShipmentIds.value.has(s.shipment_id));
  if (!manualAmountMode.value) {
    const subtotal = items.value.reduce((sum, it) => sum + lineSubtotal(it), 0);
    form.value.amount = String(subtotal);
  }
}

function onCustomerChange(): void {
  selectedShipmentIds.value.clear();
  selectedShipmentIds.value = new Set(selectedShipmentIds.value);
  updateItemsFromSelection();
}

async function loadItemsForInvoice(id: number | null, fallbackSpb?: string | null): Promise<void> {
  if (!id) {
    items.value = [];
    return;
  }
  try {
    const res = await fetch(`/api/invoices?endpoint=items&invoice_id=${id}`);
    const data = await res.json();
    const fallbackSpbList = (fallbackSpb || '').split(',').map(s => s.trim()).filter(Boolean);
    const rawItems: LoadedInvoiceItem[] = Array.isArray(data.items) ? data.items : [];
    items.value = rawItems.map((i, idx: number) => {
      const spbFromFallback = (!i.spb_number && fallbackSpbList.length > 0) ? fallbackSpbList[Math.min(idx, fallbackSpbList.length - 1)] : i.spb_number;
      const otherFee = Number(i.other_fee || 0);
      const lineTotal = (Number(i.unit_price) || 0) + otherFee - (Number(i.item_discount) || 0);
      return {
        ...i,
        other_fee: otherFee,
        colli: i.colli ?? i.quantity ?? null,
        qty: i.qty ?? i.quantity ?? null,
        recipient_name: i.recipient_name ?? i.penerima_name ?? i.recipient ?? '',
        spb_number: spbFromFallback || i.tracking_code,
        sj_returned: Boolean(i.sj_returned),
        _unit_price_display: lineTotal ? formatRupiah(lineTotal) : ''
      };
    });
  } catch {
    items.value = [];
  }
}

async function saveItemsForInvoice(invoiceId: number, itemsToSave?: Item[]): Promise<void> {
  const saveItems = itemsToSave || items.value;
  const response = await fetch('/api/invoices?endpoint=set-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoice_id: invoiceId,
      items: saveItems.map((it) => ({ 
        id: it.id, 
        shipment_id: it.shipment_id || null, 
        spb_number: it.spb_number || null,
        description: it.description || 'Jasa pengiriman', 
        quantity: it.quantity || 1, 
        unit_price: it.unit_price || 0, 
        other_fee: it.other_fee || 0,
        tax_type: it.tax_type || 'include', 
        item_discount: it.item_discount || 0,
        sj_returned: Boolean(it.sj_returned)
      })),
      tax_percent: taxPercent.value,
      discount_amount: discountAmount.value,
      notes: notes.value || undefined
    })
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to save items');
  }
}

function calcSubtotal(): number {
  return items.value.reduce((acc: number, it: Item) => {
    return acc + lineSubtotal(it);
  }, 0);
}

function calcDiscountedSubtotal(): number {
  return Math.max(0, calcSubtotal() - (discountAmount.value || 0));
}

function lineSubtotal(it: Item): number {
  return Number(it.unit_price || 0) + Number(it.other_fee || 0) - Number(it.item_discount || 0);
}

function calcPph(): number {
  return calcDiscountedSubtotal() * (pphPercent.value / 100);
}

function calcTotal(): number {
  const subtotal = calcDiscountedSubtotal();
  const pph = calcPph();
  return Math.max(0, subtotal - pph);
}

async function loadInvoices() {
  loading.value = true;
  try {
    const res = await fetch('/api/invoices?endpoint=list&limit=500');
    const data = await res.json();
    invoices.value = (data.items || []).map((x: Partial<Invoice>) => ({
      ...x,
      tax_percent: Number(x.tax_percent || 0),
      discount_amount: Number(x.discount_amount || 0),
      sj_all_returned: x.sj_all_returned ?? null,
      sj_pending_count: Number(x.sj_pending_count || 0),
      sj_returned_count: Number(x.sj_returned_count || 0),
      shipment_count: Number(x.shipment_count || 0)
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
      String(i.customer_name || '').toLowerCase().includes(q) ||
      String(i.spb_number || '').toLowerCase().includes(q) ||
      String(i.status || '').toLowerCase().includes(q) ||
      String(i.notes || '').toLowerCase().includes(q)
    );
  }
}

function openCreateModal(): void {
  editingId.value = null;
  form.value = { customer_name: '', customer_id: null, amount: '', status: 'paid' };
  items.value = [];
  allUnpaidShipments.value = [];
  selectedShipmentIds.value = new Set();
  selectedDblNumber.value = '';
  taxPercent.value = 0;
  discountAmount.value = 0;
  notes.value = '';
  pphPercent.value = 0;
  manualAmountMode.value = false;
  existingPaidAmount.value = 0;
  editingCustomerName.value = '';
  spbSearch.value = '';
  showUnreturnedOnly.value = false;
  invoiceFilterType.value = 'penerima';
  showModal.value = true;
  loadAllUnpaidShipments();
}

async function openEditModal(invoice: Invoice) {
  editingId.value = invoice.id;
  manualAmountMode.value = true;
  existingPaidAmount.value = invoice.paid_amount || 0;
  editingCustomerName.value = invoice.customer_name || '';
  spbSearch.value = '';
  showUnreturnedOnly.value = false;
  form.value = {
    customer_name: invoice.customer_name,
    customer_id: invoice.customer_id,
    amount: String(invoice.paid_amount || 0),
    status: invoice.status
  };
  taxPercent.value = invoice.tax_percent || 0;
  discountAmount.value = invoice.discount_amount || 0;
  pphPercent.value = invoice.pph_percent || 0;
  notes.value = invoice.notes || '';
  await loadItemsForInvoice(invoice.id, invoice.spb_number || '');
  if (items.value.length === 0) {
    items.value = [{ 
      description: 'Jasa pengiriman', 
      quantity: 1, 
      unit_price: invoice.subtotal || invoice.amount, 
      other_fee: 0,
      tax_type: 'include', 
      item_discount: 0,
      spb_number: invoice.spb_number || '',
      customer_name: invoice.customer_name,
      sj_returned: Boolean(invoice.sj_all_returned)
    }];
  }
  showModal.value = true;
}

async function saveInvoice(mode: 'single' | 'bulk' = 'single') {
  const inputAmount = parseFloat(form.value.amount) || 0;
  if (!form.value.customer_name && !form.value.customer_id) {
    const firstItem = items.value[0];
    if (items.value.length > 0 && firstItem?.customer_name) {
      form.value.customer_name = firstItem.customer_name;
    } else {
      alert('Pilih customer terlebih dahulu');
      return;
    }
  }

  if (items.value.length === 0) {
    alert('Pilih minimal satu SPB sebelum menyimpan invoice');
    return;
  }

  const subtotal = calcSubtotal();
  const subtotalAfterDiscount = calcDiscountedSubtotal();
  const pphAmount = subtotalAfterDiscount * (pphPercent.value / 100);
  const totalTagihan = Math.max(0, subtotalAfterDiscount - pphAmount);

  if (totalTagihan <= 0) {
    alert('Total tagihan harus lebih dari 0');
    return;
  }
  
  const itemsSnapshot = items.value.map(it => ({ ...it }));
  const resolvedCustomerName = form.value.customer_name || itemsSnapshot.find((it) => it.customer_name)?.customer_name || '';
  const resolvedCustomerId = form.value.customer_id ?? itemsSnapshot.find((it) => typeof it.customer_id === 'number')?.customer_id ?? null;

  if (mode === 'bulk') {
    const customerIds = new Set<number>();
    if (typeof resolvedCustomerId === 'number') customerIds.add(resolvedCustomerId);
    itemsSnapshot.forEach((it) => {
      if (typeof it.customer_id === 'number') customerIds.add(it.customer_id);
    });
    const customerNames = new Set<string>();
    if (resolvedCustomerName) customerNames.add(resolvedCustomerName.toLowerCase());
    itemsSnapshot.forEach((it) => {
      if (it.customer_name) customerNames.add(it.customer_name.toLowerCase());
    });
    if (customerIds.size > 1 || customerNames.size > 1) {
      alert('Bulk invoice hanya untuk SPB dengan penagih/customer yang sama');
      return;
    }
  }

  try {
    if (editingId.value) {
      const newRemaining = Math.max(0, totalTagihan - existingPaidAmount.value);
      let newStatus = 'pending';
      if (existingPaidAmount.value >= totalTagihan) {
        newStatus = 'paid';
      } else if (existingPaidAmount.value > 0) {
        newStatus = 'partial';
      }
      
      const allSpbNumbers = itemsSnapshot
        .map(it => it.spb_number || it.tracking_code)
        .filter(Boolean)
        .join(', ');
      
      const res = await fetch('/api/invoices?endpoint=update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId.value,
          spb_number: allSpbNumbers || undefined,
          customer_name: form.value.customer_name,
          customer_id: form.value.customer_id || undefined,
          amount: totalTagihan,
          subtotal: subtotal,
          pph_percent: pphPercent.value,
          pph_amount: pphAmount,
          remaining_amount: newRemaining,
          status: newStatus,
          discount_amount: discountAmount.value || 0,
          tax_percent: taxPercent.value || 0,
          notes: notes.value || undefined
        })
      });
      if (!res.ok) throw new Error('Update failed');
      await saveItemsForInvoice(editingId.value, itemsSnapshot);
    } else if (mode === 'bulk') {
      let paidAmount = 0;
      let remainingAmount = totalTagihan;
      let finalStatus = form.value.status || 'pending';
      
      if (manualAmountMode.value && inputAmount > 0) {
        paidAmount = inputAmount;
        remainingAmount = Math.max(0, totalTagihan - paidAmount);
      } else if (form.value.status === 'paid') {
        paidAmount = totalTagihan;
        remainingAmount = 0;
      }

      if (remainingAmount <= 0 && paidAmount > 0) {
        finalStatus = 'paid';
      } else if (paidAmount > 0) {
        finalStatus = 'partial';
      }

      const spbSet = new Map<string, string>();
      itemsSnapshot
        .map((it) => it.spb_number || it.tracking_code || '')
        .map((spb) => spb.trim())
        .filter(Boolean)
        .forEach((spb) => {
          const key = spb.toLowerCase();
          if (!spbSet.has(key)) spbSet.set(key, spb);
        });
      const combinedSpb = Array.from(spbSet.values()).join(', ');

      const res = await fetch('/api/invoices?endpoint=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipment_id: itemsSnapshot[0]?.shipment_id || null,
          spb_number: combinedSpb || undefined,
          customer_name: resolvedCustomerName,
          customer_id: resolvedCustomerId ?? undefined,
          amount: totalTagihan,
          subtotal: subtotal,
          pph_percent: pphPercent.value,
          pph_amount: pphAmount,
          paid_amount: paidAmount,
          remaining_amount: remainingAmount,
          status: finalStatus,
          discount_amount: discountAmount.value || 0,
          tax_percent: taxPercent.value || 0,
          notes: notes.value || undefined,
          items: itemsSnapshot.map((item) => ({
            shipment_id: item.shipment_id || null,
            spb_number: item.spb_number || null,
            description: item.description || 'Jasa pengiriman',
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
            other_fee: item.other_fee || 0,
            tax_type: item.tax_type || 'include',
            item_discount: item.item_discount || 0,
            sj_returned: Boolean(item.sj_returned),
            customer_name: item.customer_name || resolvedCustomerName || undefined,
            customer_id: item.customer_id ?? resolvedCustomerId ?? undefined
          }))
        })
      });

      const created: { invoice_number?: string; error?: string } = await res.json();
      if (!res.ok) {
        throw new Error(created.error || 'Create failed');
      }

      alert(created.invoice_number ? `Invoice ${created.invoice_number} berhasil dibuat` : 'Berhasil membuat invoice bulk');
    } else {
      const createdInvoices: string[] = [];
      const failedInvoices: { spb: string; error: string }[] = [];

      for (const item of itemsSnapshot) {
        try {
          const customerName = item.customer_name || form.value.customer_name;
          const customerId = item.customer_id ?? form.value.customer_id ?? null;
          const itemSubtotal = (item.unit_price || 0) + (item.other_fee || 0);
          const itemDiscountAmount = item.item_discount || 0;
          const itemSubtotalAfterDiscount = itemSubtotal - itemDiscountAmount;
          const itemPphAmount = itemSubtotalAfterDiscount * (pphPercent.value / 100);
          const itemTotalTagihan = Math.max(0, itemSubtotalAfterDiscount - itemPphAmount);

          let paidAmount = 0;
          let remainingAmount = itemTotalTagihan;
          let finalStatus = form.value.status || 'pending';
          
          if (manualAmountMode.value && inputAmount > 0) {
            paidAmount = inputAmount;
            remainingAmount = Math.max(0, itemTotalTagihan - paidAmount);
            if (remainingAmount <= 0) {
              finalStatus = 'paid';
            } else if (paidAmount > 0) {
              finalStatus = 'partial';
            }
          } else if (form.value.status === 'paid') {
            paidAmount = itemTotalTagihan;
            remainingAmount = 0;
          }

          const res = await fetch('/api/invoices?endpoint=create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shipment_id: item.shipment_id || null,
              spb_number: item.spb_number || null,
              customer_name: customerName,
              customer_id: customerId ?? undefined,
              amount: itemTotalTagihan,
              subtotal: itemSubtotal,
              pph_percent: pphPercent.value,
              pph_amount: itemPphAmount,
              paid_amount: paidAmount,
              remaining_amount: remainingAmount,
              status: finalStatus,
              discount_amount: itemDiscountAmount || 0,
              tax_percent: taxPercent.value || 0,
              notes: notes.value || undefined,
              items: [{
                shipment_id: item.shipment_id || null,
              spb_number: item.spb_number || null,
              description: item.description || 'Jasa pengiriman',
              quantity: item.quantity || 1,
              unit_price: item.unit_price || 0,
              other_fee: item.other_fee || 0,
              tax_type: item.tax_type || 'include',
              item_discount: item.item_discount || 0,
              sj_returned: Boolean(item.sj_returned),
              customer_name: customerName || undefined,
              customer_id: customerId ?? undefined
              }]
            })
          });
          
          const created = await res.json();
          if (!res.ok) {
            throw new Error(created.error || 'Create failed');
          }
          
          createdInvoices.push(item.spb_number || item.tracking_code || 'N/A');
        } catch (error) {
          failedInvoices.push({
            spb: item.spb_number || item.tracking_code || 'N/A',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      if (createdInvoices.length > 0) {
        alert(`Berhasil membuat ${createdInvoices.length} invoice dari ${itemsSnapshot.length} SPB`);
      }
      
      if (failedInvoices.length > 0) {
        console.error('Failed invoices:', failedInvoices);
        alert(`${failedInvoices.length} invoice gagal dibuat. Silakan cek console untuk detail.`);
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
    payment_date: new Date().toISOString().split('T')[0]!,
    payment_method: 'TRANSFER',
    reference_number: '',
    notes: ''
  };
  
  try {
    const res = await fetch(`/api/invoices?endpoint=payments&invoice_id=${inv.id}`);
    if (res.ok) {
      const data = await res.json();
      invoicePayments.value = data.items || [];
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
  
  const remainingAmount = selectedInvoice.value.remaining_amount ?? selectedInvoice.value.amount ?? 0;
  const isFullPayment = amount >= remainingAmount;
  
  if (isFullPayment) {
    const confirmMsg = `Pembayaran sebesar ${formatRupiah(amount)} akan melunasi invoice ini.\n\nLanjutkan pelunasan?`;
    if (!confirm(confirmMsg)) return;
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
        reference_no: paymentForm.value.reference_number || null,
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

function getSjStatus(inv: Invoice): { label: string; variant: 'default' | 'warning' | 'success' } {
  if (inv.sj_all_returned === null || inv.sj_all_returned === undefined) {
    return { label: '-', variant: 'default' };
  }
  if (inv.shipment_count === 0) {
    return { label: '-', variant: 'default' };
  }
  if (inv.sj_all_returned) {
    return { label: 'SJ Balik', variant: 'success' };
  }
  return { label: 'SJ Belum', variant: 'warning' };
}

onMounted(async () => {
  const { fetchUser } = useAuth();
  await fetchUser();
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
    const newQuery = { ...route.query };
    delete newQuery['create'];
    router.replace({ name: 'invoice', query: newQuery });
  }
});

async function printInvoice(inv: Invoice): Promise<void> {
  let invItems: Item[] = [];
  try {
    const res = await fetch(`/api/invoices?endpoint=items&invoice_id=${inv.id}`);
    const data = await res.json();
    invItems = (data.items || []) as Item[];
  } catch (e) {
    console.warn('Failed to load items:', e);
    invItems = items.value && items.value.length ? items.value : [];
  }
  if (!invItems || invItems.length === 0) {
    invItems = [{ 
      description: 'Jasa pengiriman', 
      quantity: 1, 
      unit_price: inv.amount, 
      other_fee: 0,
      tax_type: 'include', 
      item_discount: 0,
      spb_number: inv.spb_number || ''
    }];
  }
  
  const subtotal = invItems.reduce((acc: number, it: Item) => {
    return acc + lineSubtotal(it);
  }, 0);
  const pphAmount = (inv.pph_percent || 0) * subtotal / 100;
  const grand = subtotal - pphAmount;
  const company = await getCompany();
  
  const rows = invItems.map((it: Item) => {
    const spbDisplay = it.spb_number || inv.spb_number || '';
    const trackingDisplay = it.tracking_code || '';
    const displaySpb = spbDisplay || trackingDisplay || '-';
    const baseLine = lineSubtotal(it);
    const baseTagihan = Number(it.unit_price || 0);
    const otherFee = Number(it.other_fee || 0);
    const itemPph = (inv.pph_percent || 0) * baseLine / 100;
    const itemTotal = baseLine - itemPph;
    const colliLabel = it.colli ?? it.quantity ?? 0;
    const qtyLabel = (() => {
      if (it.weight !== undefined && it.weight !== null && !Number.isNaN(it.weight)) {
        return `${it.weight} ${it.unit || ''}`.trim();
      }
      return `${it.quantity || 0}${it.unit ? ' ' + it.unit : ''}`;
    })();
    const penerimaLabel = it.recipient_name || '-';
    return `<tr>
      <td style="padding: 4px 3px; border: 1px solid #000; text-align: center; font-size: 10px; width: 12%;">${displaySpb.replace(/</g,'&lt;')}</td>
    <td style="padding: 4px 3px; border: 1px solid #000; font-size: 9px; width: 18%; line-height: 1.2;">
        <div>${(it.description || '').replace(/</g,'&lt;')}</div>
        <div style="color:#444;">Penerima: ${(penerimaLabel || '-').replace(/</g,'&lt;')}</div>
      </td>
      <td style="padding: 4px 3px; border: 1px solid #000; text-align: center; font-size: 10px; width: 8%;">${colliLabel}</td>
      <td style="padding: 4px 3px; border: 1px solid #000; text-align: center; font-size: 10px; width: 8%;">${qtyLabel}</td>
      <td style="padding: 4px 3px; border: 1px solid #000; text-align: right; font-size: 10px; width: 12%;">${formatRupiah(baseTagihan)}</td>
      <td style="padding: 4px 3px; border: 1px solid #000; text-align: right; font-size: 10px; width: 12%;">${formatRupiah(otherFee)}</td>
      <td style="padding: 4px 3px; border: 1px solid #000; text-align: right; font-size: 10px; width: 12%;">${formatRupiah(itemPph)}</td>
      <td style="padding: 4px 3px; border: 1px solid #000; text-align: right; font-size: 10px; font-weight: 600; width: 13%;">${formatRupiah(itemTotal)}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${inv.invoice_number}</title>
  <style>
    @page { 
      size: A4; 
      margin: 0;
    }
    * { 
      box-sizing: border-box; 
      margin: 0; 
      padding: 0; 
    }
    html, body { 
      font-family: Arial, sans-serif; 
      font-size: 11px; 
      color: #000; 
      line-height: 1.3;
    }
    body { 
      padding: 0;
    }
    .container {
      width: 210mm;
      height: 297mm;
      margin: 0 auto;
      padding: 12mm;
      background: white;
      page-break-after: always;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
    }
    .company-info {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      flex: 1;
    }
    .company-logo {
      width: 35px;
      height: 35px;
      flex-shrink: 0;
    }
    .company-logo img {
      width: 100%;
      height: auto;
    }
    .company-details {
      font-size: 10px;
    }
    .company-name {
      font-size: 12px;
      font-weight: bold;
    }
    .company-address {
      font-size: 9px;
      color: #333;
      margin-top: 1px;
    }
    .company-contact {
      font-size: 9px;
      color: #333;
    }
    .invoice-meta {
      text-align: right;
      min-width: 180px;
    }
    .invoice-title {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 6px;
    }
    .invoice-meta-row {
      font-size: 10px;
      margin-bottom: 2px;
      display: flex;
      justify-content: space-between;
      gap: 10px;
    }
    .invoice-meta-label {
      font-weight: bold;
    }
    .content {
      margin: 8px 0;
    }
    .bill-to {
      margin-bottom: 10px;
    }
    .bill-to-label {
      font-weight: bold;
      font-size: 10px;
      margin-bottom: 2px;
    }
    .bill-to-content {
      font-size: 10px;
      padding: 6px;
      background: #f8f8f8;
      border: 1px solid #999;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
      font-size: 10px;
    }
    .items-table th {
      background: #fff;
      border: 1px solid #000;
      padding: 4px 3px;
      text-align: left;
      font-weight: bold;
      font-size: 9px;
    }
    .items-table td {
      padding: 3px;
      border: 1px solid #000;
    }
    .totals-section {
      margin-top: 8px;
      margin-left: auto;
      width: 50%;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 6px;
      font-size: 10px;
      border-bottom: 1px solid #ddd;
    }
    .totals-row.total {
      font-weight: bold;
      font-size: 11px;
      border-bottom: 2px solid #000;
      border-top: 2px solid #000;
      padding: 4px 6px;
    }
    .bank-section {
      margin: 10px 0;
      padding: 8px;
      border: 1px solid #999;
      background: #f8f8f8;
      font-size: 9px;
    }
    .bank-title {
      font-weight: bold;
      margin-bottom: 4px;
      font-size: 10px;
    }
    .bank-row {
      margin: 2px 0;
      font-size: 9px;
    }
    .bank-row strong {
      display: inline-block;
      width: 100px;
    }
    .notes-section {
      margin: 8px 0;
      padding: 6px;
      background: #fffacd;
      border: 1px solid #daa520;
      font-size: 9px;
      line-height: 1.3;
      min-height: 25px;
    }
    .footer {
      margin-top: 15px;
      display: flex;
      justify-content: space-between;
      gap: 15px;
    }
    .signature-block {
      flex: 1;
      text-align: center;
      font-size: 9px;
    }
    .signature-line {
      margin-top: 35px;
      border-top: 1px solid #000;
      min-height: 50px;
    }
    .no-items {
      text-align: center;
      padding: 20px;
      color: #999;
      font-style: italic;
    }
    .lunas-stamp {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-15deg);
      font-size: 48px;
      font-weight: 900;
      color: rgba(34, 197, 94, 0.2);
      border: 4px solid rgba(34, 197, 94, 0.2);
      padding: 8px 24px;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: 3px;
      pointer-events: none;
    }
    @media print {
      html, body { 
        width: 100%;
        height: auto;
        margin: 0;
        padding: 0;
      }
      .container {
        width: 100%;
        height: auto;
        margin: 0;
        padding: 12mm;
        page-break-inside: avoid;
      }
    }
    @media print and (min-resolution: 72dpi) and (max-resolution: 150dpi) {
      body {
        font-family: 'Courier New', Courier, monospace;
        font-size: 12px;
      }
      .items-table th,
      .items-table td {
        border: 2px solid #000;
        padding: 6px 4px;
        font-size: 11px;
      }
      .company-name {
        font-size: 14px;
        font-weight: bold;
      }
      .company-address,
      .company-contact {
        font-size: 10px;
        color: #000;
      }
      .invoice-title {
        font-size: 18px;
      }
      .invoice-meta-row {
        font-size: 11px;
      }
      .bill-to-label,
      .bank-title {
        font-size: 11px;
        font-weight: bold;
      }
      .bill-to-content,
      .bank-row {
        font-size: 10px;
        color: #000;
      }
      .totals-row {
        font-size: 11px;
        border-color: #000;
      }
      .totals-row.total {
        font-size: 13px;
        border-width: 2px;
      }
      .notes-section {
        font-size: 10px;
        color: #000;
        background: #fff;
        border: 2px solid #000;
      }
      .signature-block {
        font-size: 11px;
      }
      .signature-line {
        border-top: 2px solid #000;
      }
      .bank-section,
      .bill-to-content {
        background: #fff;
        border: 2px solid #000;
      }
      .lunas-stamp {
        color: rgba(0, 0, 0, 0.2);
        border-color: rgba(0, 0, 0, 0.2);
        border-width: 6px;
      }
    }
  </style>
</head>
<body>
  <div class="container" style="position: relative;">
    ${(inv.status === 'paid' || (inv.remaining_amount !== undefined && inv.remaining_amount <= 0)) ? '<div class="lunas-stamp">LUNAS</div>' : ''}
    <div class="header">
      <div class="company-info">
        <div class="company-logo">
          <img src="${LOGO_URL}" alt="${company.name}" />
        </div>
        <div class="company-details">
          <div class="company-name">${company.name}</div>
          <div class="company-address">${company.address || ''}</div>
          <div class="company-contact">${[company.phone, company.email].filter(Boolean).join(' | ')}</div>
        </div>
      </div>
      <div class="invoice-meta">
        <div class="invoice-title">INVOICE</div>
        <div class="invoice-meta-row">
          <div class="invoice-meta-label">No. Invoice</div>
          <div>${inv.invoice_number}</div>
        </div>
        <div class="invoice-meta-row">
          <div class="invoice-meta-label">Tanggal</div>
          <div>${formatDate(inv.issued_at)}</div>
        </div>
        <div class="invoice-meta-row">
          <div class="invoice-meta-label">Status</div>
          <div>${inv.status.toUpperCase()}</div>
        </div>
      </div>
    </div>

    <div class="content">
      <div class="bill-to">
        <div class="bill-to-label">TAGIHAN KEPADA:</div>
        <div class="bill-to-content">
          <strong>${inv.customer_name}</strong><br>
          Tgl: ${formatDate(inv.issued_at)}
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 12%;">No. SPB</th>
            <th style="width: 18%;">Deskripsi / Penerima</th>
            <th style="width: 8%;">Colli</th>
            <th style="width: 8%;">Qty / Unit</th>
            <th style="width: 12%;">Tagihan</th>
            <th style="width: 12%;">Biaya Lain</th>
            <th style="width: 12%;">PPh</th>
            <th style="width: 13%;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="totals-section">
        <div class="totals-row">
          <div>Subtotal</div>
          <div>${formatRupiah(subtotal)}</div>
        </div>
        ${inv.pph_percent ? `<div class="totals-row">
          <div>PPh (${inv.pph_percent}%)</div>
          <div>-${formatRupiah(pphAmount)}</div>
        </div>` : ''}
        <div class="totals-row total">
          <div>TOTAL</div>
          <div>${formatRupiah(grand || inv.amount)}</div>
        </div>
      </div>
    </div>

    <div class="bank-section">
      <div class="bank-title">INFORMASI PEMBAYARAN</div>
      <div class="bank-row"><strong>Metode:</strong> Transfer Bank / Tunai</div>
      ${company.bank_name ? `<div class="bank-row"><strong>Bank:</strong> ${company.bank_name.toUpperCase()}</div>
      <div class="bank-row"><strong>No. Rek:</strong> ${company.bank_account || ''}</div>
      <div class="bank-row"><strong>A/N:</strong> ${company.account_holder || ''}</div>` : ''}
    </div>

    ${inv.notes ? `<div class="notes-section"><strong>Catatan:</strong> ${(inv.notes || '').replace(/</g,'&lt;')}</div>` : ''}

    <div class="footer">
      <div class="signature-block">
        <div>Disetujui oleh</div>
        <div class="signature-line"></div>
      </div>
      <div class="signature-block">
        <div>Diterima oleh</div>
        <div class="signature-line"></div>
      </div>
    </div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 250);
}

async function printInvoiceReceipt(inv: Invoice): Promise<void> {
  const amountDisplay = formatRupiah(inv.amount || 0);
  const html = `<!DOCTYPE html><html><head><title>Tanda Terima ${inv.invoice_number}</title><style>
    @page { size: 9.5in 5.5in; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; font-family: 'Courier New', Courier, monospace; font-size: 9px; color: #000; }
    body { margin: 0; padding: 4px; }
    .sheet { width: 9.5in; height: 5.5in; padding: 6px; }
    .two-up { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .copy { border: 1px solid #000; padding: 6px; height: 100%; font-size: 9px; }
    .head { margin-bottom: 6px; }
    .meta { font-size: 9px; }
    .label { font-weight: 700; }
    .signature { margin-top: 12px; }
    @media print { .sheet { padding: 4mm 6mm; page-break-after: always; } }
  </style></head><body><div class="sheet"><div class="two-up">
    <div class="copy">
      <div class="head"><div class="label">TANDA TERIMA</div><div>No: ${inv.invoice_number}</div></div>
      <div class="meta">Diterima dari: <strong>${inv.customer_name}</strong></div>
      <div class="meta">Jumlah: <strong>${amountDisplay}</strong></div>
      <div class="meta">Untuk Pembayaran: <strong>${inv.invoice_number}</strong></div>
      <div class="meta">Tanggal: ${formatDate(inv.issued_at)}</div>
      <div class="signature">Penerima, <br/><br/><br/> (______________________)</div>
    </div>
    <div class="copy">
      <div class="head"><div class="label">TANDA TERIMA</div><div>No: ${inv.invoice_number}</div></div>
      <div class="meta">Diterima dari: <strong>${inv.customer_name}</strong></div>
      <div class="meta">Jumlah: <strong>${amountDisplay}</strong></div>
      <div class="meta">Untuk Pembayaran: <strong>${inv.invoice_number}</strong></div>
      <div class="meta">Tanggal: ${formatDate(inv.issued_at)}</div>
      <div class="signature">Penerima, <br/><br/><br/> (______________________)</div>
    </div>
  </div></div></body></html>`;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 250);
}

watch([items, pphPercent, discountAmount], () => {
  if (!manualAmountMode.value) {
    const total = calcTotal();
    if (!isNaN(total)) {
      form.value.amount = String(total);
    }
  }
}, { deep: true, immediate: false });

watch(() => invoiceFilterType.value, () => {
  selectedShipmentIds.value.clear();
  items.value = [];
  form.value.customer_name = '';
  form.value.customer_id = null;
  selectedDblNumber.value = '';
  spbSearch.value = '';
  showUnreturnedOnly.value = false;
});
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
              No. SPB
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
              SJ Balik
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
              colspan="10"
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
              {{ inv.spb_number || '-' }}
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
            <td class="px-4 py-3">
              <Badge :variant="getSjStatus(inv).variant">
                {{ getSjStatus(inv).label }}
              </Badge>
              <div v-if="inv.sj_pending_count && inv.sj_pending_count > 0" class="text-[11px] text-gray-500">
                {{ inv.sj_pending_count }} belum balik
              </div>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              {{ formatDate(inv.issued_at) }}
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-1 flex-wrap">
                <button
                  v-if="(inv.remaining_amount ?? inv.amount) > 0"
                  class="px-2 py-1 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded transition-colors"
                  @click="openPaymentModal(inv)"
                >
                  Bayar
                </button>
                <button
                  class="px-2 py-1 text-xs font-medium text-white bg-purple-500 hover:bg-purple-600 rounded transition-colors"
                  @click="openPphModal(inv)"
                >
                  PPh
                </button>
                <button
                  class="px-2 py-1 text-xs font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded transition-colors"
                  @click="openEditModal(inv)"
                >
                  Edit
                </button>
                <button
                  class="px-2 py-1 text-xs font-medium text-white bg-green-500 hover:bg-green-600 rounded transition-colors"
                  @click="printInvoice(inv)"
                >
                  Print
                </button>
                <button
                  class="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 rounded transition-colors"
                  @click="printInvoiceReceipt(inv)"
                >
                  T. Terima
                </button>
                <button
                  class="px-2 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
                  @click="deleteInvoice(inv.id)"
                >
                  Hapus
                </button>
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
          <div class="flex flex-col items-end gap-1">
            <Badge :variant="getPaymentStatus(inv).variant">
              {{ getPaymentStatus(inv).label }}
            </Badge>
            <Badge :variant="getSjStatus(inv).variant">
              {{ getSjStatus(inv).label }}
            </Badge>
            <div v-if="inv.sj_pending_count && inv.sj_pending_count > 0" class="text-[11px] text-orange-600">
              {{ inv.sj_pending_count }} SJ belum balik
            </div>
          </div>
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
            class="text-gray-700"
            @click="printInvoiceReceipt(inv)"
          >
            T. Terima
          </Button>
          <Button
            v-if="inv.status !== 'paid'"
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
          <div v-if="!editingId" class="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
            <label class="block text-sm font-semibold mb-3 text-gray-700 dark:text-gray-200">Tagihan untuk:</label>
            <div class="flex gap-3">
              <button
                type="button"
                @click="() => { invoiceFilterType = 'penerima'; loadAllUnpaidShipments(); }"
                :class="[
                  'flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200',
                  invoiceFilterType === 'penerima'
                    ? 'bg-blue-600 text-white shadow-md transform scale-105'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600'
                ]"
              >
                <Icon icon="mdi:package-variant-closed" class="inline-block mr-2 text-lg" />
                Penerima (Customer)
              </button>
              <button
                type="button"
                @click="() => { invoiceFilterType = 'pengirim'; loadAllUnpaidShipments(); }"
                :class="[
                  'flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200',
                  invoiceFilterType === 'pengirim'
                    ? 'bg-green-600 text-white shadow-md transform scale-105'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600'
                ]"
              >
                <Icon icon="mdi:truck-delivery" class="inline-block mr-2 text-lg" />
                Pengirim
              </button>
            </div>
            <div class="mt-2 text-xs text-gray-600 dark:text-gray-400">
              <span v-if="invoiceFilterType === 'penerima'">Menampilkan tagihan untuk penerima barang (customer biasa)</span>
              <span v-else>Menampilkan tagihan untuk pengirim barang</span>
            </div>
          </div>
          
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div class="sm:col-span-2 space-y-2">
              <div>
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
              </div>
              <div v-if="!editingId">
                <label class="block text-sm font-medium mb-1">Filter DBL (opsional)</label>
                <select
                  v-model="selectedDblNumber"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  @change="onCustomerChange"
                  :disabled="loadingUnpaidShipments"
                >
                  <option value="">Semua DBL</option>
                  <option v-if="hasUnassignedDbl" value="__no_dbl">Belum ada DBL</option>
                  <option v-for="dbl in uniqueDblNumbers" :key="dbl" :value="dbl">
                    {{ dbl.startsWith('DBL') ? dbl : `DBL ${dbl}` }}
                  </option>
                </select>
              </div>
              <div v-if="loadingUnpaidShipments" class="text-xs text-gray-500 mt-1">
                Memuat SPB yang belum dibayar...
              </div>
            </div>
            <div class="flex flex-col gap-3">
              <div v-if="!editingId">
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-sm font-medium">Dibayar (Rp)</label>
                  <label class="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                    <input type="checkbox" v-model="manualAmountMode" class="h-3 w-3" />
                    Cicilan
                  </label>
                </div>
                <input
                  v-model="form.amount"
                  type="number"
                  min="0"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  :class="{ 'bg-gray-50': !manualAmountMode, 'bg-white': manualAmountMode }"
                  inputmode="numeric"
                  placeholder="0 (kosongkan jika belum bayar)"
                  @input="manualAmountMode = true"
                >
                <div class="text-xs text-gray-500 mt-1">Isi jika ada pembayaran awal</div>
              </div>
              <div v-else class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <div class="text-xs text-gray-600 dark:text-gray-400">Info Pembayaran (gunakan tombol Bayar)</div>
                <div class="text-sm font-medium text-green-600">Dibayar: {{ formatRupiah(existingPaidAmount) }}</div>
                <div class="text-sm font-medium text-orange-600">Sisa: {{ formatRupiah(Math.max(0, calcTotal() - existingPaidAmount)) }}</div>
              </div>
              <div v-if="!editingId">
                <label class="block text-sm font-medium mb-1">Status</label>
                <select
                  v-model="form.status"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="partial">
                    Cicilan
                  </option>
                  <option value="paid">
                    Paid
                  </option>
                </select>
              </div>
            </div>
          </div>
          <div v-if="!editingId">
            <div class="flex flex-wrap items-start justify-between gap-3 mb-2">
              <div class="space-y-1">
                <label class="block text-sm font-medium">Daftar SPB yang belum dibayar</label>
                <div v-if="!editingId && allUnpaidShipments.length > 0" class="text-xs text-gray-500 mt-1 space-x-1">
                  <span>Total {{ allUnpaidShipments.length }} SPB belum dibayar.</span>
                  <span v-if="form.customer_name">Filter: {{ getFilteredUnpaidShipments().length }} SPB untuk "{{ form.customer_name }}"</span>
                <span v-if="selectedDblNumber">
                  | DBL: {{ selectedDblNumber === '__no_dbl' ? 'Belum ada DBL' : (selectedDblNumber.startsWith('DBL') ? selectedDblNumber : `DBL ${selectedDblNumber}`) }}
                </span>
                </div>
              </div>
              <div class="flex items-center gap-2 w-full sm:w-auto">
                <input
                  v-model="spbSearch"
                  type="text"
                  class="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Cari: SPB, AWB, Kota, Penerima, Pengirim"
                  :disabled="loadingUnpaidShipments"
                >
              </div>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div class="flex items-center gap-3 text-xs text-gray-600">
                <label class="flex items-center gap-2">
                  <input type="checkbox" v-model="showUnreturnedOnly" class="h-3 w-3" />
                  Hanya tampilkan SJ belum balik
                </label>
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs"
                  @click="selectAllFiltered"
                  :disabled="getFilteredUnpaidShipments().length === 0"
                >
                  Pilih Semua ({{ getFilteredUnpaidShipments().length }})
                </button>
                <button
                  type="button"
                  class="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs"
                  @click="deselectAll"
                  :disabled="selectedShipmentIds.size === 0"
                >
                  Hapus Semua ({{ selectedShipmentIds.size }})
                </button>
              </div>
            </div>
            <div v-if="loadingUnpaidShipments" class="text-center py-4 text-gray-500">
              <span class="animate-pulse">Memuat SPB yang belum dibayar...</span>
            </div>
            <div v-else-if="allUnpaidShipments.length === 0" class="text-center py-4 text-gray-400">
              Tidak ada SPB yang belum dibayar
            </div>
            <div v-else-if="form.customer_name && getFilteredUnpaidShipments().length === 0" class="text-center py-4 text-gray-400">
              Tidak ada SPB belum dibayar untuk customer ini
            </div>
            <div v-else-if="selectedDblNumber && getFilteredUnpaidShipments().length === 0" class="text-center py-4 text-gray-400">
              Tidak ada SPB untuk DBL ini
            </div>
            <div v-else class="overflow-x-auto max-h-60 overflow-y-auto">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 sticky top-0">
                  <tr>
                    <th class="px-2 py-2 text-center text-xs font-medium w-10"></th>
                    <th class="px-2 py-2 text-left text-xs font-medium">No. SPB / RESI</th>
                    <th class="px-2 py-2 text-left text-xs font-medium">Customer</th>
                    <th class="px-2 py-2 text-left text-xs font-medium">Nama Barang</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">QTY</th>
                    <th class="px-2 py-2 text-left text-xs font-medium">Penerima</th>
                    <th class="px-2 py-2 text-center text-xs font-medium">SJ Balik</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">Tagihan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(it, idx) in getFilteredUnpaidShipments()"
                    :key="`shipment-${it.id}-${idx}`"
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
                    <div v-if="it.dbl_number" class="text-gray-500">
                          DBL: {{ it.dbl_number.startsWith('DBL') ? it.dbl_number : `DBL ${it.dbl_number}` }}
                          <span v-if="it.driver_name" class="font-normal">| {{ it.driver_name }}</span>
                        </div>
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
                    <td class="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        :checked="!!it.sj_returned"
                        @click.stop="toggleSjReturned(it.shipment_id)"
                        class="h-4 w-4"
                        :title="it.sj_returned ? 'Dokumen SJ sudah balik' : 'Tandai SJ sudah balik'"
                      />
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
                    <th class="px-2 py-2 text-center text-xs font-medium">SJ Balik</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">Tagihan</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">Biaya Lain</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">PPh ({{ pphPercent }}%)</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(it, idx) in items"
                    :key="`item-view-${it.id}-${idx}`"
                    class="border-t"
                  >
                    <td class="px-2 py-2">
                      <div class="text-xs font-mono">
                        <div>{{ it.spb_number || '-' }}</div>
                        <div class="text-gray-500">{{ it.tracking_code || '-' }}</div>
                    <div v-if="it.dbl_number" class="text-gray-500">
                          DBL: {{ it.dbl_number.startsWith('DBL') ? it.dbl_number : `DBL ${it.dbl_number}` }}
                          <span v-if="it.driver_name" class="font-normal">| {{ it.driver_name }}</span>
                        </div>
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
                    <td class="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        :checked="!!it.sj_returned"
                        class="h-4 w-4"
                        @change="toggleSjReturned(it.shipment_id)"
                      />
                    </td>
                    <td class="px-2 py-2 text-right text-xs font-semibold">
                      {{ formatRupiah(it.unit_price || 0) }}
                    </td>
                    <td class="px-2 py-2 text-right text-xs">
                      <input
                        v-model.number="it.other_fee"
                        type="number"
                        min="0"
                        class="w-24 px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td class="px-2 py-2 text-right text-xs text-red-600">
                      -{{ formatRupiah(lineSubtotal(it) * (pphPercent / 100)) }}
                    </td>
                    <td class="px-2 py-2 text-right text-xs font-semibold">
                      {{ formatRupiah(lineSubtotal(it) * (1 - pphPercent / 100)) }}
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
                    <th class="px-2 py-2 text-center text-xs font-medium">SJ Balik</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">Tagihan</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">Biaya Lain</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">PPh ({{ pphPercent }}%)</th>
                    <th class="px-2 py-2 text-right text-xs font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(it, idx) in items"
                    :key="`item-edit-${it.id}-${idx}`"
                    class="border-t"
                  >
                    <td class="px-2 py-2">
                      <div class="text-xs font-mono">
                        <div>{{ it.spb_number || '-' }}</div>
                        <div class="text-gray-500">{{ it.tracking_code || '-' }}</div>
                    <div v-if="it.dbl_number" class="text-gray-500">
                          DBL: {{ it.dbl_number.startsWith('DBL') ? it.dbl_number : `DBL ${it.dbl_number}` }}
                          <span v-if="it.driver_name" class="font-normal">| {{ it.driver_name }}</span>
                        </div>
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
                    <td class="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        :checked="!!it.sj_returned"
                        class="h-4 w-4"
                        @change="toggleSjReturned(it.shipment_id)"
                      />
                    </td>
                    <td class="px-2 py-2 text-right text-xs font-semibold">
                      {{ formatRupiah(it.unit_price || 0) }}
                    </td>
                    <td class="px-2 py-2 text-right text-xs">
                      <input
                        v-model.number="it.other_fee"
                        type="number"
                        min="0"
                        class="w-24 px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td class="px-2 py-2 text-right text-xs text-red-600">
                      -{{ formatRupiah(lineSubtotal(it) * (pphPercent / 100)) }}
                    </td>
                    <td class="px-2 py-2 text-right text-xs font-semibold">
                      {{ formatRupiah(lineSubtotal(it) * (1 - pphPercent / 100)) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
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
              <label class="block text-sm font-medium mb-1">Diskon (Rp)</label>
              <input
                v-model.number="discountAmount"
                type="number"
                min="0"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="0"
              />
              <p class="text-xs text-gray-500 mt-1">Potongan tambahan di luar diskon per item</p>
            </div>
            <div class="sm:col-span-3">
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
            <div class="flex justify-between text-sm text-orange-600">
              <span>Diskon:</span>
              <span class="font-semibold">-{{ formatRupiah(discountAmount || 0) }}</span>
            </div>
            <div class="flex justify-between text-sm text-red-600">
              <span>PPh ({{ pphPercent }}%):</span>
              <span class="font-semibold">-{{ formatRupiah(calcPph()) }}</span>
            </div>
            <div class="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total Tagihan:</span>
              <span>{{ formatRupiah(calcTotal()) }}</span>
            </div>
            <template v-if="editingId">
              <div class="flex justify-between text-sm text-green-600 border-t pt-2">
                <span>Sudah Dibayar:</span>
                <span class="font-semibold">{{ formatRupiah(existingPaidAmount) }}</span>
              </div>
              <div class="flex justify-between text-sm text-orange-600">
                <span>Sisa Tagihan:</span>
                <span class="font-semibold">{{ formatRupiah(Math.max(0, calcTotal() - existingPaidAmount)) }}</span>
              </div>
              <div class="text-xs text-gray-500 mt-2 italic">
                * Gunakan tombol "Bayar" untuk menambah pembayaran cicilan
              </div>
            </template>
            <template v-else-if="manualAmountMode && parseFloat(form.amount) > 0">
              <div class="flex justify-between text-sm text-green-600 border-t pt-2">
                <span>Pembayaran Awal:</span>
                <span class="font-semibold">{{ formatRupiah(parseFloat(form.amount) || 0) }}</span>
              </div>
              <div class="flex justify-between text-sm text-orange-600">
                <span>Sisa:</span>
                <span class="font-semibold">{{ formatRupiah(Math.max(0, calcTotal() - (parseFloat(form.amount) || 0))) }}</span>
              </div>
            </template>
          </div>

          <div class="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" @click="showModal = false">
              Batal
            </Button>
            <Button
              v-if="!editingId"
              variant="success"
              :disabled="items.length === 0"
              @click="saveInvoice('bulk')"
            >
              Simpan Bulk
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
              <div v-else class="space-y-2 max-h-40 overflow-auto">
                <div v-for="p in invoicePayments" :key="p.id" class="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded-lg text-sm">
                  <div class="flex-1">
                    <div class="font-medium text-green-600">{{ formatRupiah(p.amount) }}</div>
                    <div class="text-xs text-gray-500">{{ formatDate(p.payment_date) }} - {{ p.payment_method || 'N/A' }}</div>
                    <div v-if="p.reference_no" class="text-xs text-gray-400">Ref: {{ p.reference_no }}</div>
                    <div v-if="p.notes" class="text-xs text-gray-400 italic">{{ p.notes }}</div>
                  </div>
                  <button class="text-red-500 text-xs ml-2" @click="deletePayment(p.id)">Hapus</button>
                </div>
              </div>
            </div>
            
            <div v-if="selectedInvoice?.status !== 'paid' && (selectedInvoice?.remaining_amount ?? selectedInvoice?.amount ?? 0) > 0" class="border-t border-gray-200 dark:border-gray-600 pt-4">
              <div class="flex items-center justify-between mb-2">
                <h4 class="font-medium dark:text-gray-200">Tambah Pembayaran</h4>
                <button 
                  v-if="(selectedInvoice?.remaining_amount ?? selectedInvoice?.amount ?? 0) > 0"
                  type="button"
                  class="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  @click="paymentForm.amount = String(selectedInvoice?.remaining_amount ?? selectedInvoice?.amount ?? 0)"
                >
                  Isi sisa ({{ formatRupiah(selectedInvoice?.remaining_amount ?? selectedInvoice?.amount ?? 0) }})
                </button>
              </div>
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
            <div v-else-if="selectedInvoice?.status === 'paid'" class="border-t border-gray-200 dark:border-gray-600 pt-4">
              <div class="text-center py-4">
                <div class="text-green-600 font-medium">Invoice sudah lunas</div>
              </div>
            </div>
          </template>
        </div>
        
        <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <Button variant="default" @click="showPaymentModal = false">Tutup</Button>
          <Button v-if="selectedInvoice?.status !== 'paid' && (selectedInvoice?.remaining_amount ?? selectedInvoice?.amount ?? 0) > 0" variant="primary" @click="addPayment">Tambah Pembayaran</Button>
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
