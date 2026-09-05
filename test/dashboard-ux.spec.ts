import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRouter, createMemoryHistory } from 'vue-router';
import { ref } from 'vue';
import Dashboard from '../src/pages/Dashboard.vue';
import http from '../src/lib/http';
import { useAuth } from '../src/composables/useAuth';
vi.mock('../src/lib/http', () => ({ default: { get: vi.fn() } }));
vi.mock('../src/composables/useTheme', () => ({ useTheme: () => ({ theme: ref('light') }) }));
async function renderDashboard() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Dashboard }] });
  await router.push('/');
  return mount(Dashboard, { global: { plugins: [router], stubs: { DashboardChart: true, Icon: true } } });
}
describe('dashboard data and permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ user: { id: 1, name: 'Staff', email: 'staff@example.test', role: 'staff' } }) })));
    useAuth().clearUser();
    vi.mocked(http.get).mockImplementation(async url => ({ data: url?.includes('stats') ? { outgoingToday: 53, deliveryNotes: 11670 } : { items: [] } }));
  });
  it('does not request or show tracking and financial data for staff', async () => {
    const wrapper = await renderDashboard();
    await flushPromises();
    expect(wrapper.text()).toContain('SPB Dibuat Hari Ini');
    expect(wrapper.text()).toContain('11.670');
    expect(wrapper.text()).not.toContain('DBL Aktif');
    expect(wrapper.text()).not.toContain('Pengiriman Aktif');
    expect(vi.mocked(http.get).mock.calls.map(call => call[0])).toEqual(['/dashboard?endpoint=stats', '/dbl?endpoint=list&limit=5']);
    wrapper.unmount();
  });
  it('shows an actionable error instead of misleading zero statistics', async () => {
    vi.mocked(http.get).mockRejectedValue(new Error('offline'));
    const wrapper = await renderDashboard();
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toContain('belum berhasil dimuat');
    expect(wrapper.text()).toContain('Coba lagi');
    expect(wrapper.text()).not.toContain('SPB Dibuat Hari Ini');
    wrapper.unmount();
  });
  it.each([
    ['admin', true, true], ['staff', true, false], ['accounting', false, true], ['driver', false, false]
  ] as const)('shows creation shortcuts only for the %s role', async (role, spb, invoice) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ user: { id: 1, name: 'User', email: 'user@example.test', role } }) })));
    const wrapper = await renderDashboard();
    await flushPromises();
    const labels = wrapper.findAll('button').map(button => button.text());
    expect(labels.includes('Buat SPB')).toBe(spb);
    expect(labels.includes('Buat Invoice')).toBe(invoice);
    wrapper.unmount();
  });
});
