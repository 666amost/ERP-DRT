import { createRouter, createWebHistory } from 'vue-router';

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
const Pelunasan = () => import('./pages/Pelunasan.vue');
const DailyReport = () => import('./pages/DailyReport.vue');
const DBLReport = () => import('./pages/DBLReport.vue');
const Sales = () => import('./pages/Sales.vue');

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: Login },
    { path: '/', redirect: '/login' },
    {
      path: '/',
      component: Shell,
      meta: { requiresAuth: true },
      children: [
        { path: 'dashboard', name: 'dashboard', component: Dashboard },
        { path: 'barang-keluar', name: 'barang-keluar', component: BarangKeluar },
        { path: 'dbl', name: 'dbl', component: DBL },
        { path: 'pelacakan', name: 'pelacakan', component: Pelacakan },
        { path: 'invoice', name: 'invoice', component: Invoice },
        { path: 'surat-jalan', name: 'surat-jalan', component: SuratJalan },
        { path: 'outstanding', name: 'outstanding', component: Outstanding },
        { path: 'pelunasan', name: 'pelunasan', component: Pelunasan },
        { path: 'report/daily', name: 'daily-report', component: DailyReport },
        { path: 'report/dbl', name: 'dbl-report', component: DBLReport },
        { path: 'report/sales', name: 'sales-report', component: Sales },
        { path: 'admin/pod', name: 'admin-pod', component: AdminPodList },
        { path: 'admin/company', name: 'admin-company', component: AdminCompany }
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
