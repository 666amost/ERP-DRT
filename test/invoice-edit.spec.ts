import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Invoice from '../src/pages/Invoice.vue';
import { notify } from '../src/composables/useNotifications';

vi.mock('../src/composables/useNotifications', () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
let paidAmount = 0;
let failSave = false;
let failItems = false;
let failChoices = false;
const shipment = (id: number) => ({
  id: id + 10, shipment_id: id, spb_number: `A0000${id}`, shipment_date: '2026-10-30',
  customer_id: 1, customer_name: 'Customer', description: 'Oli', recipient_name: `Recipient ${id}`,
  quantity: 10, unit_price: 100000, other_fee: id === 2 ? 500 : 0, sj_returned: false
});
const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 409, json: async () => body, text: async () => JSON.stringify(body) });
let wrapper: ReturnType<typeof mount> | undefined;
async function renderEdit() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Invoice }] });
  await router.push('/');
  wrapper = mount(Invoice, { global: { plugins: [router], stubs: { Icon: true } } });
  await flushPromises();
  await wrapper.findAll('button').find(button => button.text() === 'Edit')!.trigger('click');
  await flushPromises();
  return wrapper;
}
function savedRequests() {
  return vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('endpoint=set-items'));
}

describe('simple SPB controls in the invoice edit dialog', () => {
  beforeEach(() => {
    paidAmount = 0; failSave = false; failItems = false; failChoices = false;
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('fetch', vi.fn(async (input: unknown, init?: { method?: string; body?: unknown }) => {
      const url = String(input);
      if (url.includes('/api/auth')) return json({ user: { id: 1, role: 'admin' } });
      if (url.includes('endpoint=items')) return json({ items: [shipment(1), shipment(2)] }, !failItems);
      if (url.includes('endpoint=available-spb')) return json({ items: [shipment(2), shipment(3), shipment(4)] }, !failChoices);
      if (url.includes('endpoint=set-items')) return failSave
        ? json({ error: 'Pembayaran baru masuk. Muat ulang invoice.', request_id: 'edit-ref' }, false)
        : json({ success: true });
      if (init?.method) throw new Error(`Unexpected write: ${url}`);
      return json({ items: [{
        id: 1, invoice_number: 'INV-ORIGINAL', spb_number: 'A00001, A00002',
        customer_name: 'Customer', customer_id: 1, status: paidAmount ? 'partial' : 'pending',
        amount: 200500, subtotal: 200500, paid_amount: paidAmount, issued_at: '2026-10-30'
      }], pagination: { page: 1, limit: 50, total: 1, pages: 1 } });
    }));
  });
  afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.unstubAllGlobals(); });

  it('adds several SPBs, removes one and saves once under the original invoice ID', async () => {
    const page = await renderEdit();
    const list = page.get('[data-testid="invoice-edit-list"]');
    await list.findAll('button').find(button => button.text().includes('Tambah SPB'))!.trigger('click');
    await flushPromises();
    const choices = page.get('[data-testid="invoice-edit-spb-picker"]');
    expect(choices.find('[aria-label="Tambah SPB A00002"]').exists()).toBe(false);
    await choices.get('[aria-label="Pilih semua SPB tambahan"]').setValue(true);
    await choices.findAll('button').find(button => button.text() === 'Tambahkan (2)')!.trigger('click');
    await list.get('[aria-label="Hapus SPB A00001"]').trigger('click');
    expect(list.text()).toContain('Daftar SPB (3)');
    expect(list.find('[aria-label="Hapus SPB A00001"]').exists()).toBe(false);
    expect(savedRequests()).toHaveLength(0);
    await page.findAll('button').find(button => button.text() === 'Simpan Perubahan')!.trigger('click');
    await flushPromises();
    expect(savedRequests()).toHaveLength(1);
    const body = JSON.parse(String(savedRequests()[0]?.[1]?.body));
    expect(body.invoice_id).toBe(1);
    expect(body.items.map((item: { shipment_id: number }) => item.shipment_id)).toEqual([2, 3, 4]);
    expect(body.items[0].other_fee).toBe(500);
    expect(notify.success).toHaveBeenCalledWith('Perubahan invoice berhasil disimpan');
  });

  it('keeps at least one SPB and can add a removed SPB back before saving', async () => {
    const page = await renderEdit();
    const list = page.get('[data-testid="invoice-edit-list"]');
    await list.get('[aria-label="Hapus SPB A00001"]').trigger('click');
    expect(list.get('[aria-label="Hapus SPB A00002"]').attributes('disabled')).toBeDefined();
    await list.findAll('button').find(button => button.text().includes('Tambah SPB'))!.trigger('click');
    await flushPromises();
    await page.get('[aria-label="Tambah SPB A00001"]').setValue(true);
    await page.findAll('button').find(button => button.text() === 'Tambahkan (1)')!.trigger('click');
    expect(list.text()).toContain('Daftar SPB (2)');
    expect(savedRequests()).toHaveLength(0);
    await page.findAll('button').find(button => button.text() === 'Batal')!.trigger('click');
    expect(savedRequests()).toHaveLength(0);
  });

  it('disables membership changes for invoices with payments', async () => {
    paidAmount = 50000;
    const page = await renderEdit();
    const list = page.get('[data-testid="invoice-edit-list"]');
    expect(list.findAll('button').find(button => button.text().includes('Tambah SPB'))!.attributes('disabled')).toBeDefined();
    expect(list.get('[aria-label="Hapus SPB A00001"]').attributes('disabled')).toBeDefined();
    expect(list.text()).toContain('belum memiliki pembayaran');
  });

  it('keeps the edited selection visible after a rejected save', async () => {
    failSave = true;
    const page = await renderEdit();
    await page.get('[aria-label="Hapus SPB A00001"]').trigger('click');
    await page.findAll('button').find(button => button.text() === 'Simpan Perubahan')!.trigger('click');
    await flushPromises();
    expect(page.find('[role="dialog"]').exists()).toBe(true);
    expect(page.get('[role="alert"]').text()).toContain('edit-ref');
    expect(page.get('[data-testid="invoice-edit-list"]').text()).toContain('Daftar SPB (1)');
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('does not open the editor with replacement data when loading invoice items fails', async () => {
    failItems = true;
    const page = await renderEdit();
    expect(page.find('[role="dialog"]').exists()).toBe(false);
    expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('Rincian invoice gagal dimuat'));
  });
});
