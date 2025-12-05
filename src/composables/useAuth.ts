import { ref, computed } from 'vue';

export type UserRole = 'admin' | 'staff' | 'accounting';

export type AuthUser = {
  id: number;
  email: string;
  name: string | null;
  role: UserRole;
};

const currentUser = ref<AuthUser | null>(null);
const isLoading = ref(true);

export const ROLE_PERMISSIONS = {
  admin: {
    canViewKeuangan: true,
    canViewSalesReport: true,
    canViewPelacakan: true,
    canDeleteShipment: true,
    canEditShipment: true,
    canCreateAWB: true,
    canPelunasan: true,
    canViewSettings: true,
    canViewDashboard: true,
    canViewSPB: true,
    canViewDBL: true,
    canViewSuratJalan: true,
    canViewOperationalCost: true,
  },
  staff: {
    canViewKeuangan: false,
    canViewSalesReport: false,
    canViewPelacakan: true,
    canDeleteShipment: false,
    canEditShipment: true,
    canCreateAWB: true,
    canPelunasan: false,
    canViewSettings: false,
    canViewDashboard: true,
    canViewSPB: true,
    canViewDBL: true,
    canViewSuratJalan: true,
    canViewOperationalCost: false,
  },
  accounting: {
    canViewKeuangan: true,
    canViewSalesReport: false,
    canViewPelacakan: true,
    canDeleteShipment: false,
    canEditShipment: false,
    canCreateAWB: false,
    canPelunasan: true,
    canViewSettings: false,
    canViewDashboard: true,
    canViewSPB: false,
    canViewDBL: false,
    canViewSuratJalan: false,
    canViewOperationalCost: false,
  },
} as const;

export function useAuth() {
  const user = computed(() => currentUser.value);
  const loading = computed(() => isLoading.value);

  const permissions = computed(() => {
    const role = currentUser.value?.role || 'staff';
    return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.staff;
  });

  const isAdmin = computed(() => currentUser.value?.role === 'admin');
  const isStaff = computed(() => currentUser.value?.role === 'staff');
  const isAccounting = computed(() => currentUser.value?.role === 'accounting');

  async function fetchUser(): Promise<AuthUser | null> {
    isLoading.value = true;
    try {
      const res = await fetch('/api/auth?endpoint=me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        currentUser.value = data.user || null;
        return currentUser.value;
      }
      currentUser.value = null;
      return null;
    } catch {
      currentUser.value = null;
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  function setUser(u: AuthUser | null) {
    currentUser.value = u;
  }

  function clearUser() {
    currentUser.value = null;
  }

  function hasPermission(permission: keyof typeof ROLE_PERMISSIONS.admin): boolean {
    return permissions.value[permission] ?? false;
  }

  function canAccessRoute(routePath: string): boolean {
    const p = permissions.value;
    
    const keuanganRoutes = ['/invoice', '/outstanding', '/pelunasan'];
    if (keuanganRoutes.some(r => routePath.startsWith(r))) {
      if (routePath.startsWith('/pelunasan')) {
        return p.canPelunasan;
      }
      return p.canViewKeuangan;
    }
    
    if (routePath.startsWith('/report/sales')) {
      return p.canViewSalesReport;
    }
    
    if (routePath.startsWith('/admin')) {
      return p.canViewSettings;
    }

    if (routePath.startsWith('/pelacakan')) {
      return p.canViewPelacakan;
    }

    if (routePath.startsWith('/dashboard')) {
      return p.canViewDashboard;
    }

    if (routePath.startsWith('/barang-keluar')) {
      return p.canViewSPB;
    }

    if (routePath.startsWith('/dbl')) {
      return p.canViewDBL;
    }

    if (routePath.startsWith('/report/operational')) {
      return p.canViewOperationalCost;
    }

    if (routePath.startsWith('/surat-jalan')) {
      return p.canViewSuratJalan;
    }
    
    return true;
  }

  return {
    user,
    loading,
    permissions,
    isAdmin,
    isStaff,
    isAccounting,
    fetchUser,
    setUser,
    clearUser,
    hasPermission,
    canAccessRoute,
  };
}
