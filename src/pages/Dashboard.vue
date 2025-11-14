<script setup lang="ts">
import { ref, onMounted } from 'vue';
import OverviewCard from '../components/dashboard/OverviewCard.vue';
import ProgressBar from '../components/ui/ProgressBar.vue';
import Badge from '../components/ui/Badge.vue';
import Button from '../components/ui/Button.vue';
import { useFormatters } from '../composables/useFormatters';

const { formatRupiah, formatDate } = useFormatters();

type Stats = {
  outgoingToday: number;
  activeShipments: number;
  pendingInvoices: number;
  deliveryNotes: number;
};

type Shipment = {
  id: number;
  public_code: string;
  origin: string;
  destination: string;
  status: string;
  carrier_name: string | null;
  driver_name: string | null;
};

type Invoice = {
  id: number;
  invoice_number: string;
  customer_name: string;
  amount: number;
  status: string;
  issued_at: string;
};

const stats = ref<Stats>({ outgoingToday: 0, activeShipments: 0, pendingInvoices: 0, deliveryNotes: 0 });
const tracking = ref<Shipment[]>([]);
const invoices = ref<Invoice[]>([]);
const loading = ref(true);

async function loadData() {
  try {
    const [statsRes, trackingRes, invoicesRes] = await Promise.all([
      fetch('/api/dashboard?endpoint=stats'),
      fetch('/api/dashboard?endpoint=tracking'),
      fetch('/api/dashboard?endpoint=invoices')
    ]);
    
    stats.value = await statsRes.json();
    const trackingData = await trackingRes.json();
    tracking.value = trackingData.items || [];
    const invoicesData = await invoicesRes.json();
    invoices.value = invoicesData.items || [];
  } catch (e) {
    console.error('Failed to load dashboard:', e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center h-64">
    <div class="text-gray-500">Loading...</div>
  </div>
  <div v-else class="space-y-6">
    <div class="text-xl font-semibold">Dashboard</div>
    <div class="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
      <OverviewCard
        title="Barang Keluar Hari Ini"
        :value="stats.outgoingToday"
        delta="+12.5% vs bulan lalu"
        icon="mdi:clipboard-text-outline"
      />
      <OverviewCard
        title="Pengiriman Aktif"
        :value="stats.activeShipments"
        delta="+8.2% vs bulan lalu"
        icon="mdi:truck-outline"
      />
      <OverviewCard
        title="Invoice Pending"
        :value="stats.pendingInvoices"
        delta="-3.1% vs bulan lalu"
        icon="mdi:receipt-text-outline"
      />
      <OverviewCard
        title="Surat Jalan"
        :value="stats.deliveryNotes"
        delta="+15.8% vs bulan lalu"
        icon="mdi:file-document-outline"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="font-medium mb-3">Tracking Pengiriman Terkini</div>
        <div v-if="tracking.length === 0" class="text-sm text-gray-500">Belum ada pengiriman aktif</div>
        <div v-else class="space-y-4">
          <div v-for="item in tracking" :key="item.id">
            <div class="text-sm font-medium">{{ item.public_code }}</div>
            <div class="text-xs text-gray-500">
              {{ item.driver_name || 'Driver' }} • {{ item.origin }} - {{ item.destination }}
            </div>
            <div class="mt-2"><ProgressBar :value="66" /></div>
            <div class="mt-2"><Badge variant="info">Dalam Perjalanan</Badge></div>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="font-medium mb-3">Invoice Terbaru</div>
        <div v-if="invoices.length === 0" class="text-sm text-gray-500">Belum ada invoice</div>
        <ul v-else class="divide-y">
          <li
            v-for="inv in invoices"
            :key="inv.id"
            class="py-3 flex items-center justify-between"
          >
            <div>
              <div class="text-sm font-medium">{{ inv.invoice_number }}</div>
              <div class="text-xs text-gray-500">{{ inv.customer_name }} • {{ formatDate(inv.issued_at) }}</div>
            </div>
            <div class="flex items-center gap-3">
              <div class="text-sm font-semibold">{{ formatRupiah(inv.amount) }}</div>
              <Badge :variant="inv.status === 'paid' ? 'success' : 'warning'">
                {{ inv.status === 'paid' ? 'Paid' : 'Pending' }}
              </Badge>
            </div>
          </li>
        </ul>
        <div class="mt-4 flex gap-2">
          <Button variant="primary">Tambah Invoice</Button>
          <Button variant="default">Lihat Semua</Button>
        </div>
      </div>
    </div>
  </div>
</template>
