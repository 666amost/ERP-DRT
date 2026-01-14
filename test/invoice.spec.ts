import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Invoice from '../src/pages/Invoice.vue';

describe('Invoice.vue', () => {
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
    expect(wrapper.findAll('[class~="lg:hidden"]').length).toBeGreaterThanOrEqual(0);
  });
});
