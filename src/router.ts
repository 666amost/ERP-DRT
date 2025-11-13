import { createRouter, createWebHistory } from 'vue-router';

const Shell = () => import('./components/layout/Shell.vue');
const Login = () => import('./pages/Login.vue');
const Dashboard = () => import('./pages/Dashboard.vue');
const PodUpload = () => import('./pages/PodUpload.vue');
const AdminPodList = () => import('./pages/AdminPodList.vue');
const BarangKeluar = () => import('./pages/BarangKeluar.vue');
const Pelacakan = () => import('./pages/Pelacakan.vue');
const Invoice = () => import('./pages/Invoice.vue');
const SuratJalan = () => import('./pages/SuratJalan.vue');

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: Login },
    { path: '/', redirect: '/dashboard' },
    {
      path: '/',
      component: Shell,
      meta: { requiresAuth: true },
      children: [
        { path: 'dashboard', name: 'dashboard', component: Dashboard },
        { path: 'barang-keluar', name: 'barang-keluar', component: BarangKeluar },
        { path: 'pelacakan', name: 'pelacakan', component: Pelacakan },
        { path: 'invoice', name: 'invoice', component: Invoice },
        { path: 'surat-jalan', name: 'surat-jalan', component: SuratJalan },
        { path: 'admin/pod', name: 'admin-pod', component: AdminPodList }
      ]
    },
    { path: '/pod/:token', name: 'pod-upload', component: PodUpload, props: true }
  ]
});

router.beforeEach(async (to, _from, next) => {
  if (to.meta.requiresAuth) {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        next();
      } else {
        next('/login');
      }
    } catch {
      next('/login');
    }
  } else {
    next();
  }
});
