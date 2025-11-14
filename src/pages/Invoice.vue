<script setup lang="ts">
import { ref, onMounted } from 'vue';
import CustomerAutocomplete from '../components/CustomerAutocomplete.vue';
import Button from '../components/ui/Button.vue';
import Badge from '../components/ui/Badge.vue';
import { useFormatters } from '../composables/useFormatters';
import { Icon } from '@iconify/vue';

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
};

type CreateInvoiceForm = {
  customer_name: string;
  customer_id: number | null;
  amount: string;
  status: string;
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

async function loadInvoices() {
  loading.value = true;
  try {
    const res = await fetch('/api/invoices?endpoint=list');
    const data = await res.json();
    invoices.value = data.items || [];
  } catch (e) {
    console.error('Failed to load invoices:', e);
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  editingId.value = null;
  form.value = { customer_name: '', customer_id: null, amount: '', status: 'pending' };
  showModal.value = true;
}

function openEditModal(invoice: Invoice) {
  editingId.value = invoice.id;
  form.value = {
    customer_name: invoice.customer_name,
    customer_id: invoice.customer_id,
    amount: String(invoice.amount),
    status: invoice.status
  };
  showModal.value = true;
}

async function saveInvoice() {
  const amount = parseFloat(form.value.amount);
  if ((!form.value.customer_name && !form.value.customer_id) || isNaN(amount)) {
    alert('Isi semua field dengan benar');
    return;
  }

  try {
    if (editingId.value) {
      const res = await fetch('/api/invoices?endpoint=update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId.value,
          customer_name: form.value.customer_name,
          customer_id: form.value.customer_id || undefined,
          amount,
          status: form.value.status
        })
      });
      if (!res.ok) throw new Error('Update failed');
    } else {
      const res = await fetch('/api/invoices?endpoint=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: form.value.customer_name,
          customer_id: form.value.customer_id || undefined,
          amount,
          status: form.value.status
        })
      });
      if (!res.ok) throw new Error('Create failed');
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
          <button @click="deleteInvoice(inv.id)" class="flex-1 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">Delete</button>
        </div>
      </div>
    </div>

    <div
      v-if="showModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="showModal = false"
    >
      <div class="bg-white rounded-xl p-6 w-full max-w-md space-y-4 card">
        <div class="text-lg font-semibold">
          {{ editingId ? 'Edit Invoice' : 'Tambah Invoice' }}
        </div>
        <div class="space-y-3">
          <CustomerAutocomplete v-model="form.customer_name" label="Customer" @selected="(c: { id: number; name: string }) => { form.customer_id = c.id; form.customer_name = c.name; }" />
          <div>
            <label class="block text-sm font-medium mb-1">Amount</label>
            <input
              v-model="form.amount"
              type="number"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
        <div class="flex gap-2 justify-end">
          <Button variant="default" @click="showModal = false">Batal</Button>
          <Button variant="primary" @click="saveInvoice">Simpan</Button>
        </div>
      </div>
    </div>
  </div>
</template>
