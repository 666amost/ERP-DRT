import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRouter, createMemoryHistory } from 'vue-router';
import Invoice from '../src/pages/Invoice.vue';
vi.mock('../src/lib/company', () => ({ getCompany: async () => ({ name: 'Test Company', address: 'Test Address' }) }));
const invoice = { id: 1, invoice_number: 'INV-TEST', customer_name: 'Customer', amount: 88200, subtotal: 100000, discount_amount: 10000, pph_percent: 2, status: 'pending', issued_at: '2026-09-01', remaining_amount: 88200 };
let failItems = false;
let html = '';
const print = vi.fn();
const close = vi.fn();
async function render() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Invoice }] });
  await router.push('/');
  const wrapper = mount(Invoice, { global: { plugins: [router], stubs: { Icon: true } } });
  await flushPromises();
  return wrapper;
}
describe('invoice print safety', () => {
  beforeEach(() => {
    failItems = false; html = ''; vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(async input => {
      const url = String(input);
      if (url.includes('endpoint=items')) return { ok: !failItems, json: async () => ({ items: [{ unit_price: 100000, other_fee: 0, item_discount: 0, quantity: 1 }] }) };
      if (url.includes('/api/auth')) return { ok: true, json: async () => ({ user: { id: 1, role: 'admin' } }) };
      return { ok: true, json: async () => ({ items: [invoice], pagination: { page: 1, limit: 50, total: 1, pages: 1 } }) };
    }));
    vi.spyOn(window, 'open').mockReturnValue({ closed: false, close, focus: vi.fn(), print, document: { body: { textContent: '' }, open: vi.fn(), write: (value: string) => { html = value; }, close: vi.fn(), images: [], fonts: { ready: Promise.resolve() } } } as unknown as Window);
  });
  it('prints the invoice-level discount and the same total as the form', async () => {
    const wrapper = await render();
    await wrapper.findAll('button').find(button => button.text() === 'Cetak')!.trigger('click');
    await flushPromises();
    expect(html).toContain('Diskon Invoice');
    expect(html).toContain('88.200');
    expect(html).not.toContain('98.000');
    expect(print).toHaveBeenCalledOnce();
    wrapper.unmount();
  });
  it('does not print fallback items after a failed request', async () => {
    failItems = true;
    const wrapper = await render();
    await wrapper.findAll('button').find(button => button.text() === 'Cetak')!.trigger('click');
    await flushPromises();
    expect(print).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
    expect(wrapper.find('[role="alert"]').text()).toContain('Rincian invoice gagal dimuat');
    wrapper.unmount();
  });
  it('explains a blocked popup', async () => {
    vi.mocked(window.open).mockReturnValue(null);
    const wrapper = await render();
    await wrapper.findAll('button').find(button => button.text() === 'Cetak')!.trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toContain('Jendela cetak diblokir');
    expect(print).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
