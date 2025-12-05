<script setup lang="ts">
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { computed, ref, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useAuth } from '../../composables/useAuth';

type SubItem = { to: string; label: string };
type MenuItem = { 
  to?: string; 
  label: string; 
  icon: string; 
  children?: SubItem[];
  requirePermission?: 'canViewKeuangan' | 'canViewSalesReport' | 'canPelunasan' | 'canViewSettings';
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
  requirePermission?: 'canViewKeuangan' | 'canViewSalesReport' | 'canPelunasan' | 'canViewSettings';
};

const allMenuGroups: MenuGroup[] = [
  {
    title: 'MENU UTAMA',
    items: [
      { to: '/dashboard', label: 'Dasboard', icon: 'mdi:view-dashboard-outline' },
      { to: '/barang-keluar', label: 'SPB RESI', icon: 'mdi:archive-arrow-down-outline' },
      { to: '/dbl', label: 'DBL/Manifes', icon: 'mdi:clipboard-list-outline' },
      { to: '/surat-jalan', label: 'Surat Jalan', icon: 'mdi:file-document-outline' },
      { to: '/pelacakan', label: 'Pelacakan', icon: 'mdi:truck-outline' },
    ]
  },
  {
    title: 'KEUANGAN',
    requirePermission: 'canViewKeuangan',
    items: [
      { to: '/invoice', label: 'Invoice', icon: 'mdi:receipt-text-outline' },
      { to: '/outstanding', label: 'Outstanding', icon: 'mdi:clock-alert-outline' },
      { to: '/pelunasan', label: 'Pelunasan', icon: 'mdi:cash-check', requirePermission: 'canPelunasan' },
    ]
  },
  {
    title: 'REPORT',
    items: [
      { to: '/report/daily', label: 'Daily Report (SPB)', icon: 'mdi:file-chart-outline' },
      { to: '/report/dbl', label: 'DBL Report', icon: 'mdi:truck-delivery-outline' },
      { to: '/report/sales', label: 'Sales Report', icon: 'mdi:chart-bar', requirePermission: 'canViewSalesReport' },
    ]
  },
  {
    title: 'PENGATURAN',
    requirePermission: 'canViewSettings',
    items: [
      { to: '/admin/company', label: 'Company', icon: 'mdi:office-building' },
    ]
  }
];

const { user, permissions, fetchUser } = useAuth();
const currentUser = computed(() => user.value);

const menuGroups = computed(() => {
  const p = permissions.value;
  return allMenuGroups
    .filter(group => {
      if (group.requirePermission) {
        return p[group.requirePermission];
      }
      return true;
    })
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (item.requirePermission) {
          return p[item.requirePermission];
        }
        return true;
      })
    }))
    .filter(group => group.items.length > 0);
});

const route = useRoute();
const router = useRouter();
const expandedGroups = ref<Record<string, boolean>>({
  'MENU UTAMA': true,
  'KEUANGAN': true,
  'REPORT': true,
  'PENGATURAN': true
});

const isActive = (to: string) => computed(() => route.path === to || route.path.startsWith(to + '/'));

function toggleGroup(title: string) {
  expandedGroups.value[title] = !expandedGroups.value[title];
}

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

onMounted(() => {
  fetchUser();
});

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const base = (name && name.trim()) ? name!.trim() : ((email || '').split('@')[0] || '');
  const parts = base.split(/\s+/).filter(Boolean);
  const first = (parts[0] || '').charAt(0);
  const second = (parts[1] || '').charAt(0);
  const inits = `${first}${second}`.toUpperCase();
  return inits || (first.toUpperCase() || 'US');
}
</script>

<template>
  <aside class="h-screen w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
    <div class="h-16 flex items-center justify-between px-4 gap-3 border-b border-gray-100 dark:border-gray-700">
      <div class="flex items-center gap-3">
        <img
          src="/brand/logo.png"
          alt="Logo"
          class="h-9 w-9 rounded-md object-contain border border-gray-200"
        >
        <div class="leading-tight">
          <div class="text-sm font-semibold">
            SUMBER TRANS EXPRESS
          </div>
          <div class="text-xs text-gray-500">
            Operations
          </div>
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
    
    <nav class="flex-1 overflow-y-auto px-2 py-3">
      <div v-for="group in menuGroups" :key="group.title" class="mb-3">
        <button 
          class="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600"
          @click="toggleGroup(group.title)"
        >
          <span>{{ group.title }}</span>
          <Icon 
            :icon="expandedGroups[group.title] ? 'mdi:chevron-down' : 'mdi:chevron-right'" 
            class="text-sm"
          />
        </button>
        
        <Transition name="slide">
          <div v-show="expandedGroups[group.title]" class="space-y-0.5 mt-1">
            <RouterLink
              v-for="item in group.items"
              :key="item.to || item.label"
              :to="item.to || '/'"
              class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 hover:translate-x-1"
              :class="isActive(item.to || '/').value ? 'bg-primary-light text-primary-dark shadow-sm font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
              @click="handleClick"
            >
              <Icon
                :icon="item.icon"
                class="text-[18px]"
              />
              <span>{{ item.label }}</span>
            </RouterLink>
          </div>
        </Transition>
      </div>
    </nav>
    
    <div class="p-3 border-t border-gray-100 dark:border-gray-700">
      <div class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
        <div class="h-8 w-8 rounded-full bg-violet-500 text-white grid place-items-center text-xs font-medium">
          {{ initials(currentUser?.name || null, currentUser?.email || null) }}
        </div>
        <div class="flex-1 text-xs min-w-0">
          <div class="font-medium truncate">
            {{ currentUser?.name || (currentUser?.email || '').split('@')[0] || 'User' }}
          </div>
          <div class="text-gray-500 truncate">
            {{ currentUser?.email || '-' }}
          </div>
        </div>
        <button
          class="h-8 w-8 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 grid place-items-center text-gray-600 dark:text-gray-400"
          title="Logout"
          @click="handleLogout"
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

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
}

.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
