<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { useTheme } from '../../composables/useTheme';
import { useRouter, useRoute } from 'vue-router';
import { ref, computed } from 'vue';
import { useAuth } from '../../composables/useAuth';

const { preference, textSize, set, setTextSize } = useTheme();
const router = useRouter();
const route = useRoute();
const { permissions, clearUser } = useAuth();
const themeOptions = [
  { value: 'light', label: 'Tema terang', path: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z' },
  { value: 'dark', label: 'Tema gelap', path: 'M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z' },
  { value: 'system', label: 'Ikuti tema perangkat', path: 'M4 4h16v12H4zM8 20h8m-4-4v4' }
] as const;
const q = ref('');
const selectedType = ref('');
const searchTypes = computed(() => [
  ...(permissions.value.canViewKeuangan ? [{ value: 'invoice', label: 'Invoice' }] : []),
  ...(permissions.value.canViewSPB ? [{ value: 'barang-keluar', label: 'SPB' }] : []),
  ...(permissions.value.canViewPelacakan ? [{ value: 'pelacakan', label: 'Pelacakan' }] : [])
]);
const searchType = computed({
  get: () => searchTypes.value.some(t => t.value === selectedType.value) ? selectedType.value : searchTypes.value[0]?.value || '',
  set: value => { selectedType.value = value; }
});
function submitSearch() {
  if (q.value.trim() && searchType.value) router.push({ name: searchType.value, query: { q: q.value.trim() } });
}
async function logout() {
  try {
    const response = await fetch('/api/auth?endpoint=logout', { method: 'POST', credentials: 'include' });
    if (!response.ok) throw new Error('Logout failed');
    clearUser();
    router.push('/login');
  } catch { alert('Belum berhasil keluar. Silakan coba lagi.'); }
}
</script>

<template>
  <header class="min-h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3 px-4 lg:px-6 py-2 print:hidden">
    <form v-if="route.name === 'dashboard' && searchTypes.length" class="flex flex-1 min-w-0 items-center gap-2 basis-72" role="search" @submit.prevent="submitSearch">
      <label class="sr-only" for="global-search-type">Jenis dokumen</label>
      <select id="global-search-type" v-model="searchType" class="h-11 max-w-32 rounded-lg border border-gray-300 bg-gray-50 px-2 text-sm dark:border-gray-600 dark:bg-gray-700">
        <option v-for="item in searchTypes" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>
      <label class="sr-only" for="global-search">Cari dokumen</label>
      <input id="global-search" v-model="q" type="search" placeholder="Nomor dokumen atau pelanggan..." class="h-11 w-full min-w-0 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 px-3 text-sm">
      <button type="submit" aria-label="Cari dokumen" class="h-11 w-11 shrink-0 grid place-items-center rounded-lg bg-primary text-white dark:bg-blue-600"><Icon icon="mdi:magnify" class="text-xl" /></button>
    </form>
    <div class="ml-auto flex items-center gap-2">
      <div class="flex items-center rounded-full bg-gray-100/80 dark:bg-gray-900/70 p-1" role="group" aria-label="Tema tampilan">
        <button v-for="option in themeOptions" :key="option.value" type="button" :title="option.label" :aria-label="option.label" :aria-pressed="preference === option.value" class="grid h-10 w-10 place-items-center rounded-full transition-colors" :class="preference === option.value ? 'bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-blue-200' : 'text-gray-500 hover:bg-white/60 dark:text-gray-400 dark:hover:bg-gray-700/60'" @click="set(option.value)">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="option.path" /></svg>
        </button>
      </div>
      <button type="button" class="flex min-h-11 items-center gap-1.5 rounded-full px-3 transition-colors" :class="textSize === 'large' ? 'bg-blue-50 text-primary dark:bg-blue-900/40 dark:text-blue-200' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'" :aria-pressed="textSize === 'large'" :aria-label="textSize === 'large' ? 'Ukuran teks besar, ubah ke standar' : 'Ukuran teks standar, perbesar teks'" :title="textSize === 'large' ? 'Kembali ke ukuran standar' : 'Perbesar teks'" @click="setTextSize(textSize === 'large' ? 'standard' : 'large')">
        <span class="text-lg font-semibold leading-none" aria-hidden="true">Aa</span><span class="text-xs">{{ textSize === 'large' ? 'Besar' : 'Teks' }}</span>
      </button>
      <button type="button" class="lg:hidden min-h-11 rounded-full px-3 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" @click="logout">Keluar</button>
    </div>
  </header>
</template>
