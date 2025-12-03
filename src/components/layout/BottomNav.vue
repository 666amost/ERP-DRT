<template>
  <nav class="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-800/95 border-t border-gray-200 dark:border-gray-700 lg:hidden z-[999] backdrop-blur-md shadow-lg print:hidden">
    <div class="max-w-4xl mx-auto flex justify-between items-center px-1 sm:px-2 py-1.5">
      <button
        v-for="item in navItems"
        :key="item.name"
        class="flex flex-col items-center text-[9px] sm:text-[10px] transition-all duration-200 min-w-0 flex-1 py-1 rounded-lg"
        :class="isActive(item.to) ? 'text-primary-dark bg-primary-light/50' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'"
        :aria-label="item.label"
        @click="navigate(item)"
      >
        <Icon
          :icon="item.icon"
          class="text-[18px] sm:text-[20px]"
        />
        <span class="truncate max-w-full mt-0.5">{{ item.label }}</span>
      </button>
      
      <button
        class="flex flex-col items-center text-[9px] sm:text-[10px] transition-all duration-200 min-w-0 flex-1 py-1 rounded-lg"
        :class="showMore ? 'text-primary-dark bg-primary-light/50' : 'text-gray-600 dark:text-gray-400'"
        aria-label="Lainnya"
        @click="showMore = !showMore"
      >
        <Icon
          icon="mdi:dots-horizontal"
          class="text-[18px] sm:text-[20px]"
        />
        <span class="truncate max-w-full mt-0.5">Lainnya</span>
      </button>
    </div>
    
    <Transition name="slide-up">
      <div 
        v-if="showMore" 
        class="absolute bottom-full left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg rounded-t-xl"
      >
        <div class="p-3 max-h-[60vh] overflow-y-auto">
          <div v-for="group in moreMenuGroups" :key="group.title" class="mb-3">
            <div class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
              {{ group.title }}
            </div>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="item in group.items"
                :key="item.to"
                class="flex flex-col items-center p-3 rounded-lg transition-all"
                :class="isActive(item.to) ? 'bg-primary-light text-primary-dark' : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'"
                @click="navigateTo(item.to)"
              >
                <Icon :icon="item.icon" class="text-xl mb-1" />
                <span class="text-[10px] text-center leading-tight">{{ item.label }}</span>
              </button>
            </div>
          </div>
        </div>
        <button 
          class="w-full py-3 text-center text-sm text-gray-500 border-t border-gray-200 dark:border-gray-700"
          @click="showMore = false"
        >
          Tutup
        </button>
      </div>
    </Transition>
  </nav>
  
  <div 
    v-if="showMore" 
    class="fixed inset-0 bg-black/30 z-[998] lg:hidden"
    @click="showMore = false"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';

const route = useRoute();
const router = useRouter();
const showMore = ref(false);

type NavItem = {
  name: string;
  to: string;
  label: string;
  icon: string;
};

const navItems: NavItem[] = [
  { name: 'dashboard', to: '/dashboard', label: 'Dasbor', icon: 'mdi:view-dashboard-outline' },
  { name: 'barang-keluar', to: '/barang-keluar', label: 'Keluar', icon: 'mdi:archive-arrow-down-outline' },
  { name: 'dbl', to: '/dbl', label: 'DBL', icon: 'mdi:clipboard-list-outline' },
  { name: 'invoice', to: '/invoice', label: 'Invoice', icon: 'mdi:receipt-text-outline' },
];

const moreMenuGroups = [
  {
    title: 'Operasional',
    items: [
      { to: '/surat-jalan', label: 'Surat Jalan', icon: 'mdi:file-document-outline' },
      { to: '/pelacakan', label: 'Pelacakan', icon: 'mdi:truck-outline' },
    ]
  },
  {
    title: 'Keuangan',
    items: [
      { to: '/outstanding', label: 'Outstanding', icon: 'mdi:clock-alert-outline' },
      { to: '/pelunasan', label: 'Pelunasan', icon: 'mdi:cash-check' },
    ]
  },
  {
    title: 'Report',
    items: [
      { to: '/report/daily', label: 'Daily SPB', icon: 'mdi:file-chart-outline' },
      { to: '/report/dbl', label: 'DBL Report', icon: 'mdi:truck-delivery-outline' },
      { to: '/report/sales', label: 'Sales', icon: 'mdi:chart-bar' },
    ]
  },
  {
    title: 'Pengaturan',
    items: [
      { to: '/admin/company', label: 'Company', icon: 'mdi:office-building' },
    ]
  }
];

function isActive(to: string): boolean {
  return route.path === to || route.path.startsWith(to + '/');
}

function navigate(item: NavItem) {
  showMore.value = false;
  router.push({ path: item.to });
}

function navigateTo(to: string) {
  showMore.value = false;
  router.push({ path: to });
}
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.25s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(100%);
}
</style>
