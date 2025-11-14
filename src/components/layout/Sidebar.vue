<script setup lang="ts">
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { computed } from 'vue';
import { Icon } from '@iconify/vue';

type Item = { to: string; label: string; icon: string };

const items: Item[] = [
  { to: '/dashboard', label: 'Dasbor', icon: 'mdi:view-dashboard-outline' },
  { to: '/barang-keluar', label: 'Barang Keluar', icon: 'mdi:archive-arrow-down-outline' },
  { to: '/pelacakan', label: 'Pelacakan', icon: 'mdi:truck-outline' },
  { to: '/invoice', label: 'Invoice', icon: 'mdi:receipt-text-outline' },
  { to: '/surat-jalan', label: 'Surat Jalan', icon: 'mdi:file-document-outline' }
];

const route = useRoute();
const router = useRouter();
const active = (to: string) => computed(() => route.path.startsWith(to));

const emit = defineEmits<{
  close: [];
}>();

async function handleLogout() {
  await fetch('/api/auth?endpoint=logout', { method: 'POST', credentials: 'include' });
  router.push('/login');
}

function handleClick() {
  emit('close');
}
</script>

<template>
  <aside class="h-screen w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
    <div class="h-16 flex items-center justify-between px-4 gap-3">
      <div class="flex items-center gap-3">
        <div class="h-9 w-9 rounded-md bg-primary text-white flex items-center justify-center font-semibold">EP</div>
        <div class="leading-tight">
          <div class="text-sm font-semibold">Enterprise ERP</div>
          <div class="text-xs text-gray-500">Operations</div>
        </div>
      </div>
      <button
        class="lg:hidden h-8 w-8 grid place-items-center rounded hover:bg-gray-100"
        @click="$emit('close')"
      >
        <Icon
          icon="mdi:close"
          class="text-[20px]"
        />
      </button>
    </div>
    <nav class="px-2 py-2 space-y-1">
      <RouterLink
        v-for="it in items"
        :key="it.to"
        :to="it.to"
        class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 hover:translate-x-1"
        :class="active(it.to).value ? 'bg-primary-light text-primary-dark shadow-sm' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
        @click="handleClick"
      >
        <Icon
          :icon="it.icon"
          class="text-[18px]"
        />
        <span>{{ it.label }}</span>
      </RouterLink>
    </nav>
    <div class="mt-auto p-3">
      <div class="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
        <div class="h-8 w-8 rounded-full bg-violet-500 text-white grid place-items-center text-xs">AD</div>
        <div class="flex-1 text-xs">
          <div class="font-medium">Admin User</div>
          <div class="text-gray-500">admin@company.com</div>
        </div>
        <button
          @click="handleLogout"
          class="h-8 w-8 rounded-lg hover:bg-gray-200 grid place-items-center text-gray-600"
          title="Logout"
        >
          <Icon
            icon="mdi:logout"
            class="text-[18px]"
          />
        </button>
      </div>
    </div>
  </aside>
</template>
