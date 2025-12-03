<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { useTheme } from '../../composables/useTheme';
import { useRouter } from 'vue-router';
import { ref } from 'vue';

const { theme, toggle } = useTheme();
const router = useRouter();

defineEmits<{
  toggleSidebar: [];
}>();

const q = ref('');

function submitSearch() {
  const value = (q.value || '').trim();
  if (!value) return;
  // Simple heuristics: invoice numbers often contain "INV" or are long numeric strings
  const isInvoice = /(^INV|^inv|invoice)/i.test(value) || /^\d{6,}$/.test(value);
  const isSuratJalan = /(^SJ|^sj|surat)/i.test(value);
  if (isInvoice) {
    router.push({ name: 'invoice', query: { q: value } });
    return;
  }
  if (isSuratJalan) {
    router.push({ name: 'surat-jalan', query: { q: value } });
    return;
  }
  // Default: go to pelacakan (tracking)
  router.push({ name: 'pelacakan', query: { q: value } });
}

async function handleLogout() {
  try {
    await fetch('/api/auth?endpoint=logout', { method: 'POST', credentials: 'include' });
  } catch {
    // ignore errors client-side
  }
  router.push('/login');
}
</script>

<template>
  <header class="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 lg:px-6">
    <div class="flex-1 flex items-center gap-3">
      <div class="relative flex-1 max-w-xl">
        <input
          type="text"
          v-model="q"
          @keydown.enter="submitSearch"
          placeholder="Cari invoice, surat jalan, tracking..."
          class="w-full h-10 pl-10 pr-3 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500 text-sm dark:text-gray-100 dark:placeholder-gray-400"
        >
        <Icon
          role="button"
          :icon="'mdi:magnify'"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 cursor-pointer"
          @click="submitSearch"
        />
      </div>
    </div>
    <button
      class="h-10 w-10 grid place-items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 ml-2"
      :title="theme === 'dark' ? 'Light mode' : 'Dark mode'"
      @click="toggle()"
    >
      <Icon
        :icon="theme === 'dark' ? 'mdi:weather-sunny' : 'mdi:moon-waning-crescent'"
        class="text-[18px] dark:text-gray-200 transition-transform hover:scale-110"
      />
    </button>
    <button
      class="h-10 w-10 grid place-items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 ml-2"
      title="Logout"
      @click="handleLogout"
    >
      <Icon
        icon="mdi:logout"
        class="text-[18px] dark:text-gray-200"
      />
    </button>
  </header>
</template>
