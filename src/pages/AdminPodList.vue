<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Button from '../components/ui/Button.vue';
import Badge from '../components/ui/Badge.vue';

type Photo = { pathname: string; url?: string; size: number; type: string }
interface PodItem { id: number; shipment_id: number; signed_at: string | null; photos: Photo[] }

const items = ref<PodItem[]>([]);
const loading = ref(false);
const errorMsg = ref('');
const syncing = ref(false);
const syncProgress = ref('');

async function load() {
  loading.value = true;
  errorMsg.value = '';
  const res = await fetch('/api/pod?endpoint=list');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    errorMsg.value = data.error || 'Gagal memuat POD';
  } else {
    items.value = data.items || [];
    const missingUrls = items.value.some(it => it.photos.some(p => !p.url));
    if (missingUrls) {
      syncProgress.value = 'Ada foto yang belum tersinkronisasi';
    }
  }
  loading.value = false;
}

async function syncUrls() {
  syncing.value = true;
  errorMsg.value = '';
  syncProgress.value = 'Memproses...';
  let totalProcessed = 0;
  let hasMore = true;
  
  while (hasMore && totalProcessed < 50) {
    const res = await fetch('/api/pod?endpoint=sync-urls&limit=5', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      errorMsg.value = data.error || 'Gagal sinkronisasi';
      break;
    }
    totalProcessed += data.processed || 0;
    syncProgress.value = `Diproses: ${totalProcessed} POD`;
    if ((data.processed || 0) < 5) {
      hasMore = false;
    }
  }
  
  syncProgress.value = hasMore ? `Selesai (masih ada yang belum): ${totalProcessed} POD` : `Selesai: ${totalProcessed} POD`;
  syncing.value = false;
  await load();
}

function viewUrl(p: Photo) {
  if (p.url) {
    try {
      // validate URL
      new URL(p.url);
      return p.url;
    } catch {
      console.warn('Invalid photo url in DB, fallback to proxy for pathname=', p.pathname, p.url);
      // fallback to pathname
    }
  }
  const q = new URLSearchParams({ pathname: p.pathname });
  return `/api/blob?endpoint=proxy&${q.toString()}`;
}

onMounted(load);
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div class="text-xl font-semibold">
        POD Terbaru
      </div>
      <div class="flex gap-2">
        <Button
          v-if="syncProgress"
          variant="secondary"
          :disabled="syncing"
          @click="syncUrls"
        >
          {{ syncing ? 'Sinkronisasi...' : 'Sinkronkan URL' }}
        </Button>
        <Button
          variant="default"
          @click="load"
        >
          Muat Ulang
        </Button>
      </div>
    </div>

    <div
      v-if="syncProgress"
      class="text-sm text-blue-600"
    >
      {{ syncProgress }}
    </div>

    <div
      v-if="errorMsg"
      class="text-sm text-red-600"
    >
      {{ errorMsg }}
    </div>
    <div
      v-if="loading"
      class="text-sm text-gray-500"
    >
      Memuat...
    </div>

    <div
      v-if="items.length"
      class="bg-white rounded-xl border border-gray-200 overflow-hidden card"
    >
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-gray-600">
          <tr>
            <th class="text-left px-4 py-3">
              POD ID
            </th>
            <th class="text-left px-4 py-3">
              Shipment
            </th>
            <th class="text-left px-4 py-3">
              Tanggal
            </th>
            <th class="text-left px-4 py-3">
              Foto
            </th>
            <th class="text-left px-4 py-3">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="it in items"
            :key="it.id"
            class="border-t"
          >
            <td class="px-4 py-3 font-medium">
              #{{ it.id }}
            </td>
            <td class="px-4 py-3">
              {{ it.shipment_id }}
            </td>
            <td class="px-4 py-3">
              {{ it.signed_at || '-' }}
            </td>
            <td class="px-4 py-3">
              <Badge variant="info">
                {{ it.photos.length }} foto
              </Badge>
            </td>
            <td class="px-4 py-3">
              <div class="flex gap-2">
                <a
                  v-for="(p,i) in it.photos"
                  :key="i"
                  :href="viewUrl(p)"
                  target="_blank"
                  class="text-primary underline"
                >Lihat {{ i+1 }}</a>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
