<script setup lang="ts">
import { notify } from '../composables/useNotifications';
import { ref, onMounted, watch, computed, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { vDialog } from '../directives/dialog';
import Button from '../components/ui/Button.vue';
import Badge from '../components/ui/Badge.vue';
import { useFormatters } from '../composables/useFormatters';
import { Icon } from '@iconify/vue';
import { getCompany } from '../lib/company';
import { invoiceTotals } from '../lib/invoiceTotals';
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
  billing_type?: 'pengirim' | 'penerima';
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
  shipment_date?: string | null;
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
  shipment_date?: string | null;
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
const route = useRoute();
const router = useRouter();
const searchQuery = ref(typeof route.query.q === 'string' ? route.query.q : '');
const filteredInvoices = computed(() => invoices.value);
const loading = ref(true);
const printingInvoiceId = ref<number | null>(null);
const printError = ref('');
const showModal = ref(false);
const editingId = ref<number | null>(null);
const pagination = ref({ page: 1, limit: 50, total: 0, pages: 1 });
const canPrevPage = computed(() => pagination.value.page > 1);
const canNextPage = computed(() => pagination.value.page < pagination.value.pages);
const pageStart = computed(() => {
  if (pagination.value.total === 0) return 0;
  return (pagination.value.page - 1) * pagination.value.limit + 1;
});
const pageEnd = computed(() => Math.min(pagination.value.page * pagination.value.limit, pagination.value.total));
let searchDebounce: number | undefined;

const showPaymentModal = ref(false);
const selectedInvoice = ref<Invoice | null>(null);
const invoicePayments = ref<InvoicePayment[]>([]);
const loadingPayments = ref(false);
const paymentForm = ref({
  amount: '',
  payment_date: new Date().toISOString().split('T')[0]!,
  payment_method: 'TF JAKARTA',
  reference_number: '',
  notes: ''
});

const showPphModal = ref(false);
const pphFormPercent = ref<string>('0');

type CreatePaymentType = 'CICILAN' | 'CASH_BALI' | 'CASH_JAKARTA' | 'TF_BALI' | 'TF_JAKARTA' | 'TRANSFER_ALI';
type SjBulkInputStatus = '' | 'returned' | 'not_returned';
const createPaymentType = ref<CreatePaymentType>('TF_JAKARTA');

function getCreatePaymentMethod(type: CreatePaymentType): string | undefined {
  if (type === 'CICILAN') return 'CICILAN';
  if (type === 'CASH_BALI') return 'CASH BALI';
  if (type === 'CASH_JAKARTA') return 'CASH JAKARTA';
  if (type === 'TF_BALI') return 'TF BALI';
  if (type === 'TRANSFER_ALI') return 'TRANSFER ALI';
  return 'TF JAKARTA';
}

type ApiErrorPayload = {
  error?: string;
  details?: string;
  request_id?: string;
};

async function readApiResponse<T extends ApiErrorPayload>(response: Response, fallbackMessage: string): Promise<T> {
  const responseText = await response.text();
  let payload: ApiErrorPayload = {};

  if (responseText) {
    try {
      payload = JSON.parse(responseText) as ApiErrorPayload;
    } catch {
      if (!response.ok) {
        throw new Error(`${fallbackMessage} (HTTP ${response.status})`);
      }
      throw new Error('Respons server tidak valid. Silakan muat ulang halaman.');
    }
  }

  if (!response.ok) {
    const message = payload.error || payload.details || `${fallbackMessage} (HTTP ${response.status})`;
    throw new Error(payload.request_id ? `${message} (Ref: ${payload.request_id})` : message);
  }

  return payload as T;
}

type CicilanCustomerOption = {
  key: string;
  customer_id: number | null;
  customer_name: string;
  invoice_count: number;
  total_remaining: number;
};

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
const savingInvoice = ref(false);
const savingMode = ref<'single' | 'bulk'>('single');
const invoiceSaveError = ref('');
const existingPaidAmount = ref<number>(0);
const editingCustomerName = ref<string>('');
const selectedCustomerKey = ref<string>('');
const invoiceFilterType = ref<'pengirim' | 'penerima'>('penerima');
const addInvoiceTab = ref<'unpaid' | 'selected'>('unpaid');
const sjBulkInputStatus = ref<SjBulkInputStatus>('');

const showCicilanModal = ref(false);
const loadingCicilan = ref(false);
const cicilanActionLoading = ref(false);
const allUnpaidInvoices = ref<Invoice[]>([]);
const cicilanCustomerKey = ref<string>('');
const cicilanSearch = ref<string>('');
const cicilanPaymentType = ref<CreatePaymentType>('TF_JAKARTA');
const cicilanPaymentDate = ref<string>(new Date().toISOString().split('T')[0]!);
const cicilanReferenceNo = ref<string>('');
const cicilanNotes = ref<string>('');
const cicilanSelectedInvoiceIds = ref<Set<number>>(new Set());
const cicilanFilterType = ref<'semua' | 'penerima' | 'pengirim'>('semua');

const cicilanFilteredByType = computed<Invoice[]>(() => {
  if (cicilanFilterType.value === 'semua') return allUnpaidInvoices.value;
  return allUnpaidInvoices.value.filter((inv) => (inv.billing_type || 'penerima') === cicilanFilterType.value);
});

const cicilanCustomerOptions = computed<CicilanCustomerOption[]>(() => {
  const map = new Map<string, CicilanCustomerOption>();
  for (const inv of cicilanFilteredByType.value) {
    const name = (inv.customer_name || '').trim() || 'Tanpa Customer';
    const id = typeof inv.customer_id === 'number' ? inv.customer_id : null;
    const key = `name:${name.toLowerCase()}`;
    const remaining = Number(inv.remaining_amount ?? inv.amount ?? 0);
    const prev = map.get(key);
    if (prev) {
      prev.invoice_count += 1;
      prev.total_remaining += remaining;
    } else {
      map.set(key, {
        key,
        customer_id: id,
        customer_name: name,
        invoice_count: 1,
        total_remaining: remaining
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.customer_name.localeCompare(b.customer_name));
});

const selectedCicilanCustomer = computed<CicilanCustomerOption | null>(() => {
  return cicilanCustomerOptions.value.find((c) => c.key === cicilanCustomerKey.value) ?? null;
});

const filteredCicilanInvoices = computed<Invoice[]>(() => {
  let list = cicilanFilteredByType.value;
  const selected = selectedCicilanCustomer.value;
  if (selected) {
    const nameKey = selected.customer_name.trim().toLowerCase();
    list = list.filter((inv) => (inv.customer_name || '').trim().toLowerCase() === nameKey);
  }
  if (cicilanSearch.value.trim()) {
    const q = cicilanSearch.value.trim().toLowerCase();
    list = list.filter((inv) => {
      return (
        String(inv.invoice_number || '').toLowerCase().includes(q) ||
        String(inv.spb_number || '').toLowerCase().includes(q) ||
        String(inv.customer_name || '').toLowerCase().includes(q) ||
        String(inv.notes || '').toLowerCase().includes(q)
      );
    });
  }
  return list;
});

const cicilanTotalOutstanding = computed<number>(() => {
  return filteredCicilanInvoices.value.reduce((sum, inv) => sum + Number(inv.remaining_amount ?? inv.amount ?? 0), 0);
});

const cicilanBusy = computed<boolean>(() => loadingCicilan.value || cicilanActionLoading.value);

function isCicilanEligibleForBulk(inv: Invoice): boolean {
  const remaining = Number(inv.remaining_amount ?? inv.amount ?? 0);
  return remaining > 0;
}

const cicilanEligibleInvoices = computed<Invoice[]>(() => {
  return filteredCicilanInvoices.value.filter(isCicilanEligibleForBulk);
});

const cicilanCustomerInvoices = computed<Invoice[]>(() => {
  let list = cicilanFilteredByType.value;
  const selected = selectedCicilanCustomer.value;
  if (selected) {
    const nameKey = selected.customer_name.trim().toLowerCase();
    list = list.filter((inv) => (inv.customer_name || '').trim().toLowerCase() === nameKey);
  }
  return list;
});

function getInvoiceSpbCount(inv: Invoice): number {
  if (typeof inv.shipment_count === 'number' && inv.shipment_count > 0) return inv.shipment_count;
  const spb = String(inv.spb_number || '').trim();
  if (!spb) return 1;
  const parts = spb.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  return Math.max(1, parts.length);
}

function sumSpbCount(invoices: Invoice[]): number {
  return invoices.reduce((sum, inv) => sum + getInvoiceSpbCount(inv), 0);
}

const cicilanSelectedInvoices = computed<Invoice[]>(() => {
  return filteredCicilanInvoices.value.filter((inv) => cicilanSelectedInvoiceIds.value.has(inv.id));
});

const cicilanSelectedOutstandingTotal = computed<number>(() => {
  return cicilanSelectedInvoices.value.reduce((sum, inv) => sum + Number(inv.remaining_amount ?? inv.amount ?? 0), 0);
});

const cicilanSelectedSpbCount = computed<number>(() => sumSpbCount(cicilanSelectedInvoices.value));

const cicilanCustomerOutstandingTotal = computed<number>(() => {
  return cicilanCustomerInvoices.value.reduce((sum, inv) => sum + Number(inv.remaining_amount ?? inv.amount ?? 0), 0);
});

const cicilanCustomerSpbCount = computed<number>(() => sumSpbCount(cicilanCustomerInvoices.value));

const cicilanFilteredSpbCount = computed<number>(() => sumSpbCount(filteredCicilanInvoices.value));
const cicilanHasSearch = computed<boolean>(() => Boolean(cicilanSearch.value.trim()));

const cicilanAllEligibleSelected = computed<boolean>(() => {
  const eligible = cicilanEligibleInvoices.value;
  if (eligible.length === 0) return false;
  return eligible.every((inv) => cicilanSelectedInvoiceIds.value.has(inv.id));
});

function toggleCicilanInvoiceSelection(invoiceId: number, selected?: boolean): void {
  const next = new Set(cicilanSelectedInvoiceIds.value);
  const shouldSelect = selected ?? !next.has(invoiceId);
  if (shouldSelect) next.add(invoiceId);
  else next.delete(invoiceId);
  cicilanSelectedInvoiceIds.value = next;
}

function toggleCicilanSelectAllEligible(checked: boolean): void {
  const next = new Set(cicilanSelectedInvoiceIds.value);
  if (checked) {
    cicilanEligibleInvoices.value.forEach((inv) => next.add(inv.id));
  } else {
    cicilanEligibleInvoices.value.forEach((inv) => next.delete(inv.id));
  }
  cicilanSelectedInvoiceIds.value = next;
}

function onCicilanSelectAllChange(e: Event): void {
  const target = e.target as HTMLInputElement | null;
  toggleCicilanSelectAllEligible(Boolean(target?.checked));
}

function onCicilanInvoiceSelectionChange(invoiceId: number, e: Event): void {
  const target = e.target as HTMLInputElement | null;
  toggleCicilanInvoiceSelection(invoiceId, Boolean(target?.checked));
}

type InvoiceCustomerOption = { key: string; id: number | null; name: string };

const uniqueCustomers = computed<InvoiceCustomerOption[]>(() => {
  const map = new Map<string, InvoiceCustomerOption>();
  if (editingCustomerName.value) {
    const id = form.value.customer_id;
    const key = typeof id === 'number' ? `id:${id}` : `name:${editingCustomerName.value.toLowerCase()}`;
    map.set(key, { key, id: id ?? null, name: editingCustomerName.value });
  }
  allUnpaidShipments.value.forEach(s => {
    if (!s.customer_name || s.customer_name === '-') return;
    const id = typeof s.customer_id === 'number' ? s.customer_id : null;
    const key = id !== null ? `id:${id}` : `name:${s.customer_name.toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, { key, id, name: s.customer_name });
    }
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
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

const sjSaveSummary = computed(() => {
  const total = items.value.length;
  if (total === 0) {
    return { total: 0, returned: 0, pending: 0 };
  }
  if (sjBulkInputStatus.value === 'returned') {
    return { total, returned: total, pending: 0 };
  }
  if (sjBulkInputStatus.value === 'not_returned') {
    return { total, returned: 0, pending: total };
  }
  const returned = items.value.reduce((sum, it) => sum + (it.sj_returned ? 1 : 0), 0);
  return {
    total,
    returned,
    pending: Math.max(0, total - returned)
  };
});

function resolveSjReturnedForSave(item: Item): boolean {
  if (sjBulkInputStatus.value === 'returned') return true;
  if (sjBulkInputStatus.value === 'not_returned') return false;
  return Boolean(item.sj_returned);
}

function formatShipmentDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return formatDate(value);
}

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
        shipment_date: s.created_at,
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

async function loadAllUnpaidInvoices(): Promise<void> {
  loadingCicilan.value = true;
  try {
    const res = await fetch('/api/invoices?endpoint=unpaid&limit=5000');
    const data = await res.json();
    allUnpaidInvoices.value = Array.isArray(data.items) ? (data.items as Invoice[]) : [];
    cicilanSelectedInvoiceIds.value = new Set();
  } catch (e) {
    console.error('Failed to load unpaid invoices:', e);
    allUnpaidInvoices.value = [];
    cicilanSelectedInvoiceIds.value = new Set();
  } finally {
    loadingCicilan.value = false;
  }
}

function getFilteredUnpaidShipments(): Item[] {
  let result = allUnpaidShipments.value;
  
  if (typeof form.value.customer_id === 'number') {
    result = result.filter(s => s.customer_id === form.value.customer_id);
  } else if (form.value.customer_name) {
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

function updateItemsFromSelection(): void {
  items.value = allUnpaidShipments.value.filter(s => s.shipment_id && selectedShipmentIds.value.has(s.shipment_id));
}

function onCustomerChange(): void {
  const key = selectedCustomerKey.value;
  if (key) {
    const opt = uniqueCustomers.value.find(c => c.key === key);
    if (opt) {
      form.value.customer_name = opt.name;
      form.value.customer_id = opt.id;
    }
  } else {
    form.value.customer_name = '';
    form.value.customer_id = null;
  }
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
        description: i.description || 'Jasa pengiriman',
        quantity: Number(i.quantity ?? 1),
        unit_price: Number(i.unit_price ?? 0),
        other_fee: otherFee,
        colli: i.colli ?? i.quantity ?? null,
        qty: i.qty ?? i.quantity ?? null,
        recipient_name: i.recipient_name ?? i.penerima_name ?? i.recipient ?? '',
        spb_number: spbFromFallback || i.tracking_code || '',
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
  return invoiceTotals(calcSubtotal(), discountAmount.value, pphPercent.value).discountedSubtotal;
}

function lineSubtotal(it: Item): number {
  return Number(it.unit_price || 0) + Number(it.other_fee || 0) - Number(it.item_discount || 0);
}

function calcPph(): number {
  return invoiceTotals(calcSubtotal(), discountAmount.value, pphPercent.value).pph;
}

function calcTotal(): number {
  return invoiceTotals(calcSubtotal(), discountAmount.value, pphPercent.value).total;
}

async function loadInvoices(options: { page?: number; q?: string } = {}): Promise<void> {
  loading.value = true;
  try {
    const pageToLoad = options.page ?? pagination.value.page;
    const q = (options.q ?? searchQuery.value).trim();
    const params = new URLSearchParams({
      endpoint: 'list',
      limit: String(pagination.value.limit),
      page: String(pageToLoad)
    });
    if (q) params.set('q', q);
    const res = await fetch(`/api/invoices?${params.toString()}`);
    const data = await res.json();
    const items = (data.items || []).map((x: Partial<Invoice>) => ({
      ...x,
      tax_percent: Number(x.tax_percent || 0),
      discount_amount: Number(x.discount_amount || 0),
      sj_all_returned: x.sj_all_returned ?? null,
      sj_pending_count: Number(x.sj_pending_count || 0),
      sj_returned_count: Number(x.sj_returned_count || 0),
      shipment_count: Number(x.shipment_count || 0)
    }));
    invoices.value = items;
    const nextPage = data.pagination?.page ?? pageToLoad;
    const nextLimit = data.pagination?.limit ?? pagination.value.limit;
    const nextTotal = data.pagination?.total ?? items.length;
    const nextPages = data.pagination?.pages ?? Math.ceil((nextTotal || 0) / (nextLimit || 1));
    pagination.value = {
      page: nextPage,
      limit: nextLimit,
      total: nextTotal,
      pages: Math.max(1, nextPages || 1)
    };
  } catch (e) {
    console.error('Failed to load invoices:', e);
  } finally {
    loading.value = false;
  }
}

function syncSearchRoute(value: string): void {
  const clean = value.trim();
  const current = typeof route.query.q === 'string' ? route.query.q : '';
  if (clean === current) return;
  const newQuery = { ...route.query };
  if (clean) newQuery.q = clean;
  else delete newQuery.q;
  router.replace({ name: 'invoice', query: newQuery });
}

function goToPage(target: number): void {
  const totalPages = Math.max(1, pagination.value.pages || 1);
  const next = Math.min(Math.max(1, target), totalPages);
  if (next === pagination.value.page) return;
  loadInvoices({ page: next });
}

function prevPage(): void {
  if (!canPrevPage.value) return;
  goToPage(pagination.value.page - 1);
}

function nextPage(): void {
  if (!canNextPage.value) return;
  goToPage(pagination.value.page + 1);
}

function openCreateModal(): void {
  editingId.value = null;
  form.value = { customer_name: '', customer_id: null, amount: '', status: 'paid' };
  createPaymentType.value = 'TF_JAKARTA';
  sjBulkInputStatus.value = '';
  addInvoiceTab.value = 'unpaid';
  items.value = [];
  allUnpaidShipments.value = [];
  selectedShipmentIds.value = new Set();
  selectedDblNumber.value = '';
  taxPercent.value = 0;
  discountAmount.value = 0;
  notes.value = '';
  pphPercent.value = 0;
  manualAmountMode.value = false;
  invoiceSaveError.value = '';
  existingPaidAmount.value = 0;
  editingCustomerName.value = '';
  selectedCustomerKey.value = '';
  spbSearch.value = '';
  showUnreturnedOnly.value = false;
  invoiceFilterType.value = 'penerima';
  showModal.value = true;
  loadAllUnpaidShipments();
}

function openCicilanModal(): void {
  showCicilanModal.value = true;
  cicilanCustomerKey.value = '';
  cicilanSearch.value = '';
  cicilanFilterType.value = 'semua';
  cicilanPaymentType.value = 'TF_JAKARTA';
  cicilanPaymentDate.value = new Date().toISOString().split('T')[0]!;
  cicilanReferenceNo.value = '';
  cicilanNotes.value = '';
  cicilanSelectedInvoiceIds.value = new Set();
  loadAllUnpaidInvoices();
}

watch(
  () => cicilanCustomerKey.value,
  () => {
    cicilanSelectedInvoiceIds.value = new Set();
  }
);

async function settleCicilanForSelectedCustomer(): Promise<void> {
  const selected = selectedCicilanCustomer.value;
  if (!selected) {
    notify.error('Pilih customer terlebih dahulu');
    return;
  }

  const invoiceCount = cicilanCustomerInvoices.value.length;
  if (invoiceCount === 0) {
    notify.error('Tidak ada invoice yang belum lunas untuk customer ini');
    return;
  }

  const total = cicilanCustomerOutstandingTotal.value;
  const spbCount = cicilanCustomerSpbCount.value;
  const confirmMsg = `Lunasi semua untuk "${selected.customer_name}" (${invoiceCount} invoice / ${spbCount} SPB) sebesar ${formatRupiah(total)}?\n\nCatatan: Pelunasan dibuat per-invoice (tidak digabung).`;
  if (!confirm(confirmMsg)) return;

  cicilanActionLoading.value = true;
  try {
    const res = await fetch('/api/invoices?endpoint=settle-customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: selected.customer_id ?? undefined,
        customer_name: selected.customer_name,
        payment_date: cicilanPaymentDate.value,
        payment_method: getCreatePaymentMethod(cicilanPaymentType.value),
        reference_no: cicilanReferenceNo.value || undefined,
        notes: cicilanNotes.value || undefined
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Gagal melunasi invoice');
    }
    notify.success(`Berhasil melunasi ${data.settled_count || 0} invoice (${formatRupiah(data.total_paid || 0)})`);
    await loadInvoices({ page: pagination.value.page, q: searchQuery.value });
    await loadAllUnpaidInvoices();
  } catch (e) {
    console.error('Settle customer error:', e);
    notify.error(e instanceof Error ? e.message : 'Gagal melunasi invoice');
  } finally {
    cicilanActionLoading.value = false;
  }
}

async function bulkSettleCicilanSelectedInvoices(): Promise<void> {
  const selected = selectedCicilanCustomer.value;
  if (!selected) {
    notify.error('Pilih customer terlebih dahulu');
    return;
  }

  const selectedEligible = cicilanSelectedInvoices.value.filter(isCicilanEligibleForBulk);
  const selectedEligibleIds = selectedEligible.map((inv) => inv.id);
  if (selectedEligibleIds.length === 0) {
    notify.error('Pilih minimal 1 invoice yang masih ada sisa untuk gabung');
    return;
  }

  const total = cicilanSelectedOutstandingTotal.value;
  const spbCount = sumSpbCount(selectedEligible);
  const confirmMsg = `Gabung terpilih: ${selectedEligibleIds.length} invoice (${spbCount} SPB) untuk "${selected.customer_name}" sebesar ${formatRupiah(total)}?\n\nPeringatan: Invoice terpilih akan digabung menjadi 1 invoice baru (nomor invoice baru). Invoice lama tidak dipakai lagi.`;
  if (!confirm(confirmMsg)) return;

  cicilanActionLoading.value = true;
  try {
    const res = await fetch('/api/invoices?endpoint=bulk-settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_ids: selectedEligibleIds,
        payment_date: cicilanPaymentDate.value,
        payment_method: getCreatePaymentMethod(cicilanPaymentType.value),
        reference_no: cicilanReferenceNo.value || undefined,
        notes: cicilanNotes.value || undefined
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Gagal gabung invoice');
    }
    notify.success(`Berhasil gabung (${data.merged_count || selectedEligibleIds.length} invoice). Invoice baru: ${data.invoice_number || data.id}`);
    cicilanSelectedInvoiceIds.value = new Set();
    await loadInvoices({ page: pagination.value.page, q: searchQuery.value });
    await loadAllUnpaidInvoices();
  } catch (e) {
    console.error('Bulk settle error:', e);
    notify.error(e instanceof Error ? e.message : 'Gagal gabung invoice');
  } finally {
    cicilanActionLoading.value = false;
  }
}

async function bulkSettleCicilanAllInvoices(): Promise<void> {
  const selected = selectedCicilanCustomer.value;
  if (!selected) {
    notify.error('Pilih customer terlebih dahulu');
    return;
  }

  const allEligible = cicilanCustomerInvoices.value.filter(isCicilanEligibleForBulk);
  const allEligibleIds = allEligible.map((inv) => inv.id);
  if (allEligibleIds.length === 0) {
    notify.error('Tidak ada invoice yang masih ada sisa untuk customer ini');
    return;
  }

  const total = cicilanCustomerOutstandingTotal.value;
  const spbCount = cicilanCustomerSpbCount.value;
  const confirmMsg = `Bulk Semua: gabungkan ${allEligibleIds.length} invoice (${spbCount} SPB) untuk "${selected.customer_name}" sebesar ${formatRupiah(total)}?\n\nPeringatan: Semua SPB akan digabung menjadi 1 INVOICE baru. Invoice lama tidak dipakai lagi.`;
  if (!confirm(confirmMsg)) return;

  cicilanActionLoading.value = true;
  try {
    const res = await fetch('/api/invoices?endpoint=bulk-settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_ids: allEligibleIds,
        payment_date: cicilanPaymentDate.value,
        payment_method: getCreatePaymentMethod(cicilanPaymentType.value),
        reference_no: cicilanReferenceNo.value || undefined,
        notes: cicilanNotes.value || undefined
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Gagal gabung invoice');
    }
    notify.success(`Berhasil bulk semua (${data.merged_count || allEligibleIds.length} invoice). Invoice baru: ${data.invoice_number || data.id}`);
    cicilanSelectedInvoiceIds.value = new Set();
    await loadInvoices({ page: pagination.value.page, q: searchQuery.value });
    await loadAllUnpaidInvoices();
  } catch (e) {
    console.error('Bulk all settle error:', e);
    notify.error(e instanceof Error ? e.message : 'Gagal gabung invoice');
  } finally {
    cicilanActionLoading.value = false;
  }
}

async function openEditModal(invoice: Invoice) {
  editingId.value = invoice.id;
  sjBulkInputStatus.value = '';
  manualAmountMode.value = true;
  invoiceSaveError.value = '';
  existingPaidAmount.value = invoice.paid_amount || 0;
  editingCustomerName.value = invoice.customer_name || '';
  selectedCustomerKey.value = typeof invoice.customer_id === 'number'
    ? `id:${invoice.customer_id}`
    : `name:${(invoice.customer_name || '').toLowerCase()}`;
  addInvoiceTab.value = 'selected';
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
  if (savingInvoice.value) return;

  const inputAmount = parseFloat(form.value.amount) || 0;
  if (!form.value.customer_name && !form.value.customer_id) {
    const firstItem = items.value[0];
    if (items.value.length > 0 && firstItem?.customer_name) {
      form.value.customer_name = firstItem.customer_name;
    } else {
      notify.error('Pilih customer terlebih dahulu');
      return;
    }
  }

  if (items.value.length === 0) {
    notify.error('Pilih minimal satu SPB sebelum menyimpan invoice');
    return;
  }

  if (!editingId.value && !sjBulkInputStatus.value) {
    notify.error('Pilih status SJ (Sudah balik / Belum balik) sebelum menyimpan invoice');
    return;
  }

  const subtotal = calcSubtotal();
  const subtotalAfterDiscount = calcDiscountedSubtotal();
  const pphAmount = subtotalAfterDiscount * (pphPercent.value / 100);
  const totalTagihan = Math.max(0, subtotalAfterDiscount - pphAmount);

  if (totalTagihan <= 0) {
    notify.error('Total tagihan harus lebih dari 0');
    return;
  }
  
  const itemsSnapshot = items.value.map(it => ({
    ...it,
    sj_returned: resolveSjReturnedForSave(it)
  }));
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
      notify.error('Bulk invoice hanya untuk SPB dengan penagih/customer yang sama');
      return;
    }
  }

  savingMode.value = mode;
  savingInvoice.value = true;
  invoiceSaveError.value = '';

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
      notify.success('Perubahan invoice berhasil disimpan');
    } else if (mode === 'bulk') {
      let paidAmount = 0;
      let remainingAmount = totalTagihan;
      const shouldAutoPayFull = createPaymentType.value !== 'CICILAN';
      if (manualAmountMode.value && inputAmount > 0) {
        paidAmount = inputAmount;
        remainingAmount = Math.max(0, totalTagihan - paidAmount);
      } else if (shouldAutoPayFull) {
        paidAmount = totalTagihan;
        remainingAmount = 0;
      }

      let finalStatus = 'pending';
      if (remainingAmount <= 0 && paidAmount > 0) finalStatus = 'paid';
      else if (paidAmount > 0) finalStatus = 'partial';

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
          payment_method: getCreatePaymentMethod(createPaymentType.value),
          discount_amount: discountAmount.value || 0,
          tax_percent: taxPercent.value || 0,
          payment_notes: notes.value || undefined,
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

      const created = await readApiResponse<{ invoice_number?: string; error?: string }>(
        res,
        'Invoice gagal dibuat'
      );

      notify.success(created.invoice_number ? `Invoice ${created.invoice_number} berhasil dibuat` : 'Berhasil membuat invoice bulk');
    } else {
      const createdInvoices: string[] = [];
      const failedInvoices: { index: number; spb: string; error: string }[] = [];

      const invoiceLevelDiscountRaw = Math.max(0, Number(discountAmount.value || 0));
      const itemBaseSubtotals = itemsSnapshot.map((item) =>
        Math.max(
          0,
          Number(item.unit_price || 0) + Number(item.other_fee || 0) - Number(item.item_discount || 0)
        )
      );
      const totalBaseSubtotal = itemBaseSubtotals.reduce((sum, val) => sum + val, 0);
      const invoiceLevelDiscountTotal = Math.min(invoiceLevelDiscountRaw, totalBaseSubtotal);
      let discountRemaining = invoiceLevelDiscountTotal;
      const invoiceLevelDiscountByIndex = itemBaseSubtotals.map((baseSubtotal) => {
        if (invoiceLevelDiscountTotal <= 0 || baseSubtotal <= 0) return 0;
        const allocated = Math.min(baseSubtotal, Math.max(0, discountRemaining));
        discountRemaining = Math.max(0, discountRemaining - allocated);
        return allocated;
      });

      let paymentRemaining = manualAmountMode.value && inputAmount > 0 ? inputAmount : 0;

      for (let itemIndex = 0; itemIndex < itemsSnapshot.length; itemIndex++) {
        const item = itemsSnapshot[itemIndex]!;
        try {
          const customerName = item.customer_name || form.value.customer_name;
          const customerId = item.customer_id ?? form.value.customer_id ?? null;
          const baseSubtotal = itemBaseSubtotals[itemIndex] ?? 0;
          const invoiceLevelDiscount = invoiceLevelDiscountByIndex[itemIndex] ?? 0;
          const subtotalAfterInvoiceDiscount = Math.max(0, baseSubtotal - invoiceLevelDiscount);
          const itemPphAmount = subtotalAfterInvoiceDiscount * (pphPercent.value / 100);
          const itemTotalTagihan = Math.max(0, subtotalAfterInvoiceDiscount - itemPphAmount);

          let paidAmount = 0;
          let remainingAmount = itemTotalTagihan;
          let finalStatus = 'pending';
          const shouldAutoPayFull = createPaymentType.value !== 'CICILAN' && !manualAmountMode.value;
          
          if (manualAmountMode.value && paymentRemaining > 0) {
            paidAmount = Math.min(paymentRemaining, itemTotalTagihan);
            paymentRemaining = Math.max(0, paymentRemaining - paidAmount);
            remainingAmount = Math.max(0, itemTotalTagihan - paidAmount);
            if (remainingAmount <= 0) {
              finalStatus = 'paid';
            } else if (paidAmount > 0) {
              finalStatus = 'partial';
            }
          } else if (shouldAutoPayFull) {
            paidAmount = itemTotalTagihan;
            remainingAmount = 0;
            finalStatus = 'paid';
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
              subtotal: baseSubtotal,
              pph_percent: pphPercent.value,
              pph_amount: itemPphAmount,
              paid_amount: paidAmount,
                remaining_amount: remainingAmount,
                status: finalStatus,
                payment_method: getCreatePaymentMethod(createPaymentType.value),
                discount_amount: invoiceLevelDiscount,
                tax_percent: taxPercent.value || 0,
                payment_notes: notes.value || undefined,
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
          
          await readApiResponse<{ invoice_number?: string; error?: string }>(
            res,
            `Invoice SPB ${item.spb_number || item.tracking_code || 'N/A'} gagal dibuat`
          );
          
          createdInvoices.push(item.spb_number || item.tracking_code || 'N/A');
        } catch (error) {
          failedInvoices.push({
            index: itemIndex,
            spb: item.spb_number || item.tracking_code || 'N/A',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      if (failedInvoices.length > 0) {
        console.error('Failed invoices:', failedInvoices);
        const failedIndexes = new Set(failedInvoices.map((failed) => failed.index));
        items.value = itemsSnapshot.filter((_item, index) => failedIndexes.has(index));
        selectedShipmentIds.value = new Set(
          items.value
            .map((item) => item.shipment_id)
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0)
        );
        addInvoiceTab.value = 'selected';

        const details = failedInvoices
          .slice(0, 5)
          .map((failed) => `• ${failed.spb}: ${failed.error}`)
          .join('\n');
        const successInfo = createdInvoices.length > 0
          ? `${createdInvoices.length} invoice berhasil dibuat.\n`
          : '';
        invoiceSaveError.value = `${failedInvoices.length} invoice gagal dibuat. ${failedInvoices[0]?.error || ''}`.trim();
        notify.error(`${successInfo}${failedInvoices.length} invoice gagal dibuat:\n${details}\n\nData yang gagal tetap dipilih agar bisa dicoba lagi.`);
        if (createdInvoices.length > 0) await loadInvoices();
        return;
      }

      notify.success(`Berhasil membuat ${createdInvoices.length} invoice dari ${itemsSnapshot.length} SPB`);
    }
    showModal.value = false;
    await loadInvoices();
  } catch (e) {
    console.error('Save error:', e);
    invoiceSaveError.value = e instanceof Error ? e.message : 'Gagal menyimpan invoice';
    notify.error(invoiceSaveError.value);
  } finally {
    savingInvoice.value = false;
  }
}

async function deleteInvoice(inv: Invoice) {
  const invoiceInfo = `
Invoice: ${inv.invoice_number}
Customer: ${inv.customer_name}
Amount: ${formatRupiah(inv.amount || 0)}
Status: ${inv.status}

Anda yakin ingin menghapus invoice ini? Tindakan ini tidak dapat dibatalkan.`;

  if (!confirm(invoiceInfo)) return;
  
  try {
    const res = await fetch(`/api/invoices?endpoint=delete&id=${inv.id}`, { method: 'DELETE' });
    const result = await readApiResponse<{ error?: string; sj_restored_count?: number; sj_untracked_count?: number }>(res, 'Gagal menghapus invoice');
    const restored = Number(result.sj_restored_count || 0);
    const untracked = Number(result.sj_untracked_count || 0);
    let message = restored > 0
      ? `Invoice dihapus. Status SJ ${restored} SPB dikembalikan ke sebelumnya.`
      : 'Invoice berhasil dihapus.';
    if (untracked > 0) message += ` Riwayat status SJ awal ${untracked} SPB belum tersedia, sehingga statusnya tetap.`;
    notify.success(message);
    await loadInvoices();
  } catch (e) {
    console.error('Delete error:', e);
    notify.error(e instanceof Error ? e.message : 'Gagal menghapus invoice');
  }
}

async function openPaymentModal(inv: Invoice) {
  selectedInvoice.value = inv;
  loadingPayments.value = true;
  showPaymentModal.value = true;
  paymentForm.value = {
    amount: '',
    payment_date: new Date().toISOString().split('T')[0]!,
    payment_method: 'TF JAKARTA',
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
    notify.error('Masukkan jumlah pembayaran yang valid');
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
    
    showPaymentModal.value = false;
    selectedInvoice.value = null;
    loadInvoices();
  } catch (e) {
    console.error('Add payment error:', e);
    notify.error('Gagal menambahkan pembayaran: ' + (e instanceof Error ? e.message : 'Unknown error'));
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
    notify.error('Gagal menghapus pembayaran');
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
    notify.error('Gagal update PPh');
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
  loadInvoices({ page: 1, q: searchQuery.value });
  if (route.query.create) {
    openCreateModal();
  }
});

watch(searchQuery, (val) => {
  if (searchDebounce !== undefined) {
    window.clearTimeout(searchDebounce);
  }
  searchDebounce = window.setTimeout(() => {
    syncSearchRoute(val);
    pagination.value.page = 1;
    loadInvoices({ page: 1, q: val });
  }, 300);
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
  if (printingInvoiceId.value !== null) return;
  printError.value = '';
  const win = window.open('', '_blank');
  if (!win) { printError.value = 'Jendela cetak diblokir. Izinkan popup untuk aplikasi ini, lalu coba lagi.'; return; }
  win.document.body.textContent = 'Menyiapkan invoice untuk dicetak...';
  printingInvoiceId.value = inv.id;
  try {
    const res = await fetch('/api/invoices?endpoint=items&invoice_id=' + inv.id);
    if (!res.ok) throw new Error('Rincian invoice gagal dimuat. Silakan coba lagi.');
    const data = await res.json();
    const invItems = data.items as Item[];
    if (!Array.isArray(invItems) || !invItems.length) throw new Error('Rincian invoice kosong. Periksa invoice sebelum mencetak.');
  const subtotal = invItems.reduce((acc: number, it: Item) => {
    return acc + lineSubtotal(it);
  }, 0);
  const totals = invoiceTotals(subtotal, inv.discount_amount || 0, inv.pph_percent || 0);
  const pphAmount = totals.pph;
  const grand = totals.total;
  const company = await getCompany();
  
  const rows = invItems.map((it: Item) => {
    const spbDisplay = it.spb_number || inv.spb_number || '';
    const trackingDisplay = it.tracking_code || '';
    const displaySpb = spbDisplay || trackingDisplay || '-';
    const baseLine = lineSubtotal(it);
    const baseTagihan = Number(it.unit_price || 0);
    const otherFee = Number(it.other_fee || 0);
    const discountedLine = subtotal > 0 ? baseLine * totals.discountedSubtotal / subtotal : 0;
    const itemPph = (inv.pph_percent || 0) * discountedLine / 100;
    const itemTotal = Math.max(0, discountedLine - itemPph);
    const colliLabel = it.colli ?? it.quantity ?? 0;
    const qtyLabel = (() => {
      if (it.weight !== undefined && it.weight !== null && !Number.isNaN(it.weight)) {
        return `${it.weight} ${it.unit || ''}`.trim();
      }
      return `${it.quantity || 0}${it.unit ? ' ' + it.unit : ''}`;
    })();
    const penerimaLabel = it.recipient_name || '-';
    return `<tr>
      <td class="cell-center">${displaySpb.replace(/</g,'&lt;')}</td>
      <td class="item-description">
        <div>${(it.description || '').replace(/</g,'&lt;')}</div>
        <div>Penerima: ${(penerimaLabel || '-').replace(/</g,'&lt;')}</div>
      </td>
      <td class="cell-center">${colliLabel}</td>
      <td class="cell-center">${qtyLabel}</td>
      <td class="cell-money">${formatRupiah(baseTagihan)}</td>
      <td class="cell-money">${formatRupiah(otherFee)}</td>
      <td class="cell-money">${formatRupiah(itemPph)}</td>
      <td class="cell-money item-total">${formatRupiah(itemTotal)}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Invoice ${inv.invoice_number}</title>
  <style>
    @page { 
      size: A4; 
      margin: 12mm;
    }
    * { 
      box-sizing: border-box; 
      margin: 0; 
      padding: 0; 
    }
    html, body { 
      font-family: Arial, sans-serif; 
      font-size: 10pt;
      color: #000; 
      line-height: 1.4;
    }
    body { 
      padding: 0;
      background: #eef1f5;
    }
    .container {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 12mm;
      background: white;
      position: relative;
      isolation: isolate;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header,
    .content,
    .bank-section,
    .notes-section,
    .footer {
      position: relative;
      z-index: 1;
    }
    .header {
      margin-bottom: 5mm;
      border-bottom: 1mm double #12385f;
      padding-bottom: 4mm;
      break-inside: avoid;
    }
    .company-info {
      display: flex;
      gap: 5mm;
      align-items: center;
    }
    .company-logo {
      width: 26mm;
      height: 26mm;
      flex-shrink: 0;
    }
    .company-logo img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .company-details {
      flex: 1;
      min-width: 0;
    }
    .company-name {
      font-size: 22pt;
      font-weight: bold;
      line-height: 1.1;
      color: #12385f;
      text-transform: uppercase;
      overflow-wrap: anywhere;
      margin-bottom: 2mm;
    }
    .company-address {
      font-size: 8.5pt;
      line-height: 1.4;
      color: #333;
      overflow-wrap: anywhere;
    }
    .company-contact {
      font-size: 8.5pt;
      line-height: 1.4;
      color: #333;
      overflow-wrap: anywhere;
      margin-top: 1mm;
    }
    .billing-header {
      display: flex;
      align-items: flex-start;
      gap: 6mm;
      margin-bottom: 10px;
      break-inside: avoid;
    }
    .invoice-meta {
      text-align: right;
      width: 65mm;
      flex-shrink: 0;
    }
    .invoice-title {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 6px;
      color: #12385f;
    }
    .invoice-meta-row {
      font-size: 10pt;
      margin-bottom: 2px;
      display: flex;
      justify-content: space-between;
      gap: 10px;
    }
    .invoice-meta-label {
      font-weight: bold;
      flex-shrink: 0;
    }
    .invoice-meta-row > :last-child {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .content {
      margin: 8px 0;
    }
    .bill-to {
      flex: 1;
      min-width: 0;
    }
    .bill-to-label {
      font-weight: bold;
      font-size: 10pt;
      margin-bottom: 2px;
    }
    .bill-to-content {
      font-size: 11pt;
      padding: 2mm;
      background: #f8f8f8;
      border: 1px solid #999;
      overflow-wrap: anywhere;
    }
    .items-table {
      --table-border-width: 1px;
      width: 100%;
      table-layout: fixed;
      /* Keep outer borders inside the cells so print page clipping cannot cut them off. */
      border-collapse: separate;
      border-spacing: 0;
      margin-bottom: 8px;
      font-size: 10pt;
    }
    .items-table thead {
      display: table-header-group;
      break-inside: avoid;
    }
    .items-table tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .items-table th,
    .items-table td {
      padding: 1.8mm 1mm;
      border: 0;
      border-right: var(--table-border-width) solid #000;
      border-bottom: var(--table-border-width) solid #000;
      overflow-wrap: anywhere;
    }
    .items-table th:first-child,
    .items-table td:first-child {
      border-left: var(--table-border-width) solid #000;
    }
    .items-table th {
      border-top: var(--table-border-width) solid #000;
      background: #fff;
      text-align: left;
      font-weight: bold;
      font-size: 9.5pt;
    }
    .items-table .item-description {
      font-size: 9.5pt;
      line-height: 1.35;
    }
    .cell-center {
      text-align: center;
    }
    .cell-money {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .item-total {
      font-weight: bold;
    }
    .totals-section {
      margin-top: 8px;
      margin-left: auto;
      width: 50%;
      break-inside: avoid;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      gap: 3mm;
      padding: 1.5mm 2mm;
      font-size: 11pt;
      border-bottom: 1px solid #ddd;
    }
    .totals-row.total {
      font-weight: bold;
      font-size: 13pt;
      border-bottom: 2px solid #000;
      border-top: 2px solid #000;
      padding: 2mm;
    }
    .bank-section {
      margin: 10px 0;
      padding: 3mm;
      border: 1px solid #999;
      background: #f8f8f8;
      font-size: 10pt;
      break-inside: avoid;
    }
    .bank-title {
      font-weight: bold;
      margin-bottom: 4px;
      font-size: 10.5pt;
    }
    .bank-row {
      margin: 2px 0;
      font-size: 10pt;
    }
    .bank-row strong {
      display: inline-block;
      width: 28mm;
    }
    .notes-section {
      margin: 8px 0;
      padding: 2mm;
      background: #fffacd;
      border: 1px solid #daa520;
      font-size: 10pt;
      line-height: 1.4;
      min-height: 25px;
      overflow-wrap: anywhere;
      break-inside: avoid;
    }
    .footer {
      margin-top: 15px;
      display: flex;
      justify-content: space-between;
      gap: 15px;
      break-inside: avoid;
    }
    .signature-block {
      flex: 1;
      text-align: center;
      font-size: 10pt;
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
      z-index: 100;
    }
    .watermark {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: 0;
    }
    .watermark::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image: url('${LOGO_URL}');
      background-repeat: repeat;
      background-size: 180px auto;
      background-position: center;
      opacity: 0.03;
      transform: rotate(-30deg) scale(1.5);
      transform-origin: center;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      html, body { 
        width: 100%;
        height: auto;
        margin: 0;
        padding: 0;
        background: #fff;
      }
      .container {
        width: auto;
        min-height: 273mm;
        margin: 0;
        /* Leave room for edge rounding when Chromium fragments the page for printing. */
        padding: 0 0.5mm 0 0;
        position: relative;
      }
    }
    @media print and (min-resolution: 72dpi) and (max-resolution: 150dpi) {
      body {
        font-family: 'Courier New', Courier, monospace;
      }
      .items-table {
        --table-border-width: 2px;
      }
      .company-address,
      .company-contact {
        color: #000;
      }
      .bill-to-content,
      .bank-row {
        color: #000;
      }
      .totals-row {
        border-color: #000;
      }
      .totals-row.total {
        border-width: 2px;
      }
      .notes-section {
        color: #000;
        background: #fff;
        border: 2px solid #000;
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
        z-index: 100;
      }
      .watermark::before {
        opacity: 0.05;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="container" style="position: relative;">
    <div class="watermark" aria-hidden="true"></div>
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
    </div>

    <div class="content">
      <div class="billing-header">
        <div class="bill-to">
          <div class="bill-to-label">TAGIHAN KEPADA:</div>
          <div class="bill-to-content">
            <strong>${inv.customer_name}</strong><br>
            Tgl: ${formatDate(inv.issued_at)}
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

      <table class="items-table">
        <colgroup>
          <col style="width: 10%;">
          <col style="width: 20%;">
          <col style="width: 6%;">
          <col style="width: 9%;">
          <col style="width: 14%;">
          <col style="width: 14%;">
          <col style="width: 13%;">
          <col style="width: 14%;">
        </colgroup>
        <thead>
          <tr>
            <th>No. SPB</th>
            <th>Deskripsi / Penerima</th>
            <th>Colli</th>
            <th>Qty / Unit</th>
            <th>Tagihan</th>
            <th>Biaya Lain</th>
            <th>PPh</th>
            <th>Total</th>
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
        ${totals.discount ? `<div class="totals-row"><div>Diskon Invoice</div><div>-${formatRupiah(totals.discount)}</div></div>` : ''}
        ${inv.pph_percent ? `<div class="totals-row">
          <div>PPh (${inv.pph_percent}%)</div>
          <div>-${formatRupiah(pphAmount)}</div>
        </div>` : ''}
        <div class="totals-row total">
          <div>TOTAL</div>
          <div>${formatRupiah(grand)}</div>
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

  if (win.closed) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  await Promise.all(Array.from(win.document.images).map(img => img.complete ? Promise.resolve() : new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve(); })));
  await win.document.fonts?.ready;
  if (!win.closed) { win.focus(); win.print(); }
  } catch (error) {
    printError.value = error instanceof Error ? error.message : 'Gagal menyiapkan cetak invoice.';
    if (!win.closed) win.close();
  } finally { printingInvoiceId.value = null; }
}

async function printInvoiceReceipt(inv: Invoice): Promise<void> {
  if (printingInvoiceId.value !== null) return;
  printError.value = '';
  const win = window.open('', '_blank');
  if (!win) {
    printError.value = 'Jendela cetak diblokir. Izinkan popup untuk aplikasi ini, lalu coba lagi.';
    return;
  }
  win.document.body.textContent = 'Menyiapkan tanda terima untuk dicetak...';
  printingInvoiceId.value = inv.id;

  try {
    const company = await getCompany();
    const escapeHtml = (value: unknown): string => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const companyName = escapeHtml(company?.name || 'SUMBER TRANS EXPRESS');
    const contact = escapeHtml([company?.phone, company?.email].filter(Boolean).join(' | '));
    const invoiceNumber = escapeHtml(inv.invoice_number);
    const customerName = escapeHtml(inv.customer_name);
    const amountDisplay = escapeHtml(formatRupiah(inv.amount || 0));
    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tanda Terima ${invoiceNumber}</title>
  <style>
    @page { size: 9.5in 5.5in; margin: 8mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #151515; line-height: 1.35; }
    body { background: #edf1f5; }
    .sheet {
      width: 9.5in;
      min-height: 5.5in;
      margin: 20px auto;
      padding: 8mm 10mm;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .letterhead {
      display: flex;
      align-items: center;
      gap: 5mm;
      padding-bottom: 2mm;
      margin-bottom: 3mm;
      border-bottom: 1mm double #173b63;
      break-inside: avoid;
    }
    .brand-logo { display: block; width: 28mm; height: 28mm; object-fit: contain; flex-shrink: 0; }
    .company-details { flex: 1; min-width: 0; text-align: center; }
    .company-name { color: #173b63; font-size: 19pt; font-weight: 800; line-height: 1.1; text-transform: uppercase; overflow-wrap: anywhere; }
    .service-banner {
      margin: 1.5mm 0 1mm;
      padding: 0.6mm 1mm;
      background: #c62e3d;
      color: #fff;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.4pt;
    }
    .service-area { color: #173b63; font-size: 7.5pt; font-weight: 700; }
    .company-address, .company-contact { margin-top: 1mm; font-size: 7pt; overflow-wrap: anywhere; }
    .company-address { white-space: pre-line; }
    .receipt-intro { display: flex; justify-content: space-between; gap: 8mm; margin-bottom: 3mm; break-inside: avoid; }
    .recipient { flex: 1; min-width: 0; padding-top: 1mm; }
    .recipient-name { margin-top: 1mm; font-weight: 700; overflow-wrap: anywhere; }
    .receipt-heading { flex: 1; min-width: 0; text-align: right; }
    .receipt-title { font-size: 14pt; font-weight: 700; letter-spacing: 0.4pt; }
    .receipt-number { margin-top: 1mm; font-size: 8pt; overflow-wrap: anywhere; }
    .receipt-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 9pt; break-inside: avoid; }
    .receipt-table th, .receipt-table td { border: 0.3mm solid #454545; padding: 2mm 2.5mm; overflow-wrap: anywhere; }
    .receipt-table th { background: #3487a9; color: #fff; font-weight: 700; text-align: center; }
    .receipt-table tbody td { height: 10mm; }
    .number-column { width: 7%; }
    .date-column { width: 25%; }
    .recipient-column { width: 40%; }
    .amount-column { width: 28%; }
    .center { text-align: center; }
    .money { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .total-label { text-align: right; font-weight: 700; }
    .receipt-table tfoot td { background: #f1f5f7; font-weight: 700; }
    .signatures { display: flex; justify-content: space-between; gap: 12mm; margin-top: 5mm; break-inside: avoid; }
    .signature { width: 65mm; max-width: 45%; text-align: center; }
    .signature-space { height: 12mm; }
    .signature-company { font-weight: 700; text-decoration: underline; overflow-wrap: anywhere; }
    .signature-line { display: flex; justify-content: space-between; }
    @media print {
      body { background: #fff; }
      .sheet { width: 100%; min-height: 0; margin: 0; padding: 0; }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <header class="letterhead">
      <img class="brand-logo" src="${LOGO_URL}" alt="Logo ${companyName}">
      <div class="company-details">
        <div class="company-name">${companyName}</div>
        <div class="service-banner">MELAYANI PENGIRIMAN VIA DARAT, LAUT &amp; UDARA</div>
        <div class="service-area">JAKARTA &middot; BALI &middot; LOMBOK &middot; SUMBAWA &middot; SUMATRA &middot; KALIMANTAN</div>
        <div class="service-area">SULAWESI DAN SELURUH WILAYAH INDONESIA</div>
        ${company?.address ? `<div class="company-address">${escapeHtml(company.address)}</div>` : ''}
        ${contact ? `<div class="company-contact">${contact}</div>` : ''}
      </div>
    </header>

    <section class="receipt-intro">
      <div class="recipient">
        <div>Kepada Yth,</div>
        <div class="recipient-name">${customerName}</div>
      </div>
      <div class="receipt-heading">
        <h1 class="receipt-title">TANDA TERIMA INVOICE</h1>
        <div class="receipt-number">No. Invoice: ${invoiceNumber}</div>
      </div>
    </section>

    <table class="receipt-table" aria-label="Rincian tanda terima invoice">
      <colgroup>
        <col class="number-column">
        <col class="date-column">
        <col class="recipient-column">
        <col class="amount-column">
      </colgroup>
      <thead>
        <tr><th scope="col">No.</th><th scope="col">Tanggal Invoice</th><th scope="col">Penerima</th><th scope="col">Total Tagihan</th></tr>
      </thead>
      <tbody>
        <tr>
          <td class="center">1</td>
          <td class="center">${formatDate(inv.issued_at)}</td>
          <td>${customerName}</td>
          <td class="money">${amountDisplay}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr><td colspan="3" class="total-label">Total</td><td class="money">${amountDisplay}</td></tr>
      </tfoot>
    </table>

    <footer class="signatures">
      <div class="signature">
        <div>Hormat Kami,</div>
        <div class="signature-space"></div>
        <div class="signature-company">${companyName}</div>
      </div>
      <div class="signature">
        <div>Yang Menerima,</div>
        <div class="signature-space"></div>
        <div class="signature-line"><span>(</span><span>)</span></div>
      </div>
    </footer>
  </main>
</body>
</html>`;

    if (win.closed) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    await Promise.all(Array.from(win.document.images).map(img => img.complete ? Promise.resolve() : new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve(); })));
    await win.document.fonts?.ready;
    if (!win.closed) { win.focus(); win.print(); }
  } catch (error) {
    printError.value = error instanceof Error ? error.message : 'Gagal menyiapkan cetak tanda terima.';
    if (!win.closed) win.close();
  } finally {
    printingInvoiceId.value = null;
  }
}

watch([items, pphPercent, discountAmount], () => {
}, { deep: true, immediate: false });

watch(() => invoiceFilterType.value, () => {
  selectedShipmentIds.value.clear();
  items.value = [];
  sjBulkInputStatus.value = '';
  addInvoiceTab.value = 'unpaid';
  form.value.customer_name = '';
  form.value.customer_id = null;
  selectedDblNumber.value = '';
  spbSearch.value = '';
  showUnreturnedOnly.value = false;
});

watch(() => createPaymentType.value, (val) => {
  if (val === 'CICILAN') manualAmountMode.value = true;
});
const initialInvoiceForm = ref('');
function invoiceFormSnapshot() {
  return JSON.stringify({ form: form.value, items: items.value, notes: notes.value, discount: discountAmount.value, pph: pphPercent.value, payment: createPaymentType.value, sj: sjBulkInputStatus.value });
}
watch(showModal, async open => { if (open) { await nextTick(); initialInvoiceForm.value = invoiceFormSnapshot(); } });
function closeInvoiceModal() {
  if (savingInvoice.value) return;
  if (initialInvoiceForm.value && invoiceFormSnapshot() !== initialInvoiceForm.value && !confirm('Perubahan invoice belum disimpan. Tutup tanpa menyimpan?')) return;
  showModal.value = false;
}
</script>

<template>
  <div class="space-y-4 pb-20 lg:pb-0">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="text-xl font-semibold dark:text-gray-100">
          Invoice
        </div>
      <div class="flex items-center gap-2 flex-1 justify-end min-w-0">
        <div class="flex gap-2 flex-1 lg:flex-initial min-w-0">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari nomor invoice, customer..."
            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 dark:border-gray-600"
          >
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="primary"
            class="text-sm px-3 lg:px-4"
            data-testid="btn-tambah"
            @click="openCreateModal"
          >
            <Icon
              icon="mdi:plus"
              class="text-base lg:text-lg"
            />
            <span class="hidden sm:inline">Tambah</span>
          </Button>
          <Button
            variant="warning"
            class="text-sm px-3 lg:px-4"
            data-testid="btn-cicilan"
            @click="openCicilanModal"
          >
            <Icon
              icon="mdi:cash-multiple"
              class="text-base lg:text-lg"
            />
            <span class="hidden sm:inline">Cicilan</span>
          </Button>
        </div>
      </div>
    </div>

    <div
      v-if="loading"
      class="flex items-center justify-center h-64"
    >
      <div class="text-gray-500">
        Loading...
      </div>
    </div>

    <p v-if="printError" role="alert" class="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-200">{{ printError }}</p>
    <p v-if="printingInvoiceId !== null" role="status" class="text-sm">Menyiapkan invoice untuk dicetak...</p>
    <!-- Desktop Table View -->
    <div
      v-if="!loading"
      class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden card hidden lg:block transition-all duration-200"
    >
      <table class="w-full table-fixed invoice-list-table">
        <colgroup><col style="width:19%"><col style="width:19%"><col style="width:17%"><col style="width:17%"><col style="width:14%"><col style="width:14%"></colgroup>
        <thead class="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <tr><th>Invoice / SPB</th><th>Pelanggan</th><th class="text-right">Tagihan</th><th class="text-right">Pembayaran</th><th>Status / SJ</th><th>Aksi</th></tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-if="filteredInvoices.length === 0"><td colspan="6" class="py-8 text-center">Belum ada invoice</td></tr>
          <tr v-for="inv in filteredInvoices" :key="inv.id">
            <td>
              <div class="font-semibold text-gray-900 dark:text-gray-100">{{ inv.invoice_number }}</div>
              <div class="mt-1 text-sm">SPB: {{ inv.spb_number || '-' }}</div>
              <div class="mt-1 text-xs text-gray-500">{{ formatDate(inv.issued_at) }}</div>
            </td>
            <td class="text-gray-900 dark:text-gray-100">{{ inv.customer_name }}</td>
            <td class="text-right">
              <div class="font-semibold">{{ formatRupiah(inv.discount_amount && inv.discount_amount > 0 && inv.subtotal ? inv.subtotal : inv.amount) }}</div>
              <div v-if="inv.discount_amount && inv.discount_amount > 0" class="mt-1 text-xs text-red-600">Diskon: -{{ formatRupiah(inv.discount_amount) }}</div>
              <div v-if="inv.pph_percent && inv.pph_percent > 0" class="mt-1 text-xs text-gray-500">PPh {{ inv.pph_percent }}%: -{{ formatRupiah(inv.pph_amount || 0) }}</div>
            </td>
            <td class="text-right">
              <div class="text-xs text-gray-500">Dibayar</div><div class="text-green-600">{{ formatRupiah(inv.paid_amount || 0) }}</div>
              <div class="mt-2 text-xs text-gray-500">Sisa tagihan</div><div class="font-semibold text-orange-600">{{ formatRupiah(inv.remaining_amount ?? inv.amount) }}</div>
            </td>
            <td>
              <div class="invoice-status"><Badge :variant="getPaymentStatus(inv).variant">{{ getPaymentStatus(inv).label }}</Badge></div>
              <div class="invoice-status mt-2"><Badge :variant="getSjStatus(inv).variant">{{ getSjStatus(inv).label }}</Badge></div>
              <div v-if="inv.sj_pending_count && inv.sj_pending_count > 0" class="mt-1 text-xs text-gray-500">{{ inv.sj_pending_count }} belum balik</div>
            </td>
            <td>
              <div class="flex flex-col gap-2 invoice-actions">
                <Button v-if="(inv.remaining_amount ?? inv.amount) > 0" size="sm" @click="openPaymentModal(inv)">Bayar</Button>
                <Button size="sm" variant="default" :disabled="printingInvoiceId !== null" @click="printInvoice(inv)">Cetak</Button>
                <details>
                  <summary class="cursor-pointer rounded-lg px-2 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Lainnya</summary>
                  <div class="mt-2 flex flex-col gap-2">
                    <Button size="sm" variant="default" @click="openEditModal(inv)">Edit</Button>
                    <Button size="sm" variant="default" @click="openPphModal(inv)">PPh</Button>
                    <Button size="sm" variant="default" :disabled="printingInvoiceId !== null" @click="printInvoiceReceipt(inv)">Tanda Terima</Button>
                    <Button size="sm" variant="danger" @click="deleteInvoice(inv)">Hapus</Button>
                  </div>
                </details>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
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
              {{ formatRupiah(inv.discount_amount && inv.discount_amount > 0 && inv.subtotal ? inv.subtotal : inv.amount) }}
              <div v-if="inv.discount_amount && inv.discount_amount > 0" class="text-xs text-red-600 dark:text-red-400 font-normal">
                Diskon: -{{ formatRupiah(inv.discount_amount) }}
              </div>
              <div v-if="inv.pph_percent && inv.pph_percent > 0" class="text-xs text-gray-500 font-normal">
                PPh {{ inv.pph_percent }}%: -{{ formatRupiah(inv.pph_amount || 0) }}
              </div>
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
            :disabled="printingInvoiceId !== null"
            @click="printInvoice(inv)"
          >
            Cetak
          </Button>
          <Button
            block
            variant="default"
            class="text-gray-700"
            :disabled="printingInvoiceId !== null"
            @click="printInvoiceReceipt(inv)"
          >
            T. Terima
          </Button>
          <Button
            v-if="inv.status !== 'paid'"
            block
            variant="default"
            class="text-red-600 hover:text-red-700 bg-red-50 dark:bg-red-900/20"
            @click="deleteInvoice(inv)"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>

    <div
      v-if="!loading && pagination.total > 0"
      class="flex items-center justify-between gap-3 flex-wrap bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3"
    >
      <div class="text-xs text-gray-500 dark:text-gray-400">
        Menampilkan {{ pageStart }}-{{ pageEnd }} dari {{ pagination.total }} invoice
      </div>
      <div class="flex items-center gap-2">
        <Button variant="default" size="sm" :disabled="!canPrevPage" @click="prevPage">Sebelumnya</Button>
        <div class="text-xs text-gray-600 dark:text-gray-300">Hal {{ pagination.page }} / {{ pagination.pages }}</div>
        <Button variant="default" size="sm" :disabled="!canNextPage" @click="nextPage">Berikutnya</Button>
      </div>
    </div>

    <div
      v-if="showCicilanModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      data-testid="cicilan-modal"
      @click.self="showCicilanModal = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-7xl space-y-4 card overflow-auto max-h-[85vh]">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="text-lg font-semibold dark:text-gray-100">Cicilan / Pelunasan Invoice</div>
          <Button variant="default" @click="showCicilanModal = false">Tutup</Button>
        </div>

        <div class="flex gap-2 items-center">
          <button
            type="button"
            @click="() => { cicilanFilterType = 'semua'; cicilanCustomerKey = ''; }"
            :class="[
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              cicilanFilterType === 'semua'
                ? 'bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            ]"
            :disabled="cicilanBusy"
          >
            Semua
          </button>
          <button
            type="button"
            @click="() => { cicilanFilterType = 'penerima'; cicilanCustomerKey = ''; }"
            :class="[
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              cicilanFilterType === 'penerima'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-600'
            ]"
            :disabled="cicilanBusy"
          >
            <Icon icon="mdi:package-variant-closed" class="inline-block mr-1 text-base" />
            Penerima
          </button>
          <button
            type="button"
            @click="() => { cicilanFilterType = 'pengirim'; cicilanCustomerKey = ''; }"
            :class="[
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              cicilanFilterType === 'pengirim'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-gray-600'
            ]"
            :disabled="cicilanBusy"
          >
            <Icon icon="mdi:truck-delivery" class="inline-block mr-1 text-base" />
            Pengirim
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div class="sm:col-span-2">
            <label class="block text-sm font-medium mb-1 dark:text-gray-300">Customer</label>
            <select v-model="cicilanCustomerKey" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100" :disabled="cicilanBusy">
              <option value="">-- Pilih Customer --</option>
              <option v-for="c in cicilanCustomerOptions" :key="c.key" :value="c.key">
                {{ c.customer_name }} ({{ c.invoice_count }} inv / {{ formatRupiah(c.total_remaining) }})
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1 dark:text-gray-300">Cari (opsional)</label>
            <input
              v-model="cicilanSearch"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100 text-sm"
              placeholder="Invoice/SPB/catatan..."
              :disabled="cicilanBusy"
            >
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label class="block text-sm font-medium mb-1 dark:text-gray-300">Tanggal</label>
            <input v-model="cicilanPaymentDate" type="date" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1 dark:text-gray-300">Metode</label>
            <select v-model="cicilanPaymentType" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100">
              <option value="CASH_BALI">Cash Bali</option>
              <option value="CASH_JAKARTA">Cash Jakarta</option>
              <option value="TF_BALI">Tf Bali</option>
              <option value="TF_JAKARTA">Tf Jakarta</option>
              <option value="TRANSFER_ALI">Transfer Ali</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1 dark:text-gray-300">No. Referensi (opsional)</label>
            <input v-model="cicilanReferenceNo" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100" placeholder="No. transfer/giro" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-300">Catatan (opsional)</label>
          <input v-model="cicilanNotes" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100" placeholder="Catatan pembayaran" />
        </div>

        <div class="flex items-center justify-between gap-3 flex-wrap bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
          <div class="text-sm text-gray-700 dark:text-gray-200">
            <span class="font-medium">Total sisa:</span> {{ formatRupiah(cicilanCustomerOutstandingTotal) }}
            <span class="text-gray-500 dark:text-gray-400">({{ cicilanCustomerInvoices.length }} invoice / {{ cicilanCustomerSpbCount }} SPB)</span>
            <div v-if="cicilanHasSearch" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Filter: {{ formatRupiah(cicilanTotalOutstanding) }} ({{ filteredCicilanInvoices.length }} invoice / {{ cicilanFilteredSpbCount }} SPB)
            </div>
            <div v-if="cicilanSelectedInvoices.length" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Dipilih: {{ cicilanSelectedInvoices.length }} invoice / {{ cicilanSelectedSpbCount }} SPB ({{ formatRupiah(cicilanSelectedOutstandingTotal) }})
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="default" :disabled="cicilanBusy" @click="loadAllUnpaidInvoices">Refresh</Button>
            <Button
              variant="success"
              :disabled="cicilanBusy || !selectedCicilanCustomer || cicilanCustomerInvoices.length === 0"
              @click="settleCicilanForSelectedCustomer"
            >
              Lunasi Semua (Per Invoice)
            </Button>
            <Button
              v-if="cicilanSelectedInvoices.length"
              variant="warning"
              :disabled="cicilanBusy"
              @click="bulkSettleCicilanSelectedInvoices"
            >
              Gabung Terpilih (1 Invoice)
            </Button>
            <Button
              variant="warning"
              :disabled="cicilanBusy || !selectedCicilanCustomer || cicilanCustomerInvoices.length === 0"
              @click="bulkSettleCicilanAllInvoices"
            >
              Bulk Semua (Gabung 1 Invoice)
            </Button>
          </div>
        </div>

        <div v-if="loadingCicilan" class="text-center py-4 text-gray-500 dark:text-gray-400">
          <span class="animate-pulse">Memuat invoice yang belum lunas...</span>
        </div>
        <div v-else-if="allUnpaidInvoices.length === 0" class="text-center py-4 text-gray-400 dark:text-gray-500">
          Tidak ada invoice yang belum lunas
        </div>
        <div v-else-if="selectedCicilanCustomer && filteredCicilanInvoices.length === 0" class="text-center py-4 text-gray-400 dark:text-gray-500">
          Tidak ada invoice yang belum lunas untuk customer ini
        </div>
        <div v-else class="overflow-x-auto max-h-72 overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700 sticky top-0">
              <tr>
                <th class="px-2 py-2 text-left text-xs font-medium dark:text-gray-300 w-8">
                  <input
                    type="checkbox"
                    :checked="cicilanAllEligibleSelected"
                    :disabled="cicilanBusy || cicilanEligibleInvoices.length === 0"
                    @change="onCicilanSelectAllChange"
                  >
                </th>
                <th class="px-2 py-2 text-left text-xs font-medium dark:text-gray-300">No. Invoice</th>
                <th class="px-2 py-2 text-left text-xs font-medium dark:text-gray-300">No. SPB</th>
                <th class="px-2 py-2 text-right text-xs font-medium dark:text-gray-300">Sisa</th>
                <th class="px-2 py-2 text-left text-xs font-medium dark:text-gray-300">Status</th>
                <th class="px-2 py-2 text-left text-xs font-medium dark:text-gray-300">Tanggal</th>
                <th class="px-2 py-2 text-right text-xs font-medium dark:text-gray-300">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="inv in filteredCicilanInvoices" :key="`unpaid-${inv.id}`" class="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td class="px-2 py-2">
                  <input
                    type="checkbox"
                    :checked="cicilanSelectedInvoiceIds.has(inv.id)"
                    :disabled="cicilanBusy || !isCicilanEligibleForBulk(inv)"
                    @change="(e) => onCicilanInvoiceSelectionChange(inv.id, e)"
                  >
                </td>
                <td class="px-2 py-2 font-medium dark:text-gray-100">{{ inv.invoice_number }}</td>
                <td class="px-2 py-2 text-xs dark:text-gray-300">{{ inv.spb_number || '-' }}</td>
                <td class="px-2 py-2 text-right text-orange-600 dark:text-orange-400">{{ formatRupiah(inv.remaining_amount ?? inv.amount) }}</td>
                <td class="px-2 py-2">
                  <Badge :variant="getPaymentStatus(inv).variant">{{ getPaymentStatus(inv).label }}</Badge>
                </td>
                <td class="px-2 py-2 text-xs text-gray-600 dark:text-gray-400">{{ formatDate(inv.issued_at) }}</td>
                <td class="px-2 py-2 text-right">
                  <button
                    class="px-2 py-1 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded transition-colors"
                    @click="() => { showCicilanModal = false; openPaymentModal(inv); }"
                  >
                    Bayar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div
      v-if="showModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="closeInvoiceModal"
    >
      <div
      v-dialog="closeInvoiceModal" aria-label="Form invoice"
      class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden card dark:text-gray-100"
    >
        <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-lg font-semibold dark:text-gray-100">
              {{ editingId ? 'Edit Invoice' : 'Tambah Invoice' }}
            </div>
            <div v-if="!editingId" class="text-xs text-gray-500 dark:text-gray-400">
              Pilih customer → pilih SPB → cek ringkasan → simpan.
            </div>
            <div v-else class="text-xs text-gray-500 dark:text-gray-400">
              Ubah item/biaya lalu update. Pembayaran dilakukan lewat tombol "Bayar" di list invoice.
            </div>
          </div>
          <Button variant="default" @click="closeInvoiceModal">Tutup</Button>
        </div>

        <div class="flex-1 overflow-auto p-4">
          <div class="grid grid-cols-12 gap-4">
            <div class="col-span-12 lg:col-span-8 space-y-4">
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
          
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
            <div class="sm:col-span-2 space-y-2">
              <div>
                <label class="block text-sm font-medium mb-1 dark:text-gray-200">Customer</label>
                <select
                  v-model="selectedCustomerKey"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
                  @change="onCustomerChange"
                  :disabled="loadingUnpaidShipments"
                >
                  <option value="">-- Pilih Customer --</option>
                  <option v-for="c in uniqueCustomers" :key="c.key" :value="c.key">
                    {{ c.name }}
                  </option>
                </select>
              </div>
              <div v-if="!editingId">
                <label class="block text-sm font-medium mb-1 dark:text-gray-200">Filter DBL (opsional)</label>
                <select
                  v-model="selectedDblNumber"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
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
              <div v-if="loadingUnpaidShipments" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Memuat SPB yang belum dibayar...
              </div>
            </div>
            <div class="flex flex-col gap-3">
              <div v-if="!editingId">
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-sm font-medium dark:text-gray-200">Pembayaran Awal (Rp)</label>
                  <label class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 select-none">
                    <input
                      type="checkbox"
                      class="h-4 w-4"
                      v-model="manualAmountMode"
                      @change="() => { if (!manualAmountMode) form.amount = '' }"
                    />
                    Isi manual
                  </label>
                </div>
                <input
                  v-model="form.amount"
                  type="number"
                  min="0"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-70 disabled:cursor-not-allowed dark:text-gray-100"
                  :class="{ 'bg-gray-50': !manualAmountMode, 'bg-white': manualAmountMode, 'dark:bg-gray-700': !manualAmountMode, 'dark:bg-gray-800': manualAmountMode }"
                  inputmode="numeric"
                  placeholder="0"
                  :disabled="!manualAmountMode"
                >
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Opsional. Centang "Isi manual" jika ada pembayaran awal.</div>
              </div>
              <div v-else class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <div class="text-xs text-gray-600 dark:text-gray-400">Info Pembayaran (gunakan tombol Bayar)</div>
                <div class="text-sm font-medium text-green-600">Dibayar: {{ formatRupiah(existingPaidAmount) }}</div>
                <div class="text-sm font-medium text-orange-600">Sisa: {{ formatRupiah(Math.max(0, calcTotal() - existingPaidAmount)) }}</div>
              </div>
              <div v-if="!editingId">
                <label class="block text-sm font-medium mb-1 dark:text-gray-200">Status</label>
                <select
                  v-model="createPaymentType"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="CASH_BALI">Cash Bali</option>
                  <option value="CASH_JAKARTA">Cash Jakarta</option>
                  <option value="TF_BALI">Tf Bali</option>
                  <option value="TF_JAKARTA">Tf Jakarta</option>
                  <option value="TRANSFER_ALI">Transfer Ali</option>
                  <option value="CICILAN">Cicilan</option>
                </select>
              </div>
              <div v-if="!editingId" class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 space-y-2">
                <label for="invoice-sj-status" class="block text-sm font-medium dark:text-gray-200">Status SJ saat simpan</label>
                <select
                  id="invoice-sj-status"
                  v-model="sjBulkInputStatus"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>-- Pilih Status SJ --</option>
                  <option value="returned">Sudah balik</option>
                  <option value="not_returned">Belum balik</option>
                </select>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Berlaku ke semua SPB terpilih saat simpan invoice.
                </p>
                <div class="grid grid-cols-2 gap-2 text-xs">
                  <div class="rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40 px-2 py-1.5">
                    <div class="text-gray-500 dark:text-gray-400">Sudah balik</div>
                    <div class="font-semibold text-green-600 dark:text-green-400">{{ sjSaveSummary.returned }}</div>
                  </div>
                  <div class="rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40 px-2 py-1.5">
                    <div class="text-gray-500 dark:text-gray-400">Belum balik</div>
                    <div class="font-semibold text-amber-600 dark:text-amber-400">{{ sjSaveSummary.pending }}</div>
                  </div>
                </div>
                <p v-if="!sjBulkInputStatus" class="text-xs text-gray-500 dark:text-gray-400">
                  Pilih status SJ untuk mengaktifkan tombol simpan.
                </p>
              </div>
            </div>
          </div>
          <div v-if="editingId">
            <label class="block text-sm font-medium mb-2 dark:text-gray-200">Daftar SPB</label>
            <div class="overflow-x-auto">
              <table class="w-full text-sm dark:text-gray-100">
                <thead class="bg-gray-50 dark:bg-gray-700">
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
                        <div class="text-gray-500 dark:text-gray-400">{{ it.tracking_code || '-' }}</div>
                    <div v-if="it.dbl_number" class="text-gray-500 dark:text-gray-400">
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
                        <div class="text-gray-500 dark:text-gray-400">{{ it.destination_city || '-' }}</div>
                      </div>
                    </td>
                    <td class="px-2 py-2 text-center">
                      <Badge :variant="it.sj_returned ? 'success' : 'warning'">
                        {{ it.sj_returned ? 'Sudah' : 'Belum' }}
                      </Badge>
                    </td>
                    <td class="px-2 py-2 text-right text-xs font-semibold">
                      {{ formatRupiah(it.unit_price || 0) }}
                    </td>
                    <td class="px-2 py-2 text-right text-xs">
                      <input
                        v-model.number="it.other_fee"
                        type="number"
                        min="0"
                        class="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-100"
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
        </div>
        <div class="col-span-12 lg:col-span-4 space-y-4">
          <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3 bg-white dark:bg-gray-800">
            <div>
              <label class="block text-sm font-medium mb-1 dark:text-gray-200">PPh Rate (%)</label>
              <input
                v-model.number="pphPercent"
                type="number"
                step="0.1"
                min="0"
                max="100"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1 dark:text-gray-200">Diskon (Rp)</label>
              <input
                v-model.number="discountAmount"
                type="number"
                min="0"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-100"
                placeholder="0"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Potongan tambahan di luar diskon per item</p>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1 dark:text-gray-200">Catatan</label>
              <textarea
                v-model="notes"
                rows="2"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-100"
                placeholder="Catatan tambahan..."
              ></textarea>
            </div>
          </div>

          <div class="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 p-4 rounded-lg space-y-2">
            <div class="flex justify-between text-sm">
              <span class="dark:text-gray-300">Subtotal:</span>
              <span class="font-semibold dark:text-gray-100">{{ formatRupiah(calcSubtotal()) }}</span>
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
              <span class="dark:text-gray-100">Total Tagihan:</span>
              <span class="dark:text-gray-100">{{ formatRupiah(calcTotal()) }}</span>
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
        </div>
        <div v-if="!editingId" class="col-span-12 min-w-0 space-y-4">
          <div v-if="!editingId" class="flex items-center gap-2">
            <button
              type="button"
              @click="addInvoiceTab = 'unpaid'"
              :class="[
                'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                addInvoiceTab === 'unpaid'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              ]"
            >
              SPB Belum Dibayar
            </button>
            <button
              type="button"
              @click="addInvoiceTab = 'selected'"
              :class="[
                'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                addInvoiceTab === 'selected'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              ]"
            >
              SPB Terpilih ({{ items.length }})
            </button>
          </div>

          <div v-if="!editingId && addInvoiceTab === 'unpaid'" data-testid="invoice-unpaid-list" class="min-w-0">
            <div class="flex flex-wrap items-start justify-between gap-3 mb-2">
              <div class="space-y-1">
                <label class="block text-sm font-medium dark:text-gray-200">Daftar SPB yang belum dibayar</label>
                <div v-if="!editingId && allUnpaidShipments.length > 0" class="text-xs text-gray-500 mt-1 space-x-1">
                  <span>Total {{ allUnpaidShipments.length }} SPB belum dibayar.</span>
                  <span v-if="form.customer_name">Filter: {{ getFilteredUnpaidShipments().length }} SPB untuk "{{ form.customer_name }}"</span>
                <span v-if="selectedDblNumber">
                  | DBL: {{ selectedDblNumber === '__no_dbl' ? 'Belum ada DBL' : (selectedDblNumber.startsWith('DBL') ? selectedDblNumber : `DBL ${selectedDblNumber}`) }}
                </span>
                </div>
              </div>
              <div class="flex items-center gap-2 w-full sm:w-auto sm:flex-1 sm:max-w-md">
                <input
                  v-model="spbSearch"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
                  aria-label="Cari SPB"
                  placeholder="Cari: SPB, AWB, Kota, Penerima, Pengirim"
                  :disabled="loadingUnpaidShipments"
                >
              </div>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div class="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-300">
                <label class="flex items-center gap-2">
                  <input type="checkbox" v-model="showUnreturnedOnly" class="h-3 w-3" />
                  Hanya tampilkan SJ belum balik
                </label>
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="px-3 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs"
                  @click="selectAllFiltered"
                  :disabled="getFilteredUnpaidShipments().length === 0"
                >
                  Pilih Semua ({{ getFilteredUnpaidShipments().length }})
                </button>
                <button
                  type="button"
                  class="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded text-xs"
                  @click="deselectAll"
                  :disabled="selectedShipmentIds.size === 0"
                >
                  Hapus Semua ({{ selectedShipmentIds.size }})
                </button>
              </div>
            </div>
            <div v-if="loadingUnpaidShipments" class="text-center py-4 text-gray-500 dark:text-gray-400">
              <span class="animate-pulse">Memuat SPB yang belum dibayar...</span>
            </div>
            <div v-else-if="allUnpaidShipments.length === 0" class="text-center py-4 text-gray-400 dark:text-gray-500">
              Tidak ada SPB yang belum dibayar
            </div>
            <div v-else-if="form.customer_name && getFilteredUnpaidShipments().length === 0" class="text-center py-4 text-gray-400 dark:text-gray-500">
              Tidak ada SPB belum dibayar untuk customer ini
            </div>
            <div v-else-if="selectedDblNumber && getFilteredUnpaidShipments().length === 0" class="text-center py-4 text-gray-400 dark:text-gray-500">
              Tidak ada SPB untuk DBL ini
            </div>
            <div v-else class="overflow-auto max-h-[48vh] border border-gray-200 dark:border-gray-700 rounded-lg">
              <table class="w-full min-w-[960px] text-sm dark:text-gray-100">
                <thead class="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                  <tr>
                    <th class="px-2 py-2 text-center text-xs font-medium w-10"></th>
                    <th class="px-2 py-2 text-left text-xs font-medium">No. SPB / RESI</th>
                    <th class="px-3 py-2 text-left text-xs font-medium whitespace-nowrap">Tanggal SPB</th>
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
                    :key="`shipment-${it.shipment_id}-${idx}`"
                    class="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer align-top"
                    :class="{ 'bg-blue-50 dark:bg-blue-900/20': selectedShipmentIds.has(it.shipment_id!) }"
                    @click="toggleShipmentSelection(it.shipment_id!)"
                  >
                    <td class="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        :checked="selectedShipmentIds.has(it.shipment_id!)"
                        :aria-label="`Pilih SPB ${it.spb_number}`"
                        @click.stop="toggleShipmentSelection(it.shipment_id!)"
                        class="h-4 w-4"
                      />
                    </td>
                    <td class="px-2 py-2">
                      <div class="text-xs font-mono">
                        <div class="font-semibold text-blue-700 dark:text-blue-300">{{ it.spb_number || '-' }}</div>
                        <div class="text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ it.tracking_code || '-' }}</div>
                    <div v-if="it.dbl_number" class="text-gray-500 dark:text-gray-400">
                          DBL: {{ it.dbl_number.startsWith('DBL') ? it.dbl_number : `DBL ${it.dbl_number}` }}
                          <span v-if="it.driver_name" class="font-normal">| {{ it.driver_name }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="px-3 py-2 text-xs whitespace-nowrap text-gray-600 dark:text-gray-300">{{ formatShipmentDate(it.shipment_date) }}</td>
                    <td class="px-2 py-2">
                      <div class="text-xs">{{ it.customer_name || '-' }}</div>
                    </td>
                    <td class="px-2 py-2 text-xs">{{ it.description || '-' }}</td>
                    <td class="px-2 py-2 text-right text-xs">{{ it.quantity || 0 }}</td>
                    <td class="px-2 py-2">
                      <div class="text-xs">
                        <div>{{ it.recipient_name || '-' }}</div>
                        <div class="text-gray-500 dark:text-gray-400">{{ it.destination_city || '-' }}</div>
                      </div>
                    </td>
                    <td class="px-2 py-2 text-center">
                      <Badge :variant="it.sj_returned ? 'success' : 'warning'">
                        {{ it.sj_returned ? 'Sudah' : 'Belum' }}
                      </Badge>
                    </td>
                    <td class="px-2 py-2 text-right text-xs font-semibold whitespace-nowrap tabular-nums">
                      {{ formatRupiah(it.unit_price || 0) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div v-if="!editingId && addInvoiceTab === 'selected'" data-testid="invoice-selected-list" class="min-w-0">
            <label class="block text-sm font-medium mb-2 dark:text-gray-200">SPB Terpilih ({{ items.length }})</label>
            <div v-if="items.length === 0" class="text-center py-6 text-sm text-gray-400 dark:text-gray-500">
              Belum ada SPB terpilih. Pilih dari tab "SPB Belum Dibayar".
            </div>
            <div v-else class="overflow-auto max-h-[48vh] rounded-lg border border-gray-200 dark:border-gray-700">
              <table class="w-full min-w-[1200px] text-sm dark:text-gray-100">
                <thead class="bg-green-50 dark:bg-gray-700 sticky top-0 z-10">
                  <tr>
                    <th class="px-2 py-2 text-left text-xs font-medium">No. SPB / RESI</th>
                    <th class="px-3 py-2 text-left text-xs font-medium whitespace-nowrap">Tanggal SPB</th>
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
                    class="border-t dark:border-gray-700 align-top"
                  >
                    <td class="px-2 py-2">
                      <div class="text-xs font-mono">
                        <div>{{ it.spb_number || '-' }}</div>
                        <div class="text-gray-500 dark:text-gray-400">{{ it.tracking_code || '-' }}</div>
                    <div v-if="it.dbl_number" class="text-gray-500 dark:text-gray-400">
                          DBL: {{ it.dbl_number.startsWith('DBL') ? it.dbl_number : `DBL ${it.dbl_number}` }}
                          <span v-if="it.driver_name" class="font-normal">| {{ it.driver_name }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="px-3 py-2 text-xs whitespace-nowrap text-gray-600 dark:text-gray-300">{{ formatShipmentDate(it.shipment_date) }}</td>
                    <td class="px-2 py-2 text-xs">{{ it.customer_name || '-' }}</td>
                    <td class="px-2 py-2 text-xs">{{ it.description || '-' }}</td>
                    <td class="px-2 py-2 text-right text-xs">{{ it.weight || 0 }} {{ it.unit || 'Kg' }}</td>
                    <td class="px-2 py-2 text-right text-xs">{{ it.quantity || 0 }}</td>
                    <td class="px-2 py-2">
                      <div class="text-xs">
                        <div>{{ it.recipient_name || '-' }}</div>
                        <div class="text-gray-500 dark:text-gray-400">{{ it.destination_city || '-' }}</div>
                      </div>
                    </td>
                    <td class="px-2 py-2 text-center">
                      <Badge :variant="it.sj_returned ? 'success' : 'warning'">
                        {{ it.sj_returned ? 'Sudah' : 'Belum' }}
                      </Badge>
                    </td>
                    <td class="px-2 py-2 text-right text-xs font-semibold">
                      {{ formatRupiah(it.unit_price || 0) }}
                    </td>
                    <td class="px-2 py-2 text-right text-xs">
                      <input
                        v-model.number="it.other_fee"
                        type="number"
                        min="0"
                        class="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-100"
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
        </div>
      </div>
    </div>

    <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2 flex-wrap">
      <p v-if="!editingId" class="w-full text-sm text-gray-600 dark:text-gray-300">{{ items.length }} SPB dipilih. Buat invoice terpisah per SPB, atau gabungkan pilihan menjadi satu invoice.</p>
      <p
        v-if="invoiceSaveError"
        class="mr-auto text-sm text-red-600 dark:text-red-400"
        role="alert"
      >
        {{ invoiceSaveError }}
      </p>
      <Button variant="secondary" :disabled="savingInvoice" @click="closeInvoiceModal">Batal</Button>
      <Button
        v-if="!editingId"
        variant="success"
        :disabled="savingInvoice || items.length === 0 || !sjBulkInputStatus"
        :loading="savingInvoice && savingMode === 'bulk'"
        @click="saveInvoice('bulk')"
      >
        {{ savingInvoice && savingMode === 'bulk' ? 'Menyimpan...' : 'Gabungkan menjadi 1 Invoice' }}
      </Button>
      <Button
        variant="primary"
        :disabled="savingInvoice || (!editingId && (items.length === 0 || !sjBulkInputStatus))"
        :loading="savingInvoice && savingMode === 'single'"
        @click="saveInvoice('single')"
      >
        {{ savingInvoice && savingMode === 'single' ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Buat Invoice per SPB' }}
      </Button>
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
                      <option value="CASH BALI">Cash Bali</option>
                      <option value="CASH JAKARTA">Cash Jakarta</option>
                      <option value="TF BALI">Tf Bali</option>
                      <option value="TF JAKARTA">Tf Jakarta</option>
                      <option value="TRANSFER ALI">Transfer Ali</option>
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
