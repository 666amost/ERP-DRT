import { createRouter, createWebHistory } from 'vue-router';
import { useAuth, ROLE_PERMISSIONS, type UserRole } from './composables/useAuth';

const Shell = () => import('./components/layout/Shell.vue');
const Login = () => import('./pages/Login.vue');
const Dashboard = () => import('./pages/Dashboard.vue');
const PodUpload = () => import('./pages/PodUpload.vue');
const AdminPodList = () => import('./pages/AdminPodList.vue');
const AdminCompany = () => import('./pages/AdminCompany.vue');
const BarangKeluar = () => import('./pages/BarangKeluar.vue');
const Pelacakan = () => import('./pages/Pelacakan.vue');
const Invoice = () => import('./pages/Invoice.vue');
const SuratJalan = () => import('./pages/SuratJalan.vue');
const DBL = () => import('./pages/DBL.vue');
const Outstanding = () => import('./pages/Outstanding.vue');
const Tagihan = () => import('./pages/Tagihan.vue');
const Pelunasan = () => import('./pages/Pelunasan.vue');
const DailyReport = () => import('./pages/DailyReport.vue');
const DBLReport = () => import('./pages/DBLReport.vue');
const OperationalCost = () => import('./pages/OperationalCost.vue');
const Sales = () => import('./pages/Sales.vue');
const Unauthorized = () => import('./pages/Unauthorized.vue');

type PermissionKey = keyof typeof ROLE_PERMISSIONS.admin;

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: Login },
    { path: '/unauthorized', name: 'unauthorized', component: Unauthorized },
    { path: '/', redirect: '/login' },
    {
      path: '/',
      component: Shell,
      meta: { requiresAuth: true },
      children: [
        { path: 'dashboard', name: 'dashboard', component: Dashboard, meta: { requiresAuth: true, permission: 'canViewDashboard' as PermissionKey } },
        { path: 'barang-keluar', name: 'barang-keluar', component: BarangKeluar, meta: { requiresAuth: true, permission: 'canViewSPB' as PermissionKey } },
        { path: 'dbl', name: 'dbl', component: DBL, meta: { requiresAuth: true, permission: 'canViewDBL' as PermissionKey } },
        { path: 'pelacakan', name: 'pelacakan', component: Pelacakan, meta: { requiresAuth: true, permission: 'canViewPelacakan' as PermissionKey } },
        { path: 'invoice', name: 'invoice', component: Invoice, meta: { requiresAuth: true, permission: 'canViewKeuangan' as PermissionKey } },
        { path: 'surat-jalan', name: 'surat-jalan', component: SuratJalan, meta: { requiresAuth: true, permission: 'canViewSuratJalan' as PermissionKey } },
        { path: 'outstanding', name: 'outstanding', component: Outstanding, meta: { requiresAuth: true, permission: 'canViewKeuangan' as PermissionKey } },
        { path: 'tagihan', name: 'tagihan', component: Tagihan, meta: { requiresAuth: true, permission: 'canViewKeuangan' as PermissionKey } },
        { path: 'pelunasan', name: 'pelunasan', component: Pelunasan, meta: { requiresAuth: true, permission: 'canPelunasan' as PermissionKey } },
        { path: 'report/daily', name: 'daily-report', component: DailyReport },
        { path: 'report/dbl', name: 'dbl-report', component: DBLReport },
        { path: 'report/operational', name: 'operational-cost', component: OperationalCost, meta: { requiresAuth: true, permission: 'canViewOperationalCost' as PermissionKey } },
        { path: 'report/sales', name: 'sales-report', component: Sales, meta: { requiresAuth: true, permission: 'canViewSalesReport' as PermissionKey } },
        { path: 'admin/pod', name: 'admin-pod', component: AdminPodList, meta: { requiresAuth: true, permission: 'canViewSettings' as PermissionKey } },
        { path: 'admin/company', name: 'admin-company', component: AdminCompany, meta: { requiresAuth: true, permission: 'canViewSettings' as PermissionKey } }
      ]
    },
    { path: '/pod/:token', name: 'pod-upload', component: PodUpload, props: true }
  ]
});

router.beforeEach(async (to, _from, next) => {
  if (to.meta.requiresAuth) {
    try {
      const res = await fetch('/api/auth?endpoint=me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const user = data.user;
        const role: UserRole = user?.role || 'staff';
        const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.staff;
        
        if (to.meta.permission) {
          const requiredPermission = to.meta.permission as PermissionKey;
          if (!permissions[requiredPermission]) {
            next('/unauthorized');
            return;
          }
        }
        
        const { setUser } = useAuth();
        setUser(user);
        next();
      } else {
        next('/login');
      }
    } catch (err) {
      console.warn('Auth check failed', err);
      next('/login');
    }
  } else {
    next();
  }
});
