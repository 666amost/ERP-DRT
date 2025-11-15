<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Button from '../components/ui/Button.vue';
import Badge from '../components/ui/Badge.vue';

type Photo = { pathname: string; url?: string; size: number; type: string }
interface PodItem { id: number; shipment_id: number; signed_at: string | null; photos: Photo[] }

const items = ref<PodItem[]>([]);
const loading = ref(false);
const errorMsg = ref('');

async function load() {
  loading.value = true;
  errorMsg.value = '';
    const res = await fetch('/api/pod?endpoint=list');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    errorMsg.value = data.error || 'Gagal memuat POD';
  } else {
    items.value = data.items || [];
  }
  loading.value = false;
}

function viewUrl(p: Photo) {
  if (p.url) {
    try {
      // validate URL
      const _ = new URL(p.url);
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
      <Button
        variant="default"
        @click="load"
      >
        Muat Ulang
      </Button>
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
