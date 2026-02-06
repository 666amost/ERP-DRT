import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Invoice from '../src/pages/Invoice.vue';

describe('Invoice.vue', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: unknown) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : typeof (input as { url?: unknown }).url === 'string'
            ? (input as { url?: unknown }).url as string
            : String(input);
      if (url.includes('/api/invoices')) {
        return {
          ok: true,
          json: async () => ({
            items: [],
            pagination: { page: 1, limit: 50, total: 0, pages: 1 }
          })
        } as any;
      }
      if (url.includes('/api/auth')) {
        return { ok: true, json: async () => ({ user: null }) } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    }) as any);
  });

  it('renders without crashing and shows mobile card wrapper', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: Invoice }]
    });

    router.push({ path: '/', query: {} });
    await router.isReady();

    const wrapper = mount(Invoice, {
      global: {
        plugins: [router],
        stubs: ['CustomerAutocomplete', 'Button', 'Badge', 'Icon']
      }
    });

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('[data-testid="btn-tambah"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="btn-cicilan"]').exists()).toBe(true);
  });
});
